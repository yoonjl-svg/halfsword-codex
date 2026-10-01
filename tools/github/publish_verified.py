#!/usr/bin/env python3
"""Check or explicitly publish a verified incremental development bundle.

Default: remote reads only (plus fetching a missing main commit locally).
--publish: workflow Contents updates, bundle upload, then Actions dispatch.
No direct push, force update, deployment, or workflow-completion polling.
"""

import argparse
import base64
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote


TARGET = "yoonjl-svg/halfsword-codex"
REMOTE = f"https://github.com/{TARGET}.git"
BRANCH = "codex/hybrid-support"
REPO = Path(__file__).resolve().parents[2]
LOGS = Path("/workspace/github-recovery")
BUNDLE_PATH = ".codex-transfer/work.bundle"
WORKFLOW = ".github/workflows/codex-transfer.yml"
SHA = re.compile(r"^[0-9a-f]{40}$")


class Refused(RuntimeError):
    pass


def git(*args, binary=False, allow_failure=False):
    result = subprocess.run(
        ["git", *args], cwd=REPO, capture_output=True,
        text=not binary, timeout=120,
    )
    if result.returncode and not allow_failure:
        raise Refused(f"Local git operation failed: {args[0]}")
    return result


def api(method, endpoint, data=None, missing_ok=False):
    command = ["gh", "api", "--hostname", "github.com", "--method", method,
               f"repos/{TARGET}/{endpoint}"]
    if data is not None:
        command += ["--input", "-"]
    result = subprocess.run(
        command, input=json.dumps(data) if data is not None else None,
        capture_output=True, text=True, timeout=120,
    )
    try:
        body = json.loads(result.stdout) if result.stdout.strip() else None
    except ValueError:
        raise Refused(f"Invalid API response: {method} {endpoint.split('?')[0]}")
    if result.returncode:
        if missing_ok and isinstance(body, dict) and str(body.get("status")) == "404":
            return None
        # Do not echo gh stderr, environment, credentials, or arbitrary responses.
        raise Refused(f"GitHub API failed: {method} {endpoint.split('?')[0]}")
    return body


def checked_sha(value):
    if not isinstance(value, str) or not SHA.fullmatch(value):
        raise Refused("Expected a full Git SHA-1 commit/blob identifier")
    return value


def remote_main():
    return checked_sha(api("GET", "git/ref/heads/main")["object"]["sha"])


def blob_sha(content):
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()


def contents(path, base):
    return api("GET", "contents/" + quote(path, safe="/") + "?ref=" + base,
               missing_ok=True)


def matches(old, content, exact_bytes=False):
    if old is None:
        return False
    if old.get("type") != "file":
        raise Refused("Remote Contents path is not a regular file")
    if old.get("sha") != blob_sha(content):
        return False
    if exact_bytes:
        if old.get("encoding") != "base64":
            raise Refused("Cannot verify remote workflow bytes through Contents API")
        try:
            return base64.b64decode(old["content"]) == content
        except (KeyError, ValueError):
            raise Refused("Cannot decode remote workflow bytes")
    return True


def save(receipt, path):
    LOGS.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n")


def put(path, content, expected, receipt, receipt_path, exact_bytes=False):
    if remote_main() != expected:
        raise Refused("Remote main changed before Contents update; aborting")
    old = contents(path, expected)
    if matches(old, content, exact_bytes):
        receipt["writes"].append({"path": path, "unchanged": True,
                                  "blob": blob_sha(content)})
        save(receipt, receipt_path)
        return expected
    payload = {"branch": "main", "message": "Prepare verified source transfer [skip ci]",
               "content": base64.b64encode(content).decode("ascii")}
    if old is not None:
        payload["sha"] = checked_sha(old["sha"])
    # File sha prevents competing changes to this path; commit-parent validation
    # additionally detects unrelated main changes. Neither is a force update.
    receipt["write_pending"] = {"path": path, "expected_parent": expected}
    save(receipt, receipt_path)
    response = api("PUT", "contents/" + quote(path, safe="/"), payload)
    commit = response.get("commit", {})
    new_head = checked_sha(commit.get("sha"))
    parents = commit.get("parents", [])
    receipt["writes"].append({"path": path, "commit": new_head,
                              "blob": response.get("content", {}).get("sha"),
                              "expected_parent": expected,
                              "actual_parent": parents[0].get("sha") if parents else None})
    receipt["last_write_commit"] = new_head
    receipt.pop("write_pending", None)
    save(receipt, receipt_path)
    if not parents or parents[0].get("sha") != expected:
        raise Refused("Contents commit parent differs from expected main; no further writes")
    if response.get("content", {}).get("sha") != blob_sha(content):
        raise Refused("Uploaded blob differs from local content; no further writes")
    receipt["bootstrap_head"] = new_head
    save(receipt, receipt_path)
    return new_head


