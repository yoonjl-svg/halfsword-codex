#!/usr/bin/env python3
"""Summarize saved runtime evidence without rerunning or changing the game."""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()


def measure(frames, dt):
    if not frames:
        return {"frames": 0, "seconds": 0}
    points = [point for frame in frames for manifold in frame["support"] for point in manifold["points"]]
    near_points = [point for frame in frames for manifold in frame["support"]
                   if manifold["normalImpulseNs"] > 1e-6 for point in manifold["points"]
                   if point["distanceM"] <= .01]
    no_points = sum(not any(manifold["points"] for manifold in frame["support"]) for frame in frames)
    no_near_points = sum(not any(manifold["normalImpulseNs"] > 1e-6 and
                                any(point["distanceM"] <= .01 for point in manifold["points"])
                                for manifold in frame["support"]) for frame in frames)
    mean = lambda key: sum(frame[key] for frame in frames) / len(frames)
    peak = lambda key: max(frame[key] for frame in frames)
    return {
        "frames": len(frames), "seconds": len(frames) * dt,
        "handMeanM": mean("handErrorM"), "handMaxM": peak("handErrorM"),
        "ownAimMeanRad": mean("ownAimErrorRad"), "rawAimMeanRad": mean("externalRawAimErrorRad"),
        "omegaMaxRadps": peak("swordOmegaRadps"),
        "totalRotationIntegralRad": sum(frame["swordOmegaRadps"] * dt for frame in frames),
        "twistIntegralRad": sum(frame["swordTwistRadps"] * dt for frame in frames),
        "swordKMaxJ": peak("swordKJ"), "bodyAndSwordKMaxJ": peak("bodyAndSwordKJ"),
        "gapMaxM": peak("maxGapM"),
        "contactPointHorizontalMaxMps": max((point["horizontalMps"] for point in points), default=None),
        "positiveImpulseNearPointHorizontalMaxMps": max((point["horizontalMps"] for point in near_points), default=None),
        "pelvisUpwardMaxMps": max(frame["pelvisVelocityMps"][1] for frame in frames),
        "pelvisHeightMaxM": max(frame["pelvisM"][1] for frame in frames),
        "contactPointCount": len(points), "noFootSolverPointFrames": no_points,
        "positiveImpulseNearPointCount": len(near_points), "noPositiveImpulseNearPointFrames": no_near_points,
        "holdReleaseFrames": sum(frame["phase"] in ["hold", "release"] for frame in frames),
        "getupFrames": sum(frame["health"]["state"] == "getup" for frame in frames),
        "woundedGetupFrames": sum(frame["health"]["state"] == "getup" and frame["health"]["armHealth"] < 1 for frame in frames),
    }


def event_time(row, key):
    return row[key]["timeS"] if row[key] else math.inf


