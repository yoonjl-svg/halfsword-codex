// Read-only analysis of preserved Italian trials; writes derived artifacts here.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const names=['pilot','pilot_validated','matrix','seeded','inputs','paths','perks','cooldown_validation'];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const min=a=>a.length?Math.min(...a):null,max=a=>a.length?Math.max(...a):null;
const sum=(a,f)=>a.reduce((s,r)=>s+f(r),0);
const round=n=>Number.isFinite(n)?+n.toFixed(5):null;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function read(name){const p=`${dir}${name}/raw.jsonl`,z=p+'.gz';if(!existsSync(p)&&!existsSync(z))return[];const str=existsSync(p)?readFileSync(p,'utf8'):gunzipSync(readFileSync(z)).toString();return str.trim().split('\n').filter(Boolean).map(JSON.parse);}
function phys(r,who,target=false){return r.physiology.filter(e=>e.who===who&&(!target||e.tech===r.tech&&e.t>=(r.timelineExtra.attempt??Infinity)));}
function damage(r,who,target=false){return sum(phys(r,who,target),e=>e.type!=='blunt'&&e.actualWounds>0?e.severity:0);}
function actual(r,who,target=false){return sum(phys(r,who,target),e=>Math.max(0,e.actualWounds));}
function inputHash(r){return r.inputTraceHash??hash(r.inputTrace);}
function getGroup(a){
 const tech=a[0].tech;
 return {n:a.length,conditionTrials:a.filter(r=>r.conditionEpisodes>0).length,conditions:sum(a,r=>r.conditionEpisodes),attempts:sum(a,r=>r.attempted),accepted:sum(a,r=>r.requestAccepted),executed:sum(a,r=>r.executed),
  targetBodyContactTrials:a.filter(r=>r.denominators.targetBodyContacts>0).length,targetRealWoundTrials:a.filter(r=>r.denominators.targetRealWounds>0).length,anyRealWoundTrials:a.filter(r=>actual(r,'enemy')>0).length,
  meanTargetSeverity:mean(a.map(r=>damage(r,'enemy',true))),meanTotalSeverity:mean(a.map(r=>damage(r,'enemy'))),meanReceivedSeverity:mean(a.map(r=>damage(r,'player'))),
  meanPrepInflicted:mean(a.map(r=>r.attribution.enemy.preparation.severity)),meanPrepReceived:mean(a.map(r=>r.receivedByTime?.preparation.severity??null).filter(x=>x!=null)),
  meanBloodLost:mean(a.map(r=>r.inflicted.bloodLost)),meanConsciousnessLost:mean(a.map(r=>r.inflicted.consciousnessLost)),meanReceivedConsciousnessLost:mean(a.map(r=>r.received.consciousnessLost)),
  meanLimbFunctionLost:Object.fromEntries(['armS','armO','legF','legB'].map(l=>[l,mean(a.map(r=>r.inflicted.limbsLost[l]))])),
  enemyKilled:a.filter(r=>r.inflicted.dead&&r.inflicted.cause!=='기절').length,enemyUnconscious:a.filter(r=>r.inflicted.cause==='기절'||!r.inflicted.dead&&r.inflicted.end.consciousness<=0).length,
  enemyImmediateDeaths:a.filter(r=>r.inflicted.dead&&r.inflicted.cause!=='기절'&&phys(r,'enemy').some(e=>e.died)).length,enemyDelayedDeaths:a.filter(r=>r.inflicted.dead&&r.inflicted.cause!=='기절'&&!phys(r,'enemy').some(e=>e.died)).length,
  playerKilled:a.filter(r=>r.received.dead&&r.received.cause!=='기절').length,playerUnconscious:a.filter(r=>r.received.cause==='기절'||!r.received.dead&&r.received.end.consciousness<=0).length,
  enemyTerminalCauses:a.reduce((o,r)=>{if(r.inflicted.dead)o[r.inflicted.cause??'unknown']=(o[r.inflicted.cause??'unknown']??0)+1;return o;},{}),playerTerminalCauses:a.reduce((o,r)=>{if(r.received.dead)o[r.received.cause??'unknown']=(o[r.received.cause??'unknown']??0)+1;return o;},{}),
  enemyKnockdowns:sum(a,r=>r.inflicted.knockdowns),playerKnockdowns:sum(a,r=>r.received.knockdowns),enemyDisarms:sum(a,r=>r.inflicted.disarms),playerDisarms:sum(a,r=>r.received.disarms),
  meanStaminaSpent:mean(a.map(r=>r.stamina.totalSpent)),meanMinimumStamina:mean(a.map(r=>r.stamina.min)),exhaustions:sum(a,r=>r.stamina.exhaustions),
  inputDistance:{mean:mean(a.map(r=>r.snapshots.targetInput?.distance).filter(Number.isFinite)),min:min(a.map(r=>r.snapshots.targetInput?.distance).filter(Number.isFinite)),max:max(a.map(r=>r.snapshots.targetInput?.distance).filter(Number.isFinite))},
  meanInputToExecution:mean(a.filter(r=>r.timelineExtra.start!=null&&r.timelineExtra.attempt!=null).map(r=>(r.timelineExtra.start-r.timelineExtra.attempt)/r.settings.TIME.k)),
  meanMotionDuration:mean(a.filter(r=>r.timelineExtra.start!=null&&r.timelineExtra.motionEnd!=null).map(r=>(r.timelineExtra.motionEnd-r.timelineExtra.start)/r.settings.TIME.k)),
  meanControllerReleaseAfterMotion:mean(a.filter(r=>r.timelineExtra.motionEnd!=null&&r.timelineExtra.controlRecovery!=null).map(r=>(r.timelineExtra.controlRecovery-r.timelineExtra.motionEnd)/r.settings.TIME.k)),
  meanFlowRecoveryDurationAtExecution:mean(a.map(r=>r.snapshots.executionStart?.enemy.flowRecovery?.duration).filter(Number.isFinite)),flowRecoveryAtExecution:a.filter(r=>r.snapshots.executionStart?.enemy.flowRecovery).length,
  armorContacts:sum(a,r=>phys(r,'enemy',true).filter(e=>e.helmet||e.plate).length),bluntContacts:sum(a,r=>phys(r,'enemy',true).filter(e=>e.type==='blunt').length),
  targetParts:a.reduce((o,r)=>{for(const e of phys(r,'enemy',true))o[e.part??e.zone]=(o[e.part??e.zone]??0)+1;return o;},{}),meanTargetBleedAdded:mean(a.map(r=>sum(phys(r,'enemy',true),e=>e.bleedAdded))),
  completed5s:a.filter(r=>r.checkpoints['5']!=null).length,uniqueInputTraces:new Set(a.map(inputHash)).size,
  actualHandResponseAfterRecovery:null,actualFootResponseAfterRecovery:null,
  competingAttackTrials:a.filter(r=>!r.executed&&Object.entries(r.fired).some(([name,n])=>name!==tech&&n>0)).length,
  failureReasons:a.reduce((o,r)=>{for(const f of r.failureReasons)o[f]=(o[f]??0)+1;return o;},{}),wallSeconds:sum(a,r=>r.wallSeconds)};
}
const datasets=Object.fromEntries(names.map(n=>[n,read(n)]));
const groups={},pairs=[],validation=[];
for(const [dataset,a]of Object.entries(datasets)){
 for(const r of a){r.dataset=dataset;const key=[dataset,r.tech,r.strokeName??'oberhau',r.perks===false?'noI8':'full',r.range,r.inputProfile,r.variant].join('/');(groups[key]??=[]).push(r);}
 for(const r of a.filter(r=>r.variant==='on')){
  const off=a.find(o=>o.variant==='off'&&o.tech===r.tech&&o.range===r.range&&o.seed===r.seed&&(o.strokeName??'oberhau')===(r.strokeName??'oberhau')&&(o.perks!==false)===(r.perks!==false));
  if(!off)continue;
  pairs.push({dataset,tech:r.tech,range:r.range,seed:r.seed,strokeName:r.strokeName??'oberhau',perks:r.perks!==false,
   dealtDifference:damage(r,'enemy')-damage(off,'enemy'),receivedDifference:damage(r,'player')-damage(off,'player'),staminaDifference:r.stamina.totalSpent-off.stamina.totalSpent,
   onTargetSeverity:damage(r,'enemy',true),onAnySeverity:damage(r,'enemy'),offAnySeverity:damage(off,'enemy'),onExecuted:r.executed,
   inputPlanIdentical:JSON.stringify(r.settings.sampledInput)===JSON.stringify(off.settings.sampledInput)&&JSON.stringify(r.settings.sampledStroke)===JSON.stringify(off.settings.sampledStroke),
   targetInputSnapshotIdentical:JSON.stringify(r.snapshots.targetInput)===JSON.stringify(off.snapshots.targetInput),
   firstInputTimeDifference:r.timelineExtra.attempt!=null&&off.timelineExtra.attempt!=null?r.timelineExtra.attempt-off.timelineExtra.attempt:null});
 }
 const manifests=existsSync(`${dir}${dataset}/manifest.json`)?JSON.parse(readFileSync(`${dir}${dataset}/manifest.json`,'utf8')):null;
 validation.push({dataset,rows:a.length,scheduled:manifests?.schedule?.length??null,complete:a.length===(manifests?.schedule?.length??-1),allValid:a.every(r=>r.validity.valid&&r.validity.normalDamage&&r.validity.noForcedConditions&&!r.validity.windowShimDuringWorldStep),
  allBaseline:a.every(r=>r.build.startsWith('88a96061')),allHuman25:a.every(r=>r.humanInput&&r.settings.humanRecoveryPerReferenceSecond===25&&!r.gear.infinite),
  maxTargetAttempts:max(a.map(r=>r.attempted)),maxExecuted:max(a.map(r=>r.executed)),requestsWithoutMotion:a.filter(r=>r.requestAccepted>0&&r.executed===0).length,
  inputTraceUnique:new Set(a.map(inputHash)).size,wallSeconds:sum(a,r=>r.wallSeconds),scriptHashes:[...new Set(a.map(r=>r.scriptHash))]});
}
const out={generated:new Date().toISOString(),groups:Object.fromEntries(Object.entries(groups).map(([k,a])=>[k,getGroup(a)])),pairs,validation,
 pairedValidation:{n:pairs.length,allInputPlansIdentical:pairs.every(p=>p.inputPlanIdentical),allTargetInputSnapshotsIdentical:pairs.every(p=>p.targetInputSnapshotIdentical),maxAbsFirstInputTimeDifference:max(pairs.map(p=>Math.abs(p.firstInputTimeDifference??0)))},
 caveats:['Scripted Node Input proxy; not human success rate','Fixed opponent and default armor only','Initial matrix has deterministic repeated physical trajectories','No direct art requests or forced touch/threat/window','No natural-round frequency in this file','Controller release is not new-input responsiveness verification']};
