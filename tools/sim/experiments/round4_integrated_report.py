"""Derive the integration gates from archived game runs; no physics execution."""
import argparse, hashlib, json, math
from pathlib import Path
from collections import Counter

p = argparse.ArgumentParser()
p.add_argument('--base', required=True)
p.add_argument('--late')
p.add_argument('--out', required=True)
a = p.parse_args()
out = Path(a.out)
assert not out.exists()

def load(path):
    path = Path(path)
    blob = path.read_bytes()
    return json.loads(blob), {'path': str(path), 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()}

report, report_art = load(a.base)
assert report['measurementValid']
rows = {}
artifacts = [report_art]
for record in report['rows']:
    row, art = load(record['artifact']['path'])
    assert art == record['artifact']
    rows[record['key']] = row
    artifacts.append(art)
late_report = None
if a.late:
    late_report, art = load(a.late)
    assert late_report['measurementValid']
    artifacts.append(art)
    for record in late_report['rows']:
        row, art = load(record['artifact']['path'])
        assert art == record['artifact']
        rows[record['key']] = row
        artifacts.append(art)

def magnitude(v):
    return math.sqrt(sum(v[x]*v[x] for x in ['x','y','z']))

def final_state(x):
    return {k:x[k] for k in ['state','alive','armed','blood','pain','limbs']} | {
        'assist': None if not x.get('assist') else {k:x['assist'].get(k) for k in ['version','phase','owner','eligible','availability']}}

def summarize(row):
    player = [x['fighters'][0] for x in row['metrics']]
    enemy = [x['fighters'][1] for x in row['metrics']]
    candidate = [e for e in row['events'] if e['reaction'] is not None]
    post_input = [e for e in row['events'] if e['tick'] >= 1477 and e['attacker'] == 0]
    fresh = [e for e in row['entries'] if e['effective']]
    first_entry = row['firstFreshEntryTick']
    both = [e for e in candidate if first_entry is not None and e['tick'] >= first_entry]
    first_loss = next((i for i,x in enumerate(player) if not x['armed'] or not x['gripValid']), None)
    first_enemy_death = next((i for i,x in enumerate(enemy) if not x['alive']), None)
    first_injury = next((i for i,x in enumerate(player) if min(x['limbs'].values()) < 1), None)
    return {
        'steps': row['steps'], 'checks': row['checks'],
        'firstReferenceDifferenceTick': row['firstReferenceDifference'],
        'firstFreshEntryTick': first_entry,
        'effectiveFreshEntries': len(fresh),
        'entryRecords': row['entries'],
        'firstPlayerInjuryTick': first_injury,
        'firstPlayerGripOrWeaponLossTick': first_loss,
        'firstEnemyDeathTick': first_enemy_death,
        'playerStates': dict(Counter(x['state'] for x in player)),
        'playerAssistOwners': dict(Counter(x['control']['assist']['owner'] for x in player)),
        'allPlayerAliveArmedValidGrip': all(x['alive'] and x['armed'] and x['gripValid'] for x in player),
        'maxPlayerJointGapM': max(g['gapM'] for x in player for g in x['gaps']),
        'maxPlayerSwordAxialRadps': max(abs(s['axialRadps']) for x in player for s in x['spin'] if s['part'] == 'sword'),
        'cutPairs': len(row['events']),
        'playerCutPairs': sum(e['attacker'] == 0 for e in row['events']),
        'candidatePairs': len(candidate),
        'candidateAppliedToOpponentCount': sum(e['attacker'] != 0 for e in candidate),
        'candidateLiveVictimPairs': sum(e['victimAlive'] for e in candidate),
        'candidatePairsAfterEffectiveFreshEntry': len(both),
        'liveCandidatePairsAfterEffectiveFreshEntry': sum(e['victimAlive'] for e in both),
        'candidateCapCount': sum(e['reaction']['J'] < e['reaction']['requestedJ']-1e-12 for e in candidate),
        'candidatePositiveInstantEnergyCount': sum(e['analysis']['deltaKJ'] > 1e-5 for e in candidate),
        'candidatePairLinearMomentumResidualPeakNs': max((magnitude(e['analysis']['deltaP']) for e in candidate), default=None),
        'candidatePairAngularMomentumResidualPeakNms': max((magnitude(e['analysis']['deltaL']) for e in candidate), default=None),
        'playerCutPairsAfterTick1477': len(post_input),
        'livePlayerCutPairsAfterTick1477': sum(e['victimAlive'] for e in post_input),
        'scriptedRequestCount': len(row['requests']),
        'scriptedControllerPhases': dict(Counter(player[x['id']]['control']['assist']['phase'] for x in row['requests'])),
        'finalPlayer': final_state(row['finalStates'][0]), 'finalEnemy': final_state(row['finalStates'][1]),
    }