def event_brief(event):
    if not event:
        return None
    return {"timeS": event["afterStepTimeS"], "part": event["part"],
            "severity": event["result"].get("severity"),
            "armHealthBefore": event["before"]["armHealth"] if event["before"] else None,
            "armHealthAfter": event["after"]["armHealth"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.exists():
        parser.error("Choose a new --out path; evidence is never overwritten")
    raw_bytes = args.raw.read_bytes()
    raw = json.loads(raw_bytes)
    dt = raw["schedule"][1]["timeS"] - raw["schedule"][0]["timeS"]
    assert dt > 0 and all(abs(request["timeS"] - index * dt) < 1e-10
                          for index, request in enumerate(raw["schedule"]))
    assert raw["sourceStable"] and raw["sourceCommit"] == raw["sourceCommitAfter"]
    assert raw["sourceBefore"] == raw["sourceAfter"] and raw["measurementValid"] and raw["error"] is None
    root = Path(__file__).resolve().parents[3]
    archive_checks, installed_checks = {}, {}
    for relative, expected in raw["sourceBefore"].items():
        if relative.startswith("node_modules/"):
            installed_checks[relative] = sha((root / relative).read_bytes()) == expected
        else:
            archived = subprocess.run(["git", "show", raw["sourceCommit"] + ":" + relative],
                                      cwd=root, check=True, capture_output=True).stdout
            archive_checks[relative] = sha(archived) == expected
    assert all(archive_checks.values()) and all(installed_checks.values())
    lock = json.loads(subprocess.run(["git", "show", raw["sourceCommit"] + ":package-lock.json"],
                                    cwd=root, check=True, capture_output=True).stdout)
    engine_version = lock["packages"]["node_modules/@dimforge/rapier3d-compat"]["version"]
    trace_checks = []
    for row in raw["rows"]:
        for field, digest in [("nativeSha256", "nativeTraceSha256"),
                              ("physicalControllerSha256", "physicalControllerTraceSha256"),
                              ("fullControllerSha256", "fullControllerTraceSha256")]:
            assert sha("".join(frame[field] for frame in row["traceFrames"]).encode()) == row[digest]
        assert row["traceFrames"][-1]["appliedInputPrefixSha256"] == row["appliedInputSha256"]
        assert row["finite"] and len(row["traceFrames"]) == round(row["durationS"] / dt)
        trace_checks.append({"weapon": row["weapon"], "seed": row["seed"], "mode": row["mode"],
                             "observed": row["observed"], "rebuiltTraceDigestsExact": True})
    observed = [row for row in raw["rows"] if row["observed"]]
    pairs = []
    for check in raw["pairedChecks"]:
        a, b = [next(row for row in observed if row["weapon"] == check["weapon"] and
                     row["seed"] == check["seed"] and row["mode"] == mode)
                for mode in ["legacy", "independent"]]
        shared = list(zip(a["traceFrames"], b["traceFrames"]))
        assert len(shared) == min(len(a["traceFrames"]), len(b["traceFrames"]))
        assert all(left["tick"] == right["tick"] for left, right in shared)
        assert a["first"]["nativeSha256"] == b["first"]["nativeSha256"]
        assert a["first"]["physicalControllerSha256"] == b["first"]["physicalControllerSha256"]
        assert a["requestedScheduleSha256"] == b["requestedScheduleSha256"] == raw["requestedScheduleSha256"]
        assert all(left["requestSha256"] == right["requestSha256"] == left["plannedRequestSha256"] ==
                   right["plannedRequestSha256"] for left, right in shared)
        start = b["firstExtraArmActivation"]["timeS"] if b["firstExtraArmActivation"] else None
        prefix = [(left, right) for left, right in shared if start is None or left["timeS"] < start - 1e-10]
        assert all(all(left[field] == right[field] for field in
                       ["nativeSha256", "physicalControllerSha256", "eventsPrefixSha256"])
                   for left, right in prefix)
        contact_end = next((left["timeS"] for left, right in shared if
                            left["eventsPrefixSha256"] != right["eventsPrefixSha256"]), math.inf)
        state_end = next((left["timeS"] for left, right in shared if
                          left["playerStateBefore"] != right["playerStateBefore"] or
                          left["playerStateAfter"] != right["playerStateAfter"]), math.inf)
        common_end = min(a["durationS"], b["durationS"], event_time(a, "firstDeath"), event_time(b, "firstDeath"),
                         event_time(a, "firstDrop"), event_time(b, "firstDrop"))
        effect_end = min(common_end, contact_end, state_end)
        assert start == check["commonEffectWindowStartS"]
        assert abs(common_end - check["commonAliveArmedWindowEndS"]) < 1e-10
        assert abs(effect_end - check["commonEffectWindowEndS"]) < 1e-10
        assert len(prefix) == check["beforeEffectPrefixTicks"]
        scopes = {}
        for name in ["commonEffect", "commonAliveArmedPostEffectRegression", "zeroDeltaHoldReleaseRegression", "fullObservedRun"]:
            scopes[name] = {}
            for row in [a, b]:
                if name == "fullObservedRun":
                    frames = row["metrics"]
                elif start is None:
                    frames = []
                else:
                    end = effect_end if name == "commonEffect" else common_end
                    frames = [frame for frame in row["metrics"] if start - 1e-10 <= frame["timeS"] < end - 1e-10]
                    if name == "zeroDeltaHoldReleaseRegression":
                        frames = [frame for frame in frames if frame["phase"] in ["hold", "release"]]
                        assert all(raw["schedule"][frame["tick"]]["deltaM"] == [0, 0] for frame in frames)
                scopes[name][row["mode"]] = measure(frames, dt)
        pairs.append({"weapon": check["weapon"], "seed": check["seed"], "startS": start,
                      "commonEffectEndS": effect_end, "commonAliveArmedEndS": common_end,
                      "firstUnequalRecordedContactS": None if math.isinf(contact_end) else contact_end,
                      "firstUnequalStateS": None if math.isinf(state_end) else state_end,
                      "preEffectPrefixSteps": len(prefix), "preEffectNativePhysicalControllerEventsExact": True,
                      "fullNativeTraceExact": a["nativeTraceSha256"] == b["nativeTraceSha256"],
                      "fullModeExcludedControllerTraceExact": a["physicalControllerTraceSha256"] == b["physicalControllerTraceSha256"],
                      "actualPadCommonPrefixExact": all(left["appliedOffsetM"] == right["appliedOffsetM"] for left, right in shared),
                      "firstArmWounds": {"legacy": event_brief(a["firstArmWound"]), "independent": event_brief(b["firstArmWound"])},
                      "deathOrDrop": {mode: {"death": row["firstDeath"], "drop": row["firstDrop"]}
                                      for mode, row in [("legacy", a), ("independent", b)]},
                      "coverage": check["coverage"], "scopes": scopes})
    observers = []
    for repeat in [row for row in raw["rows"] if not row["observed"]]:
        original = next(row for row in observed if all(row[key] == repeat[key] for key in ["weapon", "seed", "mode"]))
        fields = ["nativeTraceSha256", "fullControllerTraceSha256", "physicalControllerTraceSha256",
                  "requestedScheduleSha256", "appliedInputSha256", "eventsSha256", "durationS"]
        assert all(original[key] == repeat[key] for key in fields) and original["events"] == repeat["events"]
        observers.append({"weapon": repeat["weapon"], "seed": repeat["seed"], "mode": repeat["mode"],
                          "nativeControllerInputEventsDurationExact": True,
                          "scope": "Basic hash/event recorder stays on; optional post-step numeric/helper/contact reads are off."})
    assert len(observers) == 2
    result = {"schemaVersion": 1, "probe": raw["probe"], "sourceCommit": raw["sourceCommit"],
              "summaryTool": "tools/sim/experiments/summarize_arm_recovery_from_spawn.py",
              "summaryToolSha256": sha(Path(__file__).read_bytes()),
              "summaryCommand": ["python", "tools/sim/experiments/summarize_arm_recovery_from_spawn.py",
                                 "--raw=" + str(args.raw), "--out=" + str(args.out)],
              "rawEvidence": {"path": str(args.raw.resolve()), "bytes": len(raw_bytes), "sha256": sha(raw_bytes)},
              "sourceArchiveAllFilesExact": all(archive_checks.values()), "sourceArchiveFiles": len(archive_checks),
              "installedEngineFilesExact": installed_checks, "sourceBefore": raw["sourceBefore"],
              "sourceStable": raw["sourceStable"], "measurementValid": raw["measurementValid"],
              "executionCount": raw["executionCount"], "runWallSeconds": raw["wallSeconds"],
              "command": raw["command"], "timestepSeconds": dt,
              "runtimeEngine": {"name": "@dimforge/rapier3d-compat", "version": engine_version,
                                "source": "Published npm game engine from harness_m; imported research sidecar was not used."},
              "requestedScheduleSha256": raw["requestedScheduleSha256"], "protocol": raw["protocol"],
              "traceChecks": trace_checks, "observerChecks": observers, "pairs": pairs,
              "definitions": {
                  "commonEffect": "Metric samples [first extra activation, first unequal recorded contact/state or shared death/drop/horizon). Callback equality does not establish identical persistent contacts. Frame-count seconds are n*DT; post-step sample intervals have one-tick boundary resolution.",
                  "commonAliveArmedPostEffectRegression": "Samples [first extra activation, shared alive+armed end). Same requests, potentially different reactive AI/contact/wound histories; not same-injury efficacy.",
                  "zeroDeltaHoldReleaseRegression": "Hold/release samples within that common post-effect regression window; requested delta is zero. Existing thrust/body motion/heading/contacts can continue. This is not isolated braking or a physically stopped sword.",
                  "fullObservedRun": "Whole saved run; separate from causal/shared post-effect windows and unsuitable for uncensored comparative controllability after death/drop.",
                  "handMeanM": "Actual hand versus current runtime handTarget; not joint separation and not independent external input intent.",
                  "ownAimMeanRad": "Actual sword axis versus current runtime filtered aim.",
                  "rawAimMeanRad": "Actual axis versus fixed external input schedule through existing raw direction/yaw mapping; goal differs from current filtered aim.",
                  "totalRotationIntegralRad": "Integral of absolute sword angular velocity magnitude, sum(|omega|*DT); not axis travel or forearm-relative rotation.",
                  "twistIntegralRad": "Integral of absolute world angular velocity projected on current sword axis; not relative wrist rotation.",
                  "contactPointHorizontalMaxMps": "All fixed-ground solver points' horizontal body point velocity, last solver substep; not loaded slip, COP, a complete contact impulse history or force capacity.",
                  "positiveImpulseNearPointHorizontalMaxMps": "Postprocessing subset: manifold summed normal impulse >1e-6 Ns and point solver distance <=.01 m. Not individual point load proof. Thresholds are report filters only, not hidden runtime caps.",
                  "K": "State kinetic energy, not measured muscle/native motor/constraint work."},
              "decision": {"publicUrl": "held", "publicCTA": "held", "ordinaryDefault": "unchanged",
                           "failedSupportAndCuttingCandidates": "remain withdrawn; not reapplied or recommended",
                           "reason": "No shared causal wounded-main-arm recovery exposure; short causal windows and mixed contact-divergent hold/release regressions. Numerical execution validity is not efficacy or human acceptance."},
              "limitations": ["Four weapon/seed conditions plus paired modes and two observer repeats, not ten independent efficacy samples.",
                              "Two seeds/no wall/gap1.85/correction0 are a bounded selection, not broad gameplay acceptance.",
                              "Fixed physics-clock 120 Hz; no rendering, browser hit-stop/time dilation/rAF cadence or real phone input/feel.",
                              "No native-sidecar engine substitution; separate 33-fixture sidecar calibration is a different task."]}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x") as destination:
        json.dump(result, destination, indent=2, ensure_ascii=False, allow_nan=False)
        destination.write("\n")
    print(json.dumps({"output": str(args.out), "measurementValid": result["measurementValid"],
                      "executionCount": result["executionCount"], "sourceArchiveAllFilesExact": result["sourceArchiveAllFilesExact"],
                      "observerRepeatsExact": len(observers), "rawSha256": result["rawEvidence"]["sha256"],
                      "pairs": [{"weapon": pair["weapon"], "seed": pair["seed"], "coverage": pair["coverage"],
                                 "causalFrames": pair["scopes"]["commonEffect"]["legacy"]["frames"],
                                 "zeroDeltaHoldReleaseFrames": pair["scopes"]["zeroDeltaHoldReleaseRegression"]["legacy"]["frames"]}
                                for pair in pairs]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