writeFileSync(`${dir}analysis.json`,JSON.stringify(out,null,2));
const ko={imbroccata:'임브로카타',cavazione:'카바치오네',inquartata:'인콰르타타'},kr={close:'가까움',normal:'보통',edge:'끝'};
const f=n=>n==null?'미측정':Number(n).toFixed(3);
const get=(dataset,tech,range,variant='on',profile='exact',stroke='oberhau',perk='full')=>out.groups[[dataset,tech,stroke,perk,range,profile,variant].join('/')];
let md='# 이탈리아 I7·I2·I9 실측 결과\n\n';
md+='본판 `88a96061`의 정상 피해와 사람 기력 규칙을 유지한 새 몸 시험입니다. **노드 자동 입력의 결과이며 실제 인간 성공률이나 30초 자연 빈도가 아닙니다.** [방법과 한계](METHOD.md), [기계 판독 요약](analysis.json)에 분모·설정·원본 경로가 있습니다.\n\n';
md+='주 비교는 `seeded` 108개(54쌍), 입력 내성은 `inputs` 72개입니다. `paths` 72개와 `perks` 36개는 경로·심화 효과 분해입니다. 초기 `matrix` 108개와 pilot류는 진단·검증 자료이며 주 표본과 합산하여 독립 시행 수를 늘리지 않았습니다.\n\n';
md+='| 기술 | 현재 판정 | 근거와 한계 |\n|---|---|---|\n';
md+='| 임브로카타 | 입력·거리 한정, 장단점 상충 | 고정 수직 속도에서는 날 상처가 없었지만 속도 은행과 다른 내려긋기에서는 보통/끝에서 실상처가 생깁니다. 가까움은 둔타/헛침이 많습니다. 일반적인 피해 부족으로 단정할 수 없습니다. |\n';
md+='| 카바치오네 | 발동/입력 문제 후보, 특정 조건의 열세 | 접촉 덩이가 탭 직전에 새로 바뀌며 이른 탭으로 소진되는 실패가 반복됩니다. 수동 긴 자세 상대의 보통/끝에서는 같은 일반 탭보다 상처가 작았습니다. I8의 실제 팔 지연을 확인했으나 반응하는 상대에 대한 이득은 이 자료만으로 판단하지 못합니다. |\n';
md+='| 인콰르타타 | 장단점 상충, 표본 부족 | 보통 거리에서 일반 탭보다 준 상처가 크고 받은 상처도 증가했습니다. 옆 스틱/탭의 큰 흔들림에서 발동이 줄었습니다. 특수 식힘과 판 전체 기회 빈도를 함께 보아야 합니다. |\n\n';
md+='## 주 단발 짝시험: 서로 다른 정상 입력 명령\n\n';
md+='각 행은 켬 6개·끔 6개입니다. 실행/몸 접촉/실상처는 대상 기술의 분모입니다. 피해는 실제 적용된 새 베기·찌르기 상처 심각도의 합입니다. 평균 켬/끔 피해는 준비와 회수를 포함한 총 피해이며, 준비 피해는 원본에서 따로 볼 수 있습니다.\n\n';
md+='| 기술/거리 | 실제 입력 거리 평균(m) | 시도→수락→실행(켬) | 몸 접촉/실상처 시행(켬) | 총 상처 켬/끔 평균 | 짝 차이 평균[최소,최대] | 받은 상처 켬/끔 | 기력 지출 켬/끔 |\n|---|---:|---|---|---|---|---|---|\n';
for(const tech of Object.keys(ko))for(const range of Object.keys(kr)){
 const on=get('seeded',tech,range),off=get('seeded',tech,range,'off');if(!on||!off)continue;const p=pairs.filter(p=>p.dataset==='seeded'&&p.tech===tech&&p.range===range);
 md+=`| ${ko[tech]} ${kr[range]} | ${f(on.inputDistance.mean)} | ${on.attempts}→${on.accepted}→${on.executed} | ${on.targetBodyContactTrials}/${on.targetRealWoundTrials} | ${f(on.meanTotalSeverity)} / ${f(off.meanTotalSeverity)} | ${f(mean(p.map(p=>p.dealtDifference)))} [${f(min(p.map(p=>p.dealtDifference)))}, ${f(max(p.map(p=>p.dealtDifference)))}] | ${f(on.meanReceivedSeverity)} / ${f(off.meanReceivedSeverity)} | ${f(on.meanStaminaSpent)} / ${f(off.meanStaminaSpent)} |\n`;
}
md+='\n| 기술/거리 | 상대 혈액 감소 켬/끔 | 상대 의식 감소 켬/끔 | 상대 사지 기능 손실 합 켬/끔 | 상대 사망·KO 켬/끔 | 상대/자신 넘어짐 켬;끔 |\n|---|---|---|---|---|---|\n';
for(const tech of Object.keys(ko))for(const range of Object.keys(kr)){const a=get('seeded',tech,range),b=get('seeded',tech,range,'off');if(!a||!b)continue;md+=`| ${ko[tech]} ${kr[range]} | ${f(a.meanBloodLost)} / ${f(b.meanBloodLost)} | ${f(a.meanConsciousnessLost)} / ${f(b.meanConsciousnessLost)} | ${f(Object.values(a.meanLimbFunctionLost).reduce((s,v)=>s+v,0))} / ${f(Object.values(b.meanLimbFunctionLost).reduce((s,v)=>s+v,0))} | ${a.enemyKilled}·${a.enemyUnconscious} / ${b.enemyKilled}·${b.enemyUnconscious} | ${a.enemyKnockdowns}/${a.playerKnockdowns}; ${b.enemyKnockdowns}/${b.playerKnockdowns} |\n`;}
md+='\n`state=dead`만으로 사망을 세지 않았습니다. 원인이 `기절`이면 KO로 분리했고, 다른 원인의 사망 뒤 의식이 낮다는 이유로 KO를 중복 집계하지 않았습니다. 부위·방어구에 막힘·출혈 추가·무장 상실은 `analysis.json` 및 원본 생리 사건에 별도 기록했습니다.\n';
md+='\n## 자동 입력의 발동 내성\n\n';
md+='각 기술·묶음은 같은 여덟 정상 명령에 해당 흔들림을 적용한 8개입니다. 정확 묶음도 접촉 덩이가 바뀌거나 위협이 지나가면 실패합니다. 몸 접촉은 둔타를 포함하고 실상처 시행은 새 날 상처가 생긴 판입니다.\n\n';
md+='| 기술 | 입력 묶음 | 조건 있는 판 | 시도→수락→실행 | 대상 몸 접촉/실상처 판 | 주 실패 사유 |\n|---|---|---:|---|---|---|\n';
for(const tech of Object.keys(ko))for(const profile of['exact','small','large']){const g=get('inputs',tech,'normal','on',profile);if(!g)continue;md+=`| ${ko[tech]} | ${profile} | ${g.conditionTrials}/${g.n} | ${g.attempts}→${g.accepted}→${g.executed} | ${g.targetBodyContactTrials}/${g.targetRealWoundTrials} | ${Object.entries(g.failureReasons).map(([k,n])=>k+' '+n).join('; ')||'없음'} |\n`;}
md+='\n## I7의 입력 경로 보강\n\n';
md+='각 경로/거리는 켬·끔 6쌍입니다. 수직 내려긋기 한 경로를 I7 전체 결과로 일반화하지 않도록 원래 황소 찌르기와 사선 내려긋기도 별도로 시행했습니다.\n\n';
md+='| 경로 | 거리 | 시도→수락→실행(켬) | 대상 몸 접촉/실상처 판 | 총 상처 켬/끔 평균 |\n|---|---|---|---|---|\n';
for(const stroke of['stichOchs','zornhau'])for(const range of Object.keys(kr)){const on=get('paths','imbroccata',range,'on','exact',stroke),off=get('paths','imbroccata',range,'off','exact',stroke);if(on&&off)md+=`| ${stroke} | ${kr[range]} | ${on.attempts}→${on.accepted}→${on.executed} | ${on.targetBodyContactTrials}/${on.targetRealWoundTrials} | ${f(on.meanTotalSeverity)} / ${f(off.meanTotalSeverity)} |\n`;}
md+='\n## I8 헛누름 분해\n\n';
md+='같은 입력에서 I8을 뺀 카바치오네 켬/끔 18쌍을 추가했습니다. 상대는 같은 수동 긴 자세이므로 실제 대전에서 상대의 반응 기회를 빼앗는 이점은 이 표로 확정할 수 없습니다.\n\n';
md+='| 거리 | I8 있음/없음 대상 실행 | I8 있음/없음 실제 총 상처 평균 | I8 있음/없음 실행 때 팔 회복 지연 관측 |\n|---|---|---|---|\n';
for(const range of Object.keys(kr)){const on=get('seeded','cavazione',range),no=get('perks','cavazione',range,'on','exact','oberhau','noI8');if(on&&no)md+=`| ${kr[range]} | ${on.executed}/${no.executed} | ${f(on.meanTotalSeverity)} / ${f(no.meanTotalSeverity)} | ${on.flowRecoveryAtExecution}/${no.flowRecoveryAtExecution} |\n`;}
const cool=datasets.cooldown_validation.find(r=>r.tech==='inquartata');
if(cool){md+='\n## 특수 식힘 관측\n\n';md+=`인콰르타타 검증판에서 실행 중 식힘 시각은 Infinity, 운동 종료는 ${f(cool.timelineExtra.motionEnd)}게임초, 끝 자세 풀기 뒤 식힘 시작은 ${f(cool.snapshots.after1s.player.unique.coolT.inquartata)}게임초였습니다. 규칙은 ${f(cool.settings.specialCooldown)}게임초=${f(cool.settings.specialCooldown/cool.settings.TIME.k)}기준초이며, 시작 후 1초 관측에는 ${f(cool.snapshots.after1s.player.unique.coolLeft.inquartata)}게임초가 남았고 5초 관측에는 0이었습니다. 임브로카타·카바치오네는 식힘이 생기지 않았습니다. 이 검증은 새 입력의 실제 반응을 재시험한 손/발 제어 복구 시험은 아닙니다.\n`;}
md+='\n## 검증과 재현\n\n';
md+='| 묶음 | 완료/예정 | 유효·정상피해·기력25 | 실측 계산 벽시간(초) |\n|---|---|---|---:|\n';
for(const v of validation)md+=`| ${v.dataset} | ${v.rows}/${v.scheduled??'?'} | ${v.allValid&&v.allHuman25?'확인':'추가 확인'} | ${f(v.wallSeconds)} |\n`;
md+=`\n짝 ${out.pairedValidation.n}개의 입력 계획 동일: ${out.pairedValidation.allInputPlansIdentical}, 첫 목표 입력 snapshot 동일: ${out.pairedValidation.allTargetInputSnapshotsIdentical}, 첫 입력 시각 차이 최대 ${f(out.pairedValidation.maxAbsFirstInputTimeDifference)}게임초입니다. 독립적인 사용자 표본이나 신뢰구간으로 바꾸어 부르지 않았습니다.\n\n`;
md+='원본은 각 묶음의 `raw.jsonl` 또는 이를 바이트 그대로 압축한 `raw.jsonl.gz`입니다. `manifest.json`, `code_snapshot.mjs`, `summary.json`, `timing.json`에 설정·코드·명령·시간을 보존했습니다. 주 정본 seeded/inputs/paths/perks 및 마지막 검증은 실행 당시의 `core_snapshot.mjs`도 포함합니다. 초기 pilot 및 matrix는 현재 코드 이전 진단 단계이며 주 표본으로 합산하지 않습니다. 전체 정본 목록과 압축 전후 SHA-256은 [RUN_INDEX.md](RUN_INDEX.md)와 각 `archive.json`에서 확인할 수 있습니다.\n\n';
md+='```sh\nnode tools/sim/balance_italian_20261101.mjs seeded\nnode tools/sim/balance_italian_20261101.mjs inputs\nnode tools/sim/balance_italian_20261101.mjs paths\nnode tools/sim/balance_italian_20261101.mjs perks\nnode docs/research/attack_balance_20261101/italian/analyze.mjs\n```\n';
writeFileSync(`${dir}RESULTS.md`,md);
const csvHead=['dataset','tech','path','perk','range','inputProfile','variant','n','attempts','accepted','executed','targetBodyContactTrials','targetRealWoundTrials','meanTotalSeverity','meanReceivedSeverity','meanStaminaSpent'];
const csv=[csvHead.join(',')];for(const[k,g]of Object.entries(out.groups))csv.push([...k.split('/'),...csvHead.slice(7).map(x=>g[x])].join(','));writeFileSync(`${dir}groups.csv`,csv.join('\n')+'\n');
console.log(JSON.stringify({validation:out.validation,paired:out.pairedValidation}));
