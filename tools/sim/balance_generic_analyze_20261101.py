"""Derive reports from saved research rows; never execute gameplay."""
import gzip, hashlib, json, statistics
from pathlib import Path
from collections import defaultdict

ROOT=Path('docs/research/attack_balance_20261101/generic')
def read(p):
    if not p.exists(): p=Path(str(p)+'.gz')
    with (gzip.open(p,'rt') if p.suffix=='.gz' else p.open()) as f:
        return [json.loads(l) for l in f if l.strip()]
def selected(sub, mode, exclude=()):
    return [r for r in read(ROOT/sub/(mode+'.jsonl')) if r['tech'] not in exclude]
def mean(a): return statistics.mean(a) if a else None
def stats(a):
    return dict(n=len(a),mean=mean(a),median=statistics.median(a) if a else None,
                sd=statistics.stdev(a) if len(a)>1 else None,min=min(a) if a else None,max=max(a) if a else None)
def phase_window(r, anchor, seconds):
    if anchor is None: return None
    end=anchor+seconds*1.1
    es=[e for e in r['events'] if e['kind']=='contact' and anchor<=e['t']<=end]
    return dict(requestedReferenceSeconds=seconds,observedReferenceSeconds=max(0,min(seconds,(r['observed']['gameSeconds']-anchor)/1.1)),
                complete=r['observed']['gameSeconds']>=end,
                dealt=sum(e['severity'] or 0 for e in es if e['attacker']=='player'),
                received=sum(e['severity'] or 0 for e in es if e['victim']=='player'))

single=(selected('canonical-a','single')+selected('canonical-b','single',('lianchi',))+
        selected('canonical-tsubame','single')+selected('canonical-lianchi-real','single'))
inputs=(selected('a','input')+selected('b','input',('lianchi',))+selected('canonical-lianchi-real','input'))
assert len(single)==288, ('incomplete singles',len(single))
assert len(inputs)==192, ('incomplete inputs',len(inputs))
allrows=single+inputs
keys=[(r['tech'],r['mode'],r['range'],r['seed'],r['variant'],r['inputProfile']) for r in allrows]
assert len(keys)==len(set(keys)), 'duplicate case'
assert all(r['humanInput'] and r['gear']['maxStamina']==100 and r['gear']['bonus']==0 and not r['gear']['infinite'] for r in allrows)
assert all(r['config']['before']==r['config']['after'] for r in allrows)
assert all(0<=e['clientX']<=844 and 0<=e['clientY']<=390 for r in allrows for e in r['inputEvents'])
pairs=defaultdict(dict)
for r in single:pairs[(r['tech'],r['range'],r['seed'])][r['variant']]=r
assert len(pairs)==144
pair_rows=[]
for key,pair in pairs.items():
    on,off=pair['on'],pair['off']
    assert on['commandHash']==off['commandHash'],key
    assert on['initial']==off['initial'],key
    a,b=on['inputEvents'],off['inputEvents']
    assert a[:min(len(a),len(b))]==b[:min(len(a),len(b))], ('input prefix mismatch',key)
    assert off['control']=='exact enhanced-input replay',key
    anchor=on['timeline']['firstStart']
    pair_rows.append(dict(tech=key[0],range=key[1],seed=key[2],commandHash=on['commandHash'],inputPrefixIdentical=True,
       initialIdentical=True,onStarted=on['started'],dealtDifference=on['inflicted']['severity']-off['inflicted']['severity'],
       receivedDifference=on['received']['severity']-off['received']['severity'],
       replayComplete=off['replayComplete'],onInputEvents=len(a),offInputEvents=len(b),
       windows={str(s):dict(on=phase_window(on,anchor,s),off=phase_window(off,anchor,s)) for s in (1,5)}))

grouped=defaultdict(list)
for r in allrows:
    if r['variant']=='on':grouped[(r['mode'],r['tech'],r['range'] if r['mode']=='single' else r['inputProfile'])].append(r)
out={}
for key,rs in grouped.items():
    ps=[p for p in pair_rows if (p['tech'],p['range'])==(key[1],key[2])] if key[0]=='single' else []
    out['/'.join(key)]=dict(n=len(rs),attempted=sum(r['attempted'] for r in rs),accepted=sum(r['accepted'] for r in rs),
       startedCases=sum(r['started']>0 for r in rs),targetContactCases=sum(bool(r['targetContacts']) for r in rs),
       targetWoundCases=sum(r['targetSeverity']>0 for r in rs),targetSeverity=stats([r['targetSeverity'] for r in rs]),
       totalDealt=stats([r['inflicted']['severity'] for r in rs]),totalReceived=stats([r['received']['severity'] for r in rs]),
       preparationSeverity=stats([r['preparationSeverity'] for r in rs]),staminaSpent=stats([r['stamina']['totalSpent'] for r in rs]),
       staminaByKind={k:stats([r['stamina']['spent'].get(k,0) for r in rs]) for k in sorted({k for r in rs for k in r['stamina']['spent']})},
       targetParts=dict((k,sum(e['part']==k for r in rs for e in r['targetContacts'])) for k in sorted({e['part'] for r in rs for e in r['targetContacts'] if e.get('part')})),
       opponentTerminations=sum(r['inflicted']['dead'] for r in rs),opponentKO=sum(r['inflicted']['dead'] and r['inflicted']['cause']=='기절' for r in rs),
       causes=dict((k,sum(r['inflicted']['cause']==k for r in rs)) for k in sorted({r['inflicted']['cause'] for r in rs if r['inflicted']['cause']})),
       pairedDealtDifference=stats([p['dealtDifference'] for p in ps]),pairedReceivedDifference=stats([p['receivedDifference'] for p in ps]))
