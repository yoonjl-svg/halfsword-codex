"""Read existing v2 attack recordings; never advances physics or changes controls.

python3 tools/sim/experiments/v2_weight_work_derive.py --raw-root /PATH/TO/swordsmanship-power-20261005 --out /FRESH/result.json
Raw hashes are checked against the committed original experiment manifest.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--raw-root', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
assert not args.out.exists(), 'Use a fresh output'
repo = Path(__file__).resolve().parents[3]
manifest = json.loads((repo / 'docs/strike/swordsmanship_power_20261005.json').read_text())
expected = {r['path']: r for r in manifest['artifacts']}
sha = lambda data: hashlib.sha256(data).hexdigest()
rows, sources = [], []
for name, weapon in [('matched-r2-current06.json', 'longsword'), ('all-melee-r2-39.json', 'zweihander')]:
    raw = (args.raw_root / name).read_bytes()
    assert len(raw) == expected[name]['bytes'] and sha(raw) == expected[name]['sha256']
    data = json.loads(raw)
    assert data['sourceStable'] and data['executionValid'] and data['dt'] > 0
    sources.append({'path': str(args.raw_root / name), 'bytes': len(raw), 'sha256': sha(raw),
                    'sourceCommit': data['sourceCommit'], 'dt': data['dt']})
    for row in data['rows']:
        if row['weapon'] != weapon or row['mode'] != 'current':
            continue
        assert row['freezeCalls'] == 0 and all(row['checks'].values())
        previous = row['prefixBoundary']['actual']['sword']
        phases = {}
        for frame in row['frames']:
            sword = frame['actual']['sword']
            assert sword['mass'] == previous['mass'] and math.isfinite(sword['worldCOM']['y'])
            bucket = phases.setdefault(frame['phase'], {'steps': 0, 'gravityWorkJ': 0,
                'explicitSwordTorqueWorkApproxJ': 0, 'kineticChangeJ': 0,
                'comYStartM': previous['worldCOM']['y'], 'peakTipSpeedMps': 0})
            bucket['steps'] += 1
            # Constant g and sword mass; exact potential difference at stored endpoints.
            bucket['gravityWorkJ'] += sword['mass'] * 9.81 * (previous['worldCOM']['y'] - sword['worldCOM']['y'])
            bucket['kineticChangeJ'] += sword['kineticTotalJ'] - previous['kineticTotalJ']
            for call in frame['swordTorqueCalls']:
                power = sum(t*w for t, w in zip(call['torque'], call['omegaAtCall']))
                assert math.isclose(power, call['atCallPowerW'], rel_tol=1e-12, abs_tol=1e-12)
                bucket['explicitSwordTorqueWorkApproxJ'] += power * data['dt']
            bucket['comYEndM'] = sword['worldCOM']['y']
            bucket['peakTipSpeedMps'] = max(bucket['peakTipSpeedMps'], math.hypot(*frame['actual']['tipVelocity']))
            previous = sword
        rows.append({'weapon': weapon, 'attack': row['attack'], 'massKg': previous['mass'],
            'raw': name, 'controllerVersionLabelInRaw': row['frames'][0]['control']['assist']['version'],
            'mode': row['mode'], 'freezeCalls': row['freezeCalls'], 'phases': phases})
assert len(rows) == 6
result = {'schemaVersion': 1, 'newPhysicsRuns': 0, 'sources': sources, 'rows': rows,
    'definitions': {
        'gravity': 'm*9.81*(COM_y_before-COM_y_after); constant-mass sword potential difference. Original frozen config/world use gravity -9.81 and default sword gravity scale 1.',
        'explicitTorque': 'Sum of recorded sword addTorque dot angular velocity at call, times dt. Left-endpoint work approximation; includes the recorded combined controller torque, not isolated gravity compensation.',
        'limits': 'Not a complete energy balance: hand forces, constraints, native motors, damping and contact work are excluded. Different weapon profiles and poses prevent mass-only causal comparisons. No human feel, new gameplay or force-transfer acceptance.'}}
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'newPhysicsRuns': 0, 'rows': len(rows), 'vertical': [r for r in rows if r['attack'] == 'vertical']}, ensure_ascii=False))
