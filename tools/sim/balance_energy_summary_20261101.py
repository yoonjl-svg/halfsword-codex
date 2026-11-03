"""Summarize saved per-contact energy. Does not run or alter the game."""
import collections
import csv
import gzip
import hashlib
import io
import json
import math
import statistics
from pathlib import Path

ROOT = Path('docs/research/attack_balance_20261101')
BASE = '88a96061e8dd93e8f107b7b0df647a341e73fa5d'
CATALOG = [
    ('german', '독일', 'secret', '비기', 'mordschlag', '죽음의 일격'),
    ('italian', '이탈리아', 'secret', '비기', 'andareRisoluto', '안다레 리솔루토'),
    ('iberian', '이베리아', 'secret', '비기', 'ibSpin', '싱지르'),
    ('japanese', '일본', 'secret', '비기', 'goNoSen', '고노센'),
    ('chinese', '동방', 'secret', '비기', 'gyeoksal', '격살(4분기 합산)'),
    ('german', '독일', 'special', '특수 공격', 'duplieren', '겹치기'),
    ('italian', '이탈리아', 'special', '특수 공격', 'inquartata', '비껴서며 찌르기'),
    ('iberian', '이베리아', 'special', '특수 공격', 'redondo', '정수리 가르기'),
    ('japanese', '일본', 'special', '특수 공격', 'tsubameGaeshi', '제비 베기'),
    ('chinese', '동방', 'special', '특수 공격', 'lianchi', '날개 접기'),
]
TARGETS = {t[4] for t in CATALOG}
SOURCES = ['german/frequency24.canonical.jsonl', 'rounds/full/rounds.jsonl.gz']
contacts = []
trials = collections.Counter()
starts = collections.Counter()
expected_contacts = collections.Counter()
source_info = []
for name in SOURCES:
    path = ROOT / name
    with (gzip.open(path, 'rt') if path.suffix == '.gz' else path.open()) as stream:
        rows = [json.loads(line) for line in stream if line.strip()]
    source_info.append(dict(path=name, rows=len(rows), sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    for row in rows:
        assert row['build'] == BASE
        trials[row['school']] += 1
        for tech, value in row['byTech'].items():
            if tech in TARGETS and value.get('applicable', True):
                starts[tech] += value['started']
                expected_contacts[tech] += value['contacts']
        # Four-school researchEvents has the secret's real S.name. The shared
        # recorder's generic secret label must not be used for these rows.
        events = row['events'] if row['school'] == 'german' else row['researchEvents']
        for index, event in enumerate(events):
            if row['school'] == 'german':
                take = event.get('kind') == 'wound' and event.get('attacker') == 0 and event.get('victim') == 1
            else:
                take = event.get('kind') == 'body_contact_callback' and event.get('attacker') == 'player' and event.get('victim') == 'enemy'
            if not take or event.get('tech') not in TARGETS:
                continue
            assert isinstance(event.get('energy'), (int, float)) and math.isfinite(event['energy']) and event['energy'] >= 0
            contacts.append(dict(source=name, school=row['school'], policy=row.get('policy', row['mode']),
                opponent=row.get('opponentType', row.get('opponent')), seed=row['seed'], tech=event['tech'],
                eventIndex=index, tReference=event['tReference'], part=event.get('part'), zone=event['zone'],
                type=event['type'], energyJ=event['energy'], severity=event['severity'],
                helmet=event.get('helmet', False)))

assert sum(trials.values()) == 120 and set(trials.values()) == {24}
result = []
for school, ko, category, category_ko, tech, title in CATALOG:
    matching = [e for e in contacts if e['tech'] == tech]
    values = [e['energyJ'] for e in matching]
    assert len(values) == expected_contacts[tech] and values, tech
    lo, hi = min(matching, key=lambda e: e['energyJ']), max(matching, key=lambda e: e['energyJ'])
    row = dict(school=school, schoolKo=ko, category=category, categoryKo=category_ko, tech=tech, title=title,
        rounds=trials[school], activations=starts[tech], contacts=len(values), minimumJ=min(values),
        maximumJ=max(values), meanJ=statistics.mean(values), medianJ=statistics.median(values),
        types=dict(collections.Counter(e['type'] for e in matching)), parts=dict(collections.Counter(e['part'] for e in matching)),
        minimumEvent=lo, maximumEvent=hi)
    result.append(row)

def table(selected):
    lines = ['| 유파 | 기술 | 접촉 수 | 최소 J | 최대 J | 평균 J | 중앙값 J |',
             '|---|---|---:|---:|---:|---:|---:|']
    for row in selected:
        lines.append(f"| {row['schoolKo']} | {row['title']} | {row['contacts']} | {row['minimumJ']:.2f} | {row['maximumJ']:.2f} | {row['meanJ']:.2f} | {row['medianJ']:.2f} |")
    return '\n'.join(lines)

out = dict(base=BASE, sourceFiles=source_info, roundCounts=dict(trials),
    definition='per named technique body-contact callback; all 120 live rounds, both policies/opponents; energyJ, not HP or cast-total energy',
    selection='enhanced normal rules; player to enemy only; no preparation/basic/opponent hits; no no-contact zeros; no pilot/control/input/potential rows',
    noNewExperiments=True, includesBluntZeroWound=True, noSummationAcrossBodyContacts=True,
    limits='Observed extrema, not theoretical engine bounds. Multiple contacts per activation, repeated contact geometry, school/controller/weapon differences and small n remain.',
    table=result)
(ROOT/'energy_summary.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
for filename, rows in [('energy_contacts.csv', contacts), ('energy_summary.csv', [
    {key:row[key] for key in ['schoolKo','categoryKo','tech','title','rounds','activations','contacts','minimumJ','maximumJ','meanJ','medianJ']}
    for row in result])]:
    target=io.StringIO(newline=''); writer=csv.DictWriter(target, fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    (ROOT/filename).write_text(target.getvalue(), encoding='utf-8-sig', newline='')

text = '''# 비기·특수 공격의 관측 타격 에너지

사용자 요청에 따라 기존 실전형 대련120판을 재집계했다. 새 실험·게임 수치 변경은 없다. 유파마다24판(혼합/노림 × 압박/거리유지 ×6시드)의 **해당 기술 이름이 붙은 몸 접촉1건당 J**다. 평균과 중앙값을 모두 제공하며, 표의 소수 둘째 자리까지 반올림했다.

비기:

'''+table([r for r in result if r['category']=='secret'])+'''

특수 공격:

'''+table([r for r in result if r['category']=='special'])+'''

## 집계 기준

- J는 게임의 충돌 에너지이며 HP 피해나 상처 심각도의 단위가 아니다. 무상처 둔타도 포함한다. 실제 상처·의식·사지·방어구·무장해제와 함께 해석한다.
- 헛침은 에너지 표본에0으로 넣지 않았다. 한 번 실행 중 여러 부위가 닿으면 접촉 여러 건이다. 접촉별 J를 더해 공격 한 번의 물리적 총에너지로 부르지 않는다. 실행 수와 부위·타격 종류는 energy_summary.json, 접촉 전수는 energy_contacts.csv에 있다.
- 준비 베기·보통 공격·상대의 공격·대조군·파일럿·입력내성·정적 잠재 시험은 제외했다. 독일은 events/wound, 다른4유파는 실제 비기 S.name을 기록한 researchEvents/body_contact_callback을 사용했다. 기술별 byTech.contacts와 전수 일치했다.
- 격살은 실제 대련의4분기가 섞인 분포다. 갈래별 잠재 위력 표의 균등 분포나 특정 어거의 위력을 뜻하지 않는다.
- 독일과 다른4유파는 입력 운전기/시드 집합이 다르고 대표 무기도 다르다. 순수 기술 배율 비교가 아니다. 일부 기술은 접촉5건뿐이다. 최솟값·최댓값은 이번 관측 범위이며 시스템상 가능한 절대 상하한이 아니다.
- 앞서 보고한 인콰르타타58.47J는 거리 통제 단발의 보통 거리6접촉 평균이다. 이 표는 움직이는 상대와의 대련13접촉이므로 분모와 조건이 다르다.

정수리 가르기4965.25J·인콰르타타2257.42J·겹치기1470.57J 등 큰 값은 삭제하지 않았다. 평균과 중앙값 차이가 크므로 전형적인 손맛/위력은 중앙값을 함께 보고, 높은 값은 원본의 시드·시각·부위·타격 종류를 별도 조사해야 한다. 이 표 자체로 수치 상향/하향을 결정하지 않는다.

## 재현·원본

`python3 tools/sim/balance_energy_summary_20261101.py`는 저장 원본만 읽어 Markdown/CSV/JSON을 생성한다. 두 원본의 SHA256·표본수와 각 행의 최소/최대 사건을 energy_summary.json에 보존했다. energy_summary.csv는 표, energy_contacts.csv는 필터링한 접촉 전수다. 피해는 합산하지 않았고 원본 JSONL은 수정하지 않았다.
'''
(ROOT/'ENERGY_TABLE.md').write_text(text)
print(table([r for r in result if r['category']=='secret']))
print(table([r for r in result if r['category']=='special']))
print('Validated:', sum(trials.values()), 'rounds;', len(contacts), 'technique contacts; byTech counters exact')
