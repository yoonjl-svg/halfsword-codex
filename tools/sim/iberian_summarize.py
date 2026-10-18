"""Summarize actual injury outcomes, without combining them into a synthetic score."""
import json
from pathlib import Path

root = Path('docs/research/iberian_beat_20261018')

def summarize(rows):
    return {
        'n': len(rows),
        'deaths': sum(not r['health']['end']['alive'] for r in rows),
        'opponentDeaths': sum(not r['enemy']['end']['alive'] for r in rows),
        'durationTotal': sum(r['duration'] for r in rows),
        **{key + 'Total': sum(r['health'][key] for r in rows)
           for key in ['bloodLost', 'limbLost', 'concussion']},
        'opponentLimbLossTotal': sum(r['enemy']['limbLost'] for r in rows),
        'blockSpentTotal': sum(r['health']['stamina']['spent']['block'] for r in rows),
        'eligibleEvents': sum(len(r['beats']) for r in rows),
        'casesWithEligibleEvent': sum(bool(r['beats']) for r in rows),
        'cutCases': sum(bool(r['health']['cutHits']) for r in rows),
    }

out = {}
for path in sorted((root / 'raw').glob('*.json')):
    rows = json.loads(path.read_text())
    result = {'all': summarize(rows), 'options': {k: rows[0].get(k) for k in
              ['gain', 'recoilDegrees', 'recoilSeconds', 'recoilMode', 'yieldSeconds',
               'direction', 'impulseCap', 'speedCap']}}
    if 'weapon' in rows[0]:
        result['playerIberian'] = summarize([r for r in rows if r['weapon'] == 'zweihander'])
        result['playerAttacker'] = summarize([r for r in rows if r['weapon'] != 'zweihander'])
    out[path.name] = result
(root / 'summary.json').write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(json.dumps({'files': len(out), 'runs': sum(r['all']['n'] for r in out.values())}))