summaries = {k: summarize(v) for k,v in rows.items()}
reference_checks = {}
for key, reference_key, reference_row in [
    ('combat-legacy','fresh',None), ('touch-legacy','recovery',None),
    ('combat-centerline','p5',3), ('touch-centerline','p5',3),
]:
    ref, art = load(report['references'][reference_key]['path'])
    assert art == report['references'][reference_key]
    stored = ref['row'] if reference_row is None else ref['rows'][reference_row]
    count = 1477 if key == 'touch-centerline' else min(len(rows[key]['frames']),len(stored['frames']))
    exact = rows[key]['frames'][:count] == stored['frames'][:count]
    assert exact
    reference_checks[key] = {'reference': art, 'row': reference_row, 'exactFrames': count, 'nativeControlInputExact': exact}

comparisons = {}
for kind in ['combat','touch']:
    left, right = rows[kind+'-legacy'], rows[kind+'-centerline']
    first = lambda column: next((i for i,(x,y) in enumerate(zip(left['frames'],right['frames'])) if x[column] != y[column]),None)
    comparisons[kind] = {'firstNativeDifferenceTick': first(1), 'firstControlDifferenceTick': first(2), 'firstInputDifferenceTick': first(3),
                         'scriptedPlayerRequestsExact': left['requests'] == right['requests'],
                         'scriptedRequestCountPerRow': len(left['requests'])}

late = None
if late_report:
    row = rows['late-centerline-after-fresh']
    baseline = rows['combat-legacy']
    assert row['frames'][:1596] == baseline['frames'][:1596]
    old_event = next(e for e in baseline['events'] if e['tick'] == 1596 and e['attacker'] == 0)
    new_event = next(e for e in row['events'] if e['tick'] == 1596 and e['attacker'] == 0)
    first_input = next((i for i,(x,y) in enumerate(zip(row['frames'],baseline['frames'])) if x[3] != y[3]),None)
    late = {'activation': row['activation'], 'firstPairCheck': row['firstPairCheck'],
            'prefixFramesExact': 1596, 'firstInputDivergenceTick': first_input,
            'firstBaselinePair': old_event, 'firstCandidatePair': new_event,
            'postContactWindowTicks': [1596,1716],
            'scope': 'Late contact selection after natural injury and production fresh recovery; not combined-from-spawn or human-input efficacy. Later reactive AI divergence limits causal trajectory comparisons.'}

result = {
    'schemaVersion': 1, 'head': report['head'], 'gravityMps2': 9.81,
    'newPhysicsExecutions': report['executionCount'] + (late_report['executionCount'] if late_report else 0),
    'newSteps': report['steps'] + (late_report['steps'] if late_report else 0),
    'wallSeconds': report['wallSeconds'] + (late_report['wallSeconds'] if late_report else 0),
    'artifacts': artifacts, 'referenceChecks': reference_checks,
    'comparisons': comparisons, 'rows': summaries, 'lateInteraction': late,
    'decision': {'sourceAndMeasurementContractsPassed': True,
                 'combinedFromSpawnEffectiveInteractionExposed': False,
                 'humanTouchLiveCutAfterRecoveryExposed': False,
                 'lateInteractionExposed': bool(late and summaries['late-centerline-after-fresh']['liveCandidatePairsAfterEffectiveFreshEntry']),
                 'physicsOrNaturalnessComplete': False, 'runtimeChangedByTheseTools': False},
    'limits': [
        'From-spawn centerline has no actual fresh reentry. Conditional clear gate PASS with zero reentry does not verify effective combined action.',
        'Centerline enemy dies at1471 before human tape begins1477; its subsequent cut pairs are corpse contacts. Legacy+fresh tape has actual injury/recovery but no subsequent player cutting pairs.',
        'Both scripted tapes issue identical requests but their body, injury and reactive-AI histories already differ. Speed, survival or damage differences are not causal superiority evidence.',
        'Pair instantaneous momentum/energy observation is separate from the unchanged requested Eleft debit and stuck timer. P5 energy-to-damage completeness is not established.',
        'Headless 120Hz physics-time requests do not establish mobile wall-time/hitstop or human-naturalness equivalence. stand and valid grip are state observations, not natural movement acceptance.',
        'Longsword remains outside the fresh-stance public scope. Existing LS P5 legacy/centerline30s results are reused through source-path inspection, not claimed as newly replayed full native traces.',
    ],
    'commands': [report['command']] + ([late_report['command']] if late_report else []),
}
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'out':str(out),'decision':result['decision'],'executions':result['newPhysicsExecutions'],'steps':result['newSteps'],'referenceChecks':{k:v['exactFrames']for k,v in reference_checks.items()}},ensure_ascii=False))
