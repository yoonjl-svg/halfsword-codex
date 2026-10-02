#!/usr/bin/env python3
"""Compact existing Q02 evidence; never rerun physics or overwrite raw traces."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("inputs", nargs="+", type=Path)
parser.add_argument("--out", required=True, type=Path)
args = parser.parse_args()
if args.out.exists():
    raise SystemExit(f"Refusing overwrite: {args.out}")
batches = []
for path in args.inputs:
    blob = path.read_bytes()
    data = json.loads(blob)
    if data["error"] or not data["sourceStable"] or not data["headStable"]:
        raise SystemExit(f"Invalid source/run: {path}")
    for guard in data["guards"]:
        if any(v is not True for k, v in guard.items() if k not in ("scenario", "variant")):
            raise SystemExit(f"Failed execution guard: {guard}")
    comparisons = []
    for scenario in ("healthy_getup", "hurt_getup"):
        rows = [r for r in data["rows"] if r["scenario"] == scenario]
        baseline = next(r for r in rows if r["comTransfer"]["variant"] == "observe")
        for row in rows:
            if not row["comTransfer"]["variant"].startswith("supportShift"):
                continue
            first = next(((a, b) for a, b in zip(baseline["comTransfer"]["frames"], row["comTransfer"]["frames"])
                          if a["force"] != b["force"]), None)
            if not first:
                raise SystemExit("Candidate request never reached an actual horizontal force")
            a, b = first
            if a["timeS"] != b["timeS"]:
                raise SystemExit("Mismatched observation time grids")
            comp = {"scenario": scenario, "variant": row["comTransfer"]["variant"],
                    "firstForceDifference": {"timeS": a["timeS"], "baselineN": a["force"], "candidateN": b["force"]},
                    "firstEligibleS": row["comTransfer"]["firstEligible"]["timeS"],
                    "firstEligibleExact": row["comTransfer"]["firstEligibleExact"],
                    "targetCorrectionCount": row["comTransfer"]["applications"]}
            if row["comTransfer"]["variant"] == "supportShiftCarry":
                frames = {round(f["timeS"] * 120): f for f in row["launchObservation"]["compactPerStep"]}
                requests = [r for r in row["comTransfer"]["requests"] if r["state"] == "stand"]
                weighted = []
                for request in requests:
                    frame = frames[round(request["timeS"] * 120)]
                    lev = frame["levH"]
                    observed = (request["correction"]["x"] ** 2 + request["correction"]["z"] ** 2) ** .5
                    expected = min(.3, (request["observation"]["outsideM"] or 0) * 1.5) * lev
                    weighted.append(abs(observed-expected))
                    if lev <= 0 or abs(observed-expected) > 1e-10:
                        raise SystemExit("Carry not weighted by the actual handover signal")
                comp["carryPostprocessing"] = {"standRequests": len(requests),
                    "allPositiveHandover": all(frames[round(r["timeS"]*120)]["levH"] > 0 for r in requests),
                    "maxWeightFormulaErrorMps": max(weighted, default=0),
                    "lastStandRequestS": requests[-1]["timeS"] if requests else None,
                    "definition": "Read-only postprocessing of stored requests and same-time actual levH, separate from original runtime guards."}
            comparisons.append(comp)
    # Recompute absence-aware getup summaries, including older rows that did not
    # store emptyHullSteps. Missing support is never converted to zero error.
    summaries = []
    for old in data["summary"]:
        summary = dict(old)
        row = next(r for r in data["rows"] if r["scenario"] == old["scenario"] and r["comTransfer"]["variant"] == old["variant"])
        stand = row["firstStandS"]
        getup = [f for f in row["comTransfer"]["frames"] if f["state"] == "getup" and (stand is None or f["timeS"] < stand)]
        values = [f["support"]["outsideM"] for f in getup if f["support"]["outsideM"] is not None]
        summary["firstGetup"] = {**summary["firstGetup"], "steps": len(getup), "emptyHullSteps": len(getup)-len(values),
                                 "maxOutsideSupportM": max(values) if values else None}
        summaries.append(summary)
    batches.append({"path": str(path), "rawSha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob),
                    **{key: data[key] for key in ("createdUTC", "command", "headBefore", "headAfter", "headStable", "sourceBefore", "sourceAfter", "sourceStable", "cloneSha", "wallSeconds", "protocol", "guards")},
                    "summary": summaries, "postprocessedComparisons": comparisons})
result = {"schemaVersion": 1, "probe": "recovery_com_transfer_round8", "batches": batches,
          "interpretation": "r1 repeats r2's projected baseline/observe/getup-only arms and is not added as independent samples. Protocol, not row.model, determines actual support law: the common runner argument is projected even for legacy checkpoint switches. Existing direct horizontal and upright actuation remain. Research screen only; no public/default adoption."}
args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n")
print(json.dumps({"out": str(args.out), "batches": len(batches), "rows": sum(len(b["summary"]) for b in batches)}))
