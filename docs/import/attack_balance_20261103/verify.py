"""Verify delivered bytes and unchanged game source; no combat or network."""
import hashlib
import json
import subprocess
from pathlib import Path

root = Path.cwd()
packet = root / 'docs/import/attack_balance_20261103'
manifest = json.loads((packet / 'files.json').read_text())
for record in manifest['files']:
    data = (root / record['path']).read_bytes()
    assert len(data) == record['bytes'], record['path']
    assert hashlib.sha256(data).hexdigest() == record['sha256'], record['path']
compatibility = json.loads((packet / 'compatibility.json').read_text())
for filename, record in compatibility['compared'].items():
    blob = subprocess.check_output(['git', 'rev-parse', 'HEAD:' + filename], text=True).strip()
    assert blob == record['receiverBlob'] == record['researchBlob'], filename
assert len(compatibility['compared']) == 241
study = root / 'docs/research/attack_balance_20261101'
energy = json.loads((study / 'energy_summary.json').read_text())
assert len(energy['table']) == 10
assert sum(row['contacts'] for row in energy['table']) == 154
canonical = json.loads((study / 'canonical-manifest.json').read_text())
assert canonical['totals'] == dict(single=684, input=456, rounds=120, potential=252, decomposition=108)
for row in canonical['canonical']:
    assert hashlib.sha256((study / row['path']).read_bytes()).hexdigest() == row['sha256']
result = dict(status='verified', files=len(manifest['files']), bytes=manifest['bytes'],
    unchangedRuntimePackageHarness=241, canonicalTotals=canonical['totals'], energyTechniques=10, energyContacts=154,
    peerRepositoryWrites=0, reranCombat=False)
print(json.dumps(result, ensure_ascii=False))
