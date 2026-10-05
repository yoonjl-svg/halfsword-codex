"""Derive one recovery comparison; never execute physics or modify the raw trace."""
import argparse, hashlib, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--raw', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
raw = Path(a.raw); blob = raw.read_bytes(); d = json.loads(blob)
assert d['measurementValid'] and d['checks']['prefixExact']
out = Path(a.out); assert not out.exists()
entry = d['protocol']['entryTick']; end = d['protocol']['endTick']
b, c = d['baseline'], d['row']
first_pin = c['pinObservations'][0]
old = next(x['fighters'][0]['gait']['legs']['B'] for x in b['supportWindows'] if x['tick'] == entry)
actual = next(x for x in first_pin['applied'] if x['foot'] == 'B' and x['method'] == 'addForceAtPoint')

def selected_frame(row):
    f = next(x['fighters'][0] for x in row['window'] if x['tick'] == entry)
    return {'foot': [{k: s[k] for k in ['part', 'heightM', 'speedMps', 'omegaRadps']} for s in f['spin'] if s['part'].startswith('foot')],
            'maxJointGapM': max(j['gapM'] for j in f['gaps']), 'pelvisHeightM': f['pelvisHeightM'], 'chestTiltRad': f['chestTiltRad'], 'control': f['control']}

def summarize(row):
    fs = [x['fighters'][0] for x in row['metrics'] if entry <= x['tick'] <= end]
    return {'sampleCount': len(fs), 'maxJointGapM': max(f['maxJoint']['gapM'] for f in fs),
            'maxGripGapM': max(f['gripGap']['gapM'] for f in fs),
            'maxLimbAxialRadps': max(abs(f['maxLimbAxial']['axialRadps']) for f in fs),
            'maxBodyOmegaRadps': max(f['maxOmega']['omegaRadps'] for f in fs),
            'maxChestTiltRad': max(f['chestTiltRad'] for f in fs),
            'minimumPelvisHeightM': min(f['pelvisHeightM'] for f in fs),
            'maxSwordSpeedMps': max(f['sword']['speedMps'] for f in fs),
            'allAliveArmedGripValid': all(f['alive'] and f['armed'] and f['gripValid'] for f in fs),
            'states': sorted(set(f['state'] for f in fs)), 'finalLimbs': fs[-1]['limbs']}

s = {'schemaVersion': 1, 'raw': {'path': str(raw), 'bytes': len(blob), 'sha256': hashlib.sha256(blob).hexdigest()},
     'sourceCommit': d['head'], 'measurementValid': d['measurementValid'], 'effectAccepted': False,
     'executionCount': 1, 'executedSteps': len(c['frames']), 'wallSeconds': d['wallSeconds'],
     'checks': d['checks'], 'firstNativeControlDifferenceTick': d['firstDifferenceTick'],
     'firstPlayerOrEnemyInputDifferenceTick': c['firstInputDifferenceTick'],
     'sameInputPostInterventionTicks': [entry, c['firstInputDifferenceTick'] - 1],
     'initialStancePolicy': 'Initial enter is untouched; configure wrapper at creation and clear only restarted stance. Undefined initial Nf remains undefined until ordinary updates.',
     'firstBackFootPin': {
         'baseline': {'currentScaledN': old['N'], 'filteredNf': old['Nf'], 'storedPreClampRequestN': old['pinF'], 'storedClampLimitN': old['pinLim'],
                      'computedForceMagnitudeN': min(old['pinF'], old['pinLim']),
                      'evidenceType': 'Magnitude inferred from archived request/limit and unchanged clamp source, not an observed legacy force call; no baseline force vector exists.'},
         'candidate': {'currentScaledN': first_pin['after']['legs']['B']['N'], 'filteredNf': first_pin['after']['legs']['B']['Nf'],
                       'storedPreClampRequestN': first_pin['after']['legs']['B']['pinF'], 'storedClampLimitN': first_pin['after']['legs']['B']['pinLim'],
                       'observedActualForce': actual, 'evidenceType': 'Actual addForceAtPoint argument captured inside pinFeet.'},
         'contactBefore': {k: {n: v[n] for n in ['hasSupport', 'touchingEnvironment', 'rawNormalForceN']} for k, v in first_pin['contactsBefore']['groups'].items()},
         'frontFootActualPinCalls': len([x for x in first_pin['applied'] if x['foot'] == 'F']),
         'note': 'Front sole-center height gate skips pin despite an engine contact elsewhere on the foot. Cached front pinF/pinLim are not applied forces.'},
     'firstFrame': {'baseline': selected_frame(b), 'candidate': selected_frame(c)},
     'postEntryTwoSecondObservation': {'baseline': summarize(b), 'candidate': summarize(c),
                                    'causalScope': 'Reactive input differs from1479; later peak differences are descriptive, not isolated efficacy.'},
     'decision': 'Existing Nf lifecycle correction works on this v2 actual off-arm-injury recovery. Play benefit remains unestablished; retain research, no new v2 publication or ordinary promotion.',
     'limitations': ['Foot speed increase alone is neither a regression nor improvement: releasing historical friction permits movement. Need current contact slip, body/joint response and deliberate continuous action.',
                     'Entry pain0.9673 makes assistance availability0; no deliberate recut or severe main-arm injury screened.',
                     'No observed new loss of grip or refall in this short trace; not proof of human-natural recovery.',
                     'A state label does not establish ground-supported weight transfer. Legacy direct pelvis/upright support remains.'],
     'nextGate': {'scope': 'One intentional release/recut on same real-injury boundary; no gain or seed sweep.',
                  'prefix': 'Same original AI2 and current v2 through1476. From1477 both A/B use the same scripted player input; disable only player AI2 and retain ordinary opponent/combat/injury.',
                  'input': '1477–1620: no movement, heldfalse, activefalse, zero requested pad delta; do not reset current pad or body. 1621–1650: heldtrue, active true, delta(+0.40,-0.70)/30 per step (existing P4 recut stroke). 1651–1686: heldtrue, zero delta;1687–1746: heldfalse, zero delta. Record every request through recordSwordsmanshipInput.',
                  'timingEvidence': 'Existing A/B tick1621 has pain0.247324 and v2 availability0.811035; the new controlled-input fixture must measure these again without forcing pain/health/state.',
                  'acceptance': 'Verify exact pre1477 native/control/input and identical new requested deltas; inspect actual contact slip, grip/joint response, release/next-cut response and actual work. No new unnatural joint/foot launch or unsupported refall; do not optimize simply for lower velocity.',
                  'publication': 'Separate mobile view/input gate after the physics question; not authorized by this trace alone.'}}
out.write_text(json.dumps(s, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'summary': str(out), 'decision': s['decision'], 'rawSHA256': s['raw']['sha256']}, ensure_ascii=False))