validation=dict(base='88a96061e8dd93e8f107b7b0df647a341e73fa5d',singleRows=288,inputRows=192,pairs=144,
  duplicateCases=0,allInitialStatesIdentical=True,allCommandPlansIdentical=True,allInputPrefixesIdentical=True,
  allWithinViewport=True,allHumanStaminaRules=True,allConfigUnchanged=True,
  caveats=['tsubame normal fixtures never create the preceding missed attack; no power estimate',
           'redondo holdInput and all movement remain normalized command proxies, not DOM events',
           '8 exact input runs contain repeated deterministic speeds; not 8 independent human observations',
           'real lianchi pointer tap crosses physical frames; earlier logical tap runs excluded',
           'off observation may continue after on termination; use censored equal windows before total differences'])
(ROOT/'analysis.json').write_text(json.dumps(dict(validation=validation,groups=out,pairs=pair_rows),ensure_ascii=False,indent=2)+'\n')
(ROOT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
lines=['# 8계열 단발·입력 시험','', '정본은 288단발(144짝)·192입력이다. 정상 상처·사람 회복25·최대100을 유지했다. 모든 짝의 초기 상태·hold/tap/pointer/stick 명령 해시·실제 포인터 공통 구간이 일치한다. 이전 a/b single은 진단용이며 정본과 합산하지 않는다.', '',
 '|기술|거리|시도/실행/목표접촉/상처 판(각6)|목표 심각도 평균|준비·그외 피해 평균|켬-끔 전체 준 피해 차이|관측전체 기력(이동포함)|',
 '|---|---|---:|---:|---:|---:|---:|']
for key,v in out.items():
    mode,tech,level=key.split('/')
    if mode!='single':continue
    lines.append(f"|{tech}|{level}|{v['attempted']}/{v['startedCases']}/{v['targetContactCases']}/{v['targetWoundCases']}|{v['targetSeverity']['mean']:.4f}|{v['preparationSeverity']['mean']:.4f}|{v['pairedDealtDifference']['mean']:.4f}|{v['staminaSpent']['mean']:.2f}|")
lines+=['','|기술|정확 실행/접촉|작은 흔들림 실행/접촉|큰 흔들림 실행/접촉|','|---|---:|---:|---:|']
for tech in sorted({r['tech'] for r in inputs}):
    vals=[out[f'input/{tech}/{p}'] for p in ['clean','small','large']]
    lines.append('|'+tech+'|'+ '|'.join(f"{v['startedCases']}/8 · {v['targetContactCases']}/8" for v in vals)+'|')
lines+=['','## 해석과 제약','',
 '제비 베기는 첫 내려베기가 실제로 맞아 정상 조건이 열리지 않았다. 이 자료의 실행0은 위력0이 아니다. 별도 먼 거리2.4m 진단에서는 정상 헛침 뒤 발동했지만 목표 몸에는 닿지 않았다. 실제 30초 대련에서 나온 접촉 결과와 분리한다.',
 '손목치기·끌어딛고허리베기의 접촉이 둔타/무상처로 끝난 장면이 있어 판독과 칼의 길을 우선 점검한다. 일부 다른 입력에서는 상처가 나므로 일반적 약함을 단정하지 않는다.',
 '끔 판은 켬 판에서 기록한 프레임별 입력을 그대로 재생한다. 적/자기 종결로 관측 길이가 달라지면 공통 입력 구간만 비교하고, 1초·5초 결과의 complete 플래그를 확인한다. 공격 시작 전 준비 피해와 회수 피해를 목표 공격의 순수 위력으로 합치지 않는다.',
 '1초·5초 양측 접촉 심각도·관측 완료 여부는 analysis.json의 pairs/windows에 있다. 접촉 심각도0인 둔타는 의식/부위·혈액·사지 상태를 원본과 함께 본다.',
 '정확/작은/큰 흔들림은 실험자가 정한 자동 명령이다. 실제 인간 성공률과 다르고, 같은 궤적의 반복은 독립 표본이 아니다. 이동과 길게 누름의 일부는 명령 프록시이며 전체 DOM 경로 검증은 별도 Chromium 자료에 있다.',
 '정본 단발: canonical-a/single + canonical-b/single에서 lianchi 제외 + canonical-tsubame/single + canonical-lianchi-real/single. 입력: a/input + b/input에서 lianchi 제외 + canonical-lianchi-real/input. 다른 pilot/replay-check/a·b single은 진단용이다.',
 '재현: balance_generic_20261101.mjs의 --mode=single/input, --techs, --ranges, --seeds, --duration=12. 단발은 기본 on 뒤 off에서 자동으로 같은 명령을 재생한다. 분석기는 .jsonl.gz도 지원한다.']
(ROOT/'RESULTS.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(validation,ensure_ascii=False))
