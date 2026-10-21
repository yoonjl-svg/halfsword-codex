"""Proposal-only exact probability model. Does not change the game's sampler.

Run from any directory. Uses the separately verified 10/21 weapon roster and
checks the unmodified model against all 23 recorded exclusion scenarios.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1] / 'research/weapon_draw_update_20261021/current.json'
data = json.loads(BASE.read_text())
pool = [w for w in data['weapons'] if w['active']]
ordinary = {'common', 'rare', 'epic', 'legend'}
schools = ['german', 'italian', 'iberian', 'japanese', 'chinese']


def choices(left, school=None, school_factor=1, tier_factors=None):
    tiers = {}
    for w in left:
        tiers.setdefault(w['tier'], {}).setdefault(w['group'], []).append(w)
    weights = {t: data['tiers'][t] * (tier_factors or {}).get(t, 1) for t in tiers}
    total = sum(weights.values())
    for tier, groups in tiers.items():
        # Existing mixed-member group (Ganjiang/Moye) has the same school.
        assert all(len({w['school'] for w in members}) == 1 for members in groups.values())
        gw = {g: school_factor if members[0]['school'] == school else 1
              for g, members in groups.items()}
        for g, members in groups.items():
            p = weights[tier] / total * gw[g] / sum(gw.values()) / len(members)
            for w in members:
                yield w, p


def analyze(exclude=None, **options):
    excluded_group = next((w['group'] for w in pool if w['id'] == exclude), None)
    left = [w for w in pool if w['group'] != excluded_group]
    if len({w['group'] for w in left}) < 2:
        left = pool
    first, second, any_weapon, any_school, first_tiers = {}, {}, {}, {}, {}
    mass = 0
    for a, pa in choices(left, **options):
        first[a['id']] = first.get(a['id'], 0) + pa
        first_tiers[a['tier']] = first_tiers.get(a['tier'], 0) + pa
        for b, pb in choices([w for w in left if w['group'] != a['group']], **options):
            p = pa * pb
            mass += p
            second[b['id']] = second.get(b['id'], 0) + p
            for w in (a, b):
                any_weapon[w['id']] = any_weapon.get(w['id'], 0) + p
            for s in {a['school'], b['school']}:
                any_school[s] = any_school.get(s, 0) + p
    assert abs(mass - 1) < 1e-12
    return dict(exclude=exclude, first=first, second=second, any=any_weapon,
                first_tiers=first_tiers, schools={s: {
                    'first': sum(first.get(w['id'], 0) for w in pool if w['school'] == s),
                    'any': any_school.get(s, 0)} for s in schools + ['none']})


for previous in data['scenarios']:
    actual = analyze(previous['exclude'])
    for metric in ['first', 'second', 'any']:
        assert actual[metric].keys() == previous[metric].keys()
        assert all(abs(actual[metric][k] - v) < 1e-12 for k, v in previous[metric].items())
    for row in previous['schools']:
        assert all(abs(actual['schools'][row['id']][metric] - row[metric]) < 1e-12
                   for metric in ['first', 'any'])

result = dict(
    status='hypothetical design, not implemented or playtested',
    roster_source=data['source'],
    peer_architecture_source='81497436bf2056b6a58d09018919c6b306e994d5',
    baseline_checks=len(data['scenarios']),
    baseline=analyze(),
    school_weight_x2={s: analyze(school=s, school_factor=2) for s in schools},
    italian_after_rapier=analyze(exclude='rapier', school='italian', school_factor=2),
    ordinary_weight_x2=analyze(tier_factors={t: 2 for t in ordinary}),
    rare_plus_weight_x1_5=analyze(tier_factors={t: 1.5 for t in ordinary - {'common'}}),
)
(HERE / 'probabilities.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print('Baseline matches all 23 previously verified scenarios.')
for s in schools:
    b = result['baseline']['schools'][s]
    a = result['school_weight_x2'][s]['schools'][s]
    print(s, f"first {100*b['first']:.3f}% -> {100*a['first']:.3f}%; "
          f"one or more of two {100*b['any']:.3f}% -> {100*a['any']:.3f}%")
for name in ['baseline', 'ordinary_weight_x2', 'rare_plus_weight_x1_5']:
    t = result[name]['first_tiers']
    print(name, 'common+', sum(t[x] for x in ordinary)*100,
          'rare+', sum(t[x] for x in ordinary-{'common'})*100)
