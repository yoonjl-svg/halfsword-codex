"""Read-only decomposition of recorded centerline cutting budget debits.

This reads a hash-verified historical result. It does not import the game,
advance physics, modify a budget, or claim a new gameplay comparison.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys


def artifact(path):
    path = Path(path).resolve()
    data = path.read_bytes()
    return {"path": str(path), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def verified(reference):
    actual = artifact(reference["path"])
    assert actual["sha256"] == reference["sha256"], (actual, reference)
    assert actual["bytes"] == reference["bytes"], (actual, reference)
    return actual


def close(actual, expected, label, tolerance=1e-10):
    assert math.isfinite(actual) and math.isfinite(expected), label
    assert abs(actual - expected) <= tolerance, (label, actual, expected)


def main():
    repo = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path, default=repo / "docs/strike/round5_recovery_20261006.json")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    out = args.out.resolve()
    assert not out.exists(), "Use a fresh output path"
    assert not out.is_relative_to(repo), "Write the derivation outside the checkout"

    record_path = args.record.resolve()
    record = json.loads(record_path.read_bytes())
    run = next(row for row in record["runs"] if row["fixture"] == "helmet-duel")
    raw_ref = next(row for row in run["artifacts"] if row["path"].endswith("/combined.json"))
    raw_artifact = verified(raw_ref)
    run_artifact = verified(run["reportArtifact"])
    raw = json.loads(Path(raw_artifact["path"]).read_bytes())
    run_report = json.loads(Path(run_artifact["path"]).read_bytes())
    assert run_report["measurementValid"] and run_report["sourceStable"]
    source = run_report["source"]
    assert run_report["sourceBefore"] == run_report["sourceAfter"] == source["files"]
    frozen = None
    for candidate in record["frozenSources"]:
        manifest = json.loads(Path(candidate["manifest"]["path"]).read_bytes())
        if manifest["files"] == source["files"]:
            frozen = candidate
            break
    assert frozen is not None, "The result must match a recorded frozen source"
    manifest_artifact = verified(frozen["manifest"])
    frozen_root = Path(frozen["directory"])
    historical_actual = {name: artifact(frozen_root / name)["sha256"] for name in source["files"]}
    assert historical_actual == source["files"], "Historical source files differ from their manifest"

    watched = [record_path, Path(raw_artifact["path"]), Path(run_artifact["path"]),
               Path(manifest_artifact["path"]), Path(__file__).resolve(),
               repo / "src/combat.js", repo / "src/cut_centerline.js", repo / "src/config.js"]
    before = {str(path): artifact(path) for path in watched}
    events = [event for event in raw["events"] if event.get("reaction")]
    capped = [event for event in events if event["reaction"]["J"] < event["J"] - 1e-12]
    drag_caps = [event for event in capped if event["regime"] == "drag"]
    assert len(drag_caps) == 4, "This derivation targets the recorded four-call boundary"

    # The raw does not assign cutting-map episode IDs. Infer runs only from
    # continuous Eleft bookkeeping for each collider key. A last recorded call
    # is not an independently observed collider separation/deletion event.
    by_key = defaultdict(list)
    for event in events:
        by_key[event["key"]].append(event)
    episodes = []
    event_episode = {}
    for key, key_events in by_key.items():
        current = []
        for event in key_events:
            if current and abs(event["budgetBefore"] - current[-1]["budgetAfter"]) > 1e-9:
                episodes.append((key, current))
                current = []
            current.append(event)
        if current:
            episodes.append((key, current))
    for episode_index, (_, episode) in enumerate(episodes):
        for event in episode:
            event_episode[id(event)] = episode_index

    calls = []
    for event in drag_caps:
        reaction = event["reaction"]
        requested_j, applied_j = event["J"], reaction["J"]
        contact_speed, applied_speed = event["s"], reaction["s"]
        debit = requested_j * contact_speed
        cap_refund = (requested_j - applied_j) * contact_speed
        applied_contact_debit = applied_j * contact_speed
        projected_linear_term = applied_j * applied_speed
        point_term = applied_j * (contact_speed - applied_speed)
        finite_term = 0.5 * reaction["a"] * applied_j ** 2
        predicted_loss = projected_linear_term - finite_term
        measured_loss = -event["analysis"]["deltaKJ"]
        close(debit, event["analysis"]["requestedBudgetDebitJ"], "Recorded requested debit")
        close(debit, event["budgetBefore"] - event["budgetAfter"], "Observed Eleft debit")
        close(predicted_loss, -reaction["deltaKPredicted"], "Native-mobility energy formula")
        close(debit - predicted_loss, cap_refund + point_term + finite_term, "Decomposition identity")
        assert event["attacker"] == 0 and event["victimAlive"] and event["aliveAtCombatStart"]
        calls.append({
            "tick": event["tick"], "timeS": event["timeS"], "key": event["key"],
            "inferredEpisode": event_episode[id(event)], "part": event["part"],
            "regime": event["regime"], "victimAlive": event["victimAlive"],
            "requestedJNs": requested_j, "appliedJNs": applied_j,
            "contactSpeedMps": contact_speed, "projectedPointSpeedMps": applied_speed,
            "pairMobilityPerKg": reaction["a"],
            "requestedDebitJ": debit, "appliedJContactDebitJ": applied_contact_debit,
            "capOnlyRefundJ": cap_refund, "pointSpeedDifferenceTermJ": point_term,
            "projectedPointLinearTermJ": projected_linear_term,
            "finiteImpulseTermJ": finite_term, "predictedPairKineticLossJ": predicted_loss,
            "measuredPairKineticLossJ": measured_loss,
            "predictionResidualJ": measured_loss - predicted_loss,
            "requestedMinusPredictedLossJ": debit - predicted_loss,
            "budgetBeforeJ": event["budgetBefore"], "budgetAfterJ": event["budgetAfter"],
            "stuckBeforeS": event["stuckBefore"], "stuckAfterS": event["stuckAfter"],
        })

    affected = []
    for episode_index in sorted({row["inferredEpisode"] for row in calls}):
        key, episode = episodes[episode_index]
        selected = [row for row in calls if row["inferredEpisode"] == episode_index]
        first_cap_tick = min(row["tick"] for row in selected)
        tail = [event for event in episode if event["tick"] >= first_cap_tick]
        refund = sum(row["capOnlyRefundJ"] for row in selected)
        # A larger shadow balance cannot affect a request if the original
        # balance never limits it. This is a conditional recorded-path check,
        # not a rerun or a proof about unrecorded future contacts.
        nonbinding = all(event["regime"] == "drag" and event["budgetAfter"] > 1e-3
                         and event["stuckBefore"] == event["stuckAfter"] == 0 for event in tail)
        affected.append({
            "inferredEpisode": episode_index, "key": key, "part": episode[0]["part"],
            "firstRecordedTick": episode[0]["tick"], "firstCapTick": first_cap_tick,
            "lastRecordedTick": episode[-1]["tick"], "recordedCalls": len(episode),
            "callsFromFirstCap": len(tail), "cappedDragCalls": len(selected),
            "capOnlyRefundJ": refund,
            "minimumRecordedRemainingAfterFirstCapJ": min(event["budgetAfter"] for event in tail),
            "lastRecordedRemainingJ": episode[-1]["budgetAfter"],
            "samePathShadowRemainingJ": episode[-1]["budgetAfter"] + refund,
            "lastRecordedStuckS": episode[-1]["stuckAfter"],
            "observedBudgetAndTimerNeverBindAfterCap": nonbinding,
            "endpointScope": "Last recorded impulse, not an observed map deletion or collider separation",
        })

    after = {str(path): artifact(path) for path in watched}
    stable = before == after
    assert stable, "A watched source/result changed during derivation"
    summary = {
        "newPhysicsExecutions": 0, "newPhysicsSteps": 0,
        "recordedCenterlineCalls": len(events), "recordedCappedCalls": len(capped),
        "cappedRegimes": dict(Counter(event["regime"] for event in capped)),
        "decomposedDragCalls": len(calls), "affectedInferredEpisodes": len(affected),
        "requestedDebitJ": sum(row["requestedDebitJ"] for row in calls),
        "capOnlyRefundJ": sum(row["capOnlyRefundJ"] for row in calls),
        "allAffectedRecordedPathsBudgetNonbinding": all(row["observedBudgetAndTimerNeverBindAfterCap"] for row in affected),
        "conclusion": "Cap-only debit changes bookkeeping on these recorded paths; no resistance-duration or damage improvement is demonstrated.",
    }
    report = {
        "schemaVersion": 1, "experiment": "phase3_cut_debit_readonly_decomposition",
        "createdUTC": datetime.now(timezone.utc).isoformat(), "command": [sys.executable, *sys.argv],
        "derivationHead": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repo, text=True).strip(),
        "measurementValid": stable, "sourceStable": stable,
        "recordArtifact": before[str(record_path)], "rawArtifact": raw_artifact,
        "historicalRunArtifact": run_artifact, "historicalSourceManifest": manifest_artifact,
        "historicalSource": source, "historicalSourceActualHashes": historical_actual,
        "watchedArtifactsBefore": before, "watchedArtifactsAfter": after,
        "definitions": {
            "budget": "Eleft is the existing game resistance budget, initialized from strike energy/absorb and energyScale; not measured tissue work.",
            "identity": "requestedJ*contactSpeed - predictedPairLoss = (requestedJ-appliedJ)*contactSpeed + appliedJ*(contactSpeed-projectedSpeed) + 0.5*mobility*appliedJ^2",
            "pairLoss": "Instantaneous free-rigid-body kinetic loss from the two centerline impulses; subsequent native constraint work is excluded.",
            "capOnly": "Uses appliedJ with the old contact-speed convention. Does not replace debit with measured kinetic loss.",
            "damage": "Initial strike/applyWound precedes resistance. Later damage can differ only through subsequent motion/contact; no retrospective injury correction is inferred.",
        },
        "summary": summary, "calls": calls, "affectedEpisodes": affected,
        "limitations": [
            "Historical source and all recorded source hashes verified; not a current-runtime physics test.",
            "Same-path shadow balances are arithmetic only; no dynamics or controller replay was executed.",
            "Episodes inferred from per-key budget continuity; raw contains no explicit cutting-map lifetime IDs.",
            "Preserves the original raw and its limitations, including equipment/preparation and responsive AI differences from public play.",
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("x", encoding="utf8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"pass": stable, "out": artifact(out), **summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