def run(publish, receipt, receipt_path):
    if git("remote", "get-url", "origin").stdout.strip() != REMOTE:
        raise Refused("origin must exactly match the independent repository .git URL")
    if git("branch", "--show-current").stdout.strip() != BRANCH:
        raise Refused(f"Current branch must be {BRANCH}")
    if git("status", "--porcelain", "--untracked-files=all").stdout.strip():
        raise Refused("Working tree must be clean, including untracked files")
    head = checked_sha(git("rev-parse", "HEAD").stdout.strip())
    base = remote_main()
    receipt.update(local_head=head, remote_main=base, bootstrap_head=base)
    if git("cat-file", "-e", base + "^{commit}", allow_failure=True).returncode:
        git("fetch", "--no-tags", "origin", "main")
        if remote_main() != base:
            raise Refused("Remote main changed during fetch; rerun the check")
        git("cat-file", "-e", base + "^{commit}")
    if git("merge-base", "--is-ancestor", base, head, allow_failure=True).returncode:
        raise Refused("Remote main must be an ancestor of local HEAD; reconcile locally first")
    if head == base:
        receipt["status"] = "noop"
        return

    paths = git("ls-files", "-z", "--", ".github/workflows", binary=True).stdout
    workflows = {}
    for name in paths.split(b"\0"):
        if name:
            path = name.decode("utf-8")
            workflows[path] = git("show", f"{head}:{path}", binary=True).stdout
    if WORKFLOW not in workflows:
        raise Refused("Tracked transfer workflow is required")
    if b"expected_base" not in workflows[WORKFLOW] or b"GITHUB_SHA" not in workflows[WORKFLOW]:
        raise Refused("Transfer workflow must contain the expected_base/GITHUB_SHA guard")
    tree = api("GET", f"git/trees/{base}?recursive=1")
    if tree.get("truncated"):
        raise Refused("Remote tree listing is truncated; cannot verify workflow paths")
    extra = [item["path"] for item in tree["tree"]
             if item["type"] == "blob" and item["path"].startswith(".github/workflows/")
             and item["path"] not in workflows]
    if extra:
        raise Refused("Remote has additional workflow files; reconcile explicitly before transfer")
    receipt["workflow_checks"] = [
        {"path": path, "blob": blob_sha(data),
         "identical": matches(contents(path, base), data, exact_bytes=True)}
        for path, data in sorted(workflows.items())
    ]
    receipt["bundle_range"] = f"{base}..{BRANCH}"
    if not publish:
        if remote_main() != base:
            raise Refused("Remote main changed during check; rerun")
        receipt["status"] = "checked"
        return

    receipt["status"] = "preparing_bundle"
    save(receipt, receipt_path)
    bundle = receipt_path.with_suffix(".bundle")
    git("bundle", "create", str(bundle), receipt["bundle_range"])
    git("bundle", "verify", str(bundle))
    receipt["bundle_file"] = str(bundle)
    receipt["bundle_sha256"] = hashlib.sha256(bundle.read_bytes()).hexdigest()
    for path, data in sorted(workflows.items()):
        base = put(path, data, base, receipt, receipt_path, exact_bytes=True)
    base = put(BUNDLE_PATH, bundle.read_bytes(), base, receipt, receipt_path)
    if remote_main() != base:
        raise Refused("Remote main changed before dispatch; aborting")
    inputs = {"expected_head": head, "expected_base": base}
    receipt["dispatch"] = {"workflow": "codex-transfer.yml", "ref": "main", "inputs": inputs}
    receipt["status"] = "dispatch_requesting"
    save(receipt, receipt_path)
    api("POST", "actions/workflows/codex-transfer.yml/dispatches",
        {"ref": "main", "inputs": inputs})
    receipt["status"] = "dispatch_requested"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Read-only checks (default); may fetch main locally")
    mode.add_argument("--publish", action="store_true", help="Explicitly upload and dispatch; do not wait or deploy")
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    receipt_path = LOGS / f"verified-transfer-{stamp}.json"
    receipt = {"target": TARGET, "mode": "publish" if args.publish else "check", "writes": []}
    code = 0
    try:
        run(args.publish, receipt, receipt_path)
    except (Refused, OSError, subprocess.TimeoutExpired, KeyError, TypeError, ValueError):
        # No raw subprocess output or exception payload is logged (credential safety).
        error = sys.exc_info()[1]
        receipt["remote_request_unconfirmed"] = bool(
            receipt.get("write_pending") or receipt.get("status") == "dispatch_requesting")
        receipt["status"] = "aborted"
        receipt["error"] = str(error) if isinstance(error, Refused) else "Local/API operation failed; inspect prerequisites"
        code = 1
    save(receipt, receipt_path)
    print(json.dumps({"status": receipt["status"], "receipt": str(receipt_path),
                      "local_head": receipt.get("local_head"),
                      "bootstrap_head": receipt.get("bootstrap_head"),
                      "error": receipt.get("error")}, ensure_ascii=False))
    return code


if __name__ == "__main__":
    sys.exit(main())
