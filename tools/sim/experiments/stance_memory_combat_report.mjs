import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),path=process.argv[2];
if(!path)throw Error('Provide completed stance-memory combat artifact');
const raw=JSON.parse(fs.readFileSync(path,'utf8')),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const file=p=>({path:p,sha256:sha(fs.readFileSync(p)),bytes:fs.statSync(p).size}),fmt=x=>Number(x).toPrecision(6);
const rows=raw.runs.map(r=>({mode:r.mode,scene:r.scene,seed:r.seed,forced:r.forced,seconds:r.seconds,wallSeconds:r.wallSeconds,runtime:r.runtime,
 checkpoint:r.checkpoint,stats:r.stats,entries:r.entries,transitions:r.transitions,wounds:r.wounds,final:r.final,
 traceSHA256:sha(JSON.stringify(r.frameHashes)),semanticTraceSHA256:sha(JSON.stringify(r.semanticFrameHashes)),physicalTraceSHA256:sha(JSON.stringify(r.physicalFrameHashes)),
 inputTraceSHA256:sha(JSON.stringify(r.inputHashes)),targetTraceSHA256:sha(JSON.stringify(r.targetHashes))}));
const resets=rows.filter(r=>r.mode==='reset'),triggered=resets.filter(r=>r.stats.nonzeroMemoryRecoveryClears.some(n=>n>0));
const plate=raw.runs.find(r=>r.mode==='reset'&&r.scene==='plate'&&r.seed===17),baselinePlate=raw.runs.find(r=>r.mode==='baseline'&&r.scene==='plate'&&r.seed===17);
const extraTransition=plate?.transitions.find((t,i)=>t.to==='getup'&&plate.transitions.slice(0,i).some(p=>p.to==='getup'));
const causalWounds=extraTransition?plate.woundRows.filter(w=>w.frame===extraTransition.frame&&w.victim===extraTransition.fighter):[];
const firstGetupPlate=plate?.transitions.find(t=>t.to==='getup');
const baselineDeath=baselinePlate?.transitions.find(t=>t.to==='dead');
const review=resets.map(r=>{const b=rows.find(b=>b.mode==='baseline'&&b.scene===r.scene&&b.seed===r.seed&&b.forced===r.forced);return {scene:r.scene,seed:r.seed,
   speedTripwire:r.stats.maxBodySpeedMps>b.stats.maxBodySpeedMps*3+10,gapTripwire:r.stats.maxJointGapM.some((g,i)=>g>b.stats.maxJointGapM[i]+.1),
   wholeKRatio:r.stats.peakWholeKJ/b.stats.peakWholeKJ,angularRatio:r.stats.maxBodyAngularRadps/b.stats.maxBodyAngularRadps,
   note:'Baseline-relative coarse anomaly gates, not naturalness thresholds. Both K/rotation peaks and contexts are retained.'};});
const repeatPaths=['/workspace/halfsword-hybrid-evidence/stance-memory-combat-r1.json','/workspace/halfsword-hybrid-evidence/stance-memory-combat-r2.json.runs.jsonl'];
const repeats=repeatPaths.filter(p=>fs.existsSync(p)).map(p=>{
 const previous=p.endsWith('.json')?JSON.parse(fs.readFileSync(p,'utf8')).runs:fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse);
 return {artifact:file(p),completedRows:previous.length,comparison:previous.map(p=>{const r=raw.runs.find(r=>r.mode===p.mode&&r.scene===p.scene&&r.seed===p.seed&&r.forced===p.forced);return {mode:p.mode,scene:p.scene,seed:p.seed,
   found:!!r,orderSensitiveTraceExact:!!r&&JSON.stringify(p.frameHashes)===JSON.stringify(r.frameHashes),actualInputExact:!!r&&JSON.stringify(p.inputHashes)===JSON.stringify(r.inputHashes),
   actualTargetsExact:!!r&&JSON.stringify(p.targetHashes)===JSON.stringify(r.targetHashes)};})};
});
const noNewAnomaly=review.every(r=>!r.speedTripwire&&!r.gapTripwire);
const extraRecoveryHasCombatContext=!!extraTransition&&causalWounds.some(w=>w.result.zone==='head'&&w.result.type==='blunt')&&baselineDeath?.timeS<extraTransition.timeS;
const comparisonOnlyEligible=raw.pass&&noNewAnomaly&&triggered.length>0&&extraRecoveryHasCombatContext;
const metrics={schemaVersion:1,createdUTC:new Date().toISOString(),scope:'Real combat/wound regression of Gait.enter Nf-only lifecycle reset; all arm/cut modes legacy.',
 sourceCommit:raw.baselineCommit,command:raw.command,configuration:raw.configuration,artifact:file(path),checkpoints:file(path+'.runs.jsonl'),initialManifest:file(path+'.start.json'),
 probeSHA256:raw.toolSHA256,reportSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),sourceBefore:raw.sourceBefore,sourceAfter:raw.sourceAfter,sourceStable:raw.sourceStable,
 historicalSourceExact:raw.historicalSourceExact,history:raw.history,comparisons:raw.comparisons,executionPass:raw.pass,rows,
 actualTriggerCoverage:{normalRecoveryEntriesAcrossBranchRows:raw.normalRecoveryEntries,resetCasesWithNonzeroRecoveryMemory:triggered.map(r=>({scene:r.scene,seed:r.seed,clears:r.stats.nonzeroMemoryRecoveryClears})),
   syntheticRows:rows.filter(r=>r.forced).length,note:'Initial undefined Nf to0 is not a recovery intervention. Branched entries and replays are not independent samples.'},
 plate17AdditionalGetup:{firstGetup:firstGetupPlate,extraTransition,actualSameFrameWounds:causalWounds,baselineEnemyDeath:baselineDeath,
   baselineStats:baselinePlate?.stats,resetStats:plate?.stats,
   interpretation:'Additional getup coincides with a real120.238J head blunt after AI/target divergence; baseline opponent had already died. This does not isolate an unprovoked support refall or establish same-input recovery regression.'},
 anomalyReview:review,anyCoarseAnomaly:!noNewAnomaly,comparisonOnlyEligible,generalPromotion:false,
 observationContract:{oldQ05BaselineOrderSensitiveTrace:'All4 historical baselines exact, including actual inputs; valid only while frozen source/setting hashes match.',
   canonicalController:'Recursively sort object keys, retain array order/all values. Initial clear inserts Nf early, so unsorted JSON hashes differ even when semantic state is equal.',
   initialCheckpoint:'Native snapshot, canonical controller and actual input must match; unsorted control hash recorded separately.',
   beforeActualReset:'First real recovery enter captures native snapshot, canonical controller, actual input, target hash and F/B Nf/N; all matched between branches.',
   physicalTrace:'Independent per-frame selected dynamic-body mass/p/q/COM/v/w/inertia/userForce/userTorque hash; no controller-property order.'},
 correctionHistory:{r1Reason:'Raw ownState JSON key order changes after initial undefined Nf→0. R1 misleading frame0 differences and prepared raw control hash are observation-contract failures, not physics differences.',
   r2Reason:'Added canonical per-frame/entry and independent physical hashes; prepared checkpoint still used unsorted control. Stopped to correct that remaining contract.',
   replays:repeats,note:'Reexecution was necessary to repair observation guards. No new gain/source/helper/AI/engine contract and no new independent samples.'},
 limitations:[...raw.limitations,'Nf friction memory fix does not replace legacy direct support or establish ground-reaction realism.',
   'maxFootDesDistance is retained raw descriptor distance including uninitialized/stance/inactive des values; excluded from performance judgment.',
   'Hand target error includes actual combat/blocking/grip conditions, not isolated tracking efficacy.',
   'Decision allows only isolated legacy-support comparison with runtime-parity/mobile checks; does not justify general promotion or resurrect projected support trial.']};
fs.writeFileSync(root+'docs/strike/stance_memory_combat_round1_metrics.json',JSON.stringify(metrics,null,2)+'\n');
const table=rows.map(r=>`| ${r.scene}/${r.seed} | ${r.mode} | ${r.stats.postInitialEnterCalls.join('/')} | ${r.stats.nonzeroMemoryRecoveryClears.join('/')} | ${r.wounds.length} | ${r.stats.deaths.join('/')} | ${fmt(r.stats.peakWholeKJ)} | ${fmt(r.stats.peakWholeRotationalKJ)} | ${fmt(r.stats.maxBodyAngularRadps)} | ${fmt(Math.max(...r.stats.maxJointGapM)*1000)} |`).join('\n');
const guards=raw.comparisons.map(c=>`| ${c.scene}/${c.seed} | ${c.checkpointExact} | ${c.baselineHistoricalFullTraceExact}/${c.baselineHistoricalInputsExact} | ${c.firstTraceDifferenceFrame}/${c.firstPhysicalDifferenceFrame} | ${c.firstInputDifferenceFrame}/${c.firstTargetDifferenceFrame} | ${c.firstRecoveryEntryPrestateExact??'미개입'} |`).join('\n');
const entryTable=resets.flatMap(r=>r.entries.filter(e=>e.recovery).map(e=>`| ${r.scene}/${r.seed} | ${e.fighter} | ${e.frame}/${fmt(e.timeS)} | ${fmt(e.before.F.Nf??0)}/${fmt(e.before.B.Nf??0)} | ${fmt(e.before.F.N??0)}/${fmt(e.before.B.N??0)} | ${e.helperOnlyNf} |`)).join('\n');
const doc=`# 서기 진입 마찰 기억 초기화 · 실제 전투 회귀 1차

2026-10-02. 소스 \`${raw.baselineCommit}\`. [metrics](stance_memory_combat_round1_metrics.json)에 완료 artifact/입력/소스/엔진/후처리 해시와 실제 사건을 남겼다. **실행·동일 준비·관찰·소스 동결 ${raw.pass?'PASS':'FAIL'}**. 일반판 승격은 아니다.

## 범위와 실제 개입

Q05와 같은 양쪽 실제 AI·일반 상처/사망/native 충돌의30초 결투, cloth/plate × seed7/17 × baseline/reset = **8행**이다. 준비1초를 포함해 양쪽 모든 Gait.enter에 관찰 wrapper를 설치하고 reset에서 기존 helper를 original enter 전에 실행했다. arm/cut은 모두 legacy, paired grip/legacy support/assist.3/catch on/1이다. helper는 Nf만0으로 만들며 N/Nsum·mass·plant·targets·gains·native 설정을 바꾸지 않는다. 직접 속도/위치 덮어쓰기나 상처 억제는 없다.

라운드 시작의 undefined Nf→0은 회복 효과로 세지 않았다. seed7 두 장면은 이후 enter가0이고, seed17 두 장면에서 실제 getup→stand 재진입과 양의 기존 Nf가 관찰됐다. 총 recovery entry ${raw.normalRecoveryEntries}회는 분기 양쪽의 합이며 독립 표본수가 아니다. 실제 reset 유효 장면은 ${triggered.map(r=>r.scene+'/'+r.seed).join(', ')}이다. **synthetic knockdown 행 ${rows.filter(r=>r.forced).length}개**로, 실제 전투 회복이 있어 예약한 fallback을 실행하지 않았다. down만 세면 놓치는 직접 stand→getup 경로도 실제 setState 호출로 기록했다.

| 장면/seed | 설정 | 시작 이후 enter P/E | 양의 Nf 회복 clear P/E | wound hook | death P/E | 최고 전체 K J | 최고 회전 K J | 최대 몸체 ω rad/s | 최대 유효 joint gap mm |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
${table}

| reset 진입 | fighter | frame/time s | 진입 전 Nf F/B N | 진입 전 현재 N F/B N | helper가 Nf만 변경 |
|---|---:|---|---|---|---|
${entryTable}

## 준비·관찰·입력 관문

같은 시작의 native snapshot/canonical controller/actual input이 exact다. 시작 helper는 Nf 필드를 먼저 정의하므로 JS 객체의 key 삽입 순서가 달라진다. 기존 unsorted JSON hash 차이를 물리 개입으로 판정하지 않았다. raw hash를 보존하고, 키만 재귀 정렬한 semantic controller hash와 별도의 물리 body hash를 추가했다. 배열·모든 값은 유지한다. 실제 첫 회복 clear 직전 native/controller/input/targets와 F/B Nf/N은 exact다.

4 baseline은 frozen Q05 source/설정과 전체 unsorted trace/입력이 exact여서 새 관찰 wrapper가 게임을 바꾸지 않았음을 확인했다. seed7 no-entry의 물리·semantic controller·입력·targets도 exact이며 회복 효능을 보여주는 행으로 쓰지 않는다.

| 장면/seed | 준비 exact | Q05 baseline trace/input exact | 첫 semantic/물리 차이 frame | 첫 AI입력/target 차이 frame | 첫 실제 recovery 사전 상태 exact |
|---|---|---|---|---|---|
${guards}

후보의 첫 실제 clear 이후 native 결과를 보고 AI 입력과 목표도 달라진다. 이후 wound/death/getup 숫자는 같은 입력의 피해·회복 효능 비교가 아니다. raw -1 차이 frame은 끝까지 같음을 뜻한다.

## plate17의 추가 getup 판정

기준 player의 회복 재진입1회→후보2회다. 후보 두 번째 stand→getup은 frame${extraTransition?.frame??'미관찰'}, t=${fmt(extraTransition?.timeS??0)}s이고 **같은 frame의 실제 상대→player 머리 blunt ${fmt(causalWounds.find(w=>w.result.zone==='head')?.result.energy??0)}J**, 의식 ${fmt(extraTransition?.consciousness??0)}와 함께 기록됐다. 기준 상대는 t=${fmt(baselineDeath?.timeS??0)}s에 목 사망했고 후보 상대는 살아 전투를 계속했다. 무자극 지지 재넘어짐으로 분류할 근거가 없다.

후보 전체 K 최고 ${fmt(plate?.stats.peakWholeKJ??0)}J vs 기준 ${fmt(baselinePlate?.stats.peakWholeKJ??0)}J, 유효 joint gap 최고 ${fmt(Math.max(...plate.stats.maxJointGapM)*1000)}mm vs ${fmt(Math.max(...baselinePlate.stats.maxJointGapM)*1000)}mm다. 한편 sword angular peak는 ${fmt(plate.stats.maxBodyAngularRadps)} vs ${fmt(baselinePlate.stats.maxBodyAngularRadps)}rad/s로 증가했다. 각각 frame/부품/질량/파지/생존/상처 맥락을 raw와 metrics에 남겼다. 회전·입력 추종의 혼합 결과를 자연스러움 개선으로 포장하지 않는다.

plate17 player의 파지/생존 중 최고 손 목표 오차도 ${fmt(baselinePlate.stats.maxHandTargetErrorM[0])}→${fmt(plate.stats.maxHandTargetErrorM[0])}m로 커졌다. cloth17 역시 최고 몸체 회전 속도가 증가했다. 실제 접촉·방어·AI 목표가 달라진 이후의 궤적 지표이며, 이 불리한 변화도 선택형 비교의 검토 항목으로 남긴다. 현재 증거로 같은 입력의 추종 성능이나 회복 효능을 판정하지 않는다.

baseline-relative 속도×3+10m/s 또는 joint gap+.1m의 거친 새 이상 문턱은 ${review.filter(r=>r.speedTripwire||r.gapTripwire).length}행에 걸렸다. 이 문턱은 인체/게임 상한이 아니다. getup이 더 많다는 이유만으로 지지 실패라 단정하거나, 더 적은 K를 효능이라 판정하지 않는다.

## 결론과 한계

${comparisonOnlyEligible?'기존 legacy 지지 안에서 격리된 선택형 비교의 다음 검증으로 진행할 근거가 있다. 같은 누움의6조건 실제 trace parity와 옵션 source 분기·모바일 입력 계약은 별도로 확인해야 한다.':'선택형 노출 전에 실패/미개입 관문을 해결해야 한다.'} **기본 승격 없음**. projected 지지 연구판의 철회를 뒤집지 않는다. 현재 접촉 N을 읽는 경로를 유지한 수명 필드 초기화이지, 지지를 지면 반작용으로 완성한 해법은 아니다.

native 총 motor/contact/constraint 일과 사용자 체감은 측정하지 않았다. 손 목표 오차는 실제 파지/블록·AI 입력 상황을 포함한다. maxFootDesDistance는 초기/stance/비활성 des까지 포함한 raw 기술자로 성능 판정에서 제외한다. 제대로 된 목표 변화는 관절/handTarget/foot des/desV hash와 실제 입력의 전후로 비교했다.

## 재현·관찰 수정 이력

최종8행의 실제 전투 시간240초, 실행 wall ${fmt(raw.runs.reduce((s,r)=>s+r.wallSeconds,0))}초다. 첫 r1의 raw 객체순서 guard 실패와 r2의 준비 hash 정렬 누락을 보존했다. 관찰 계약 수리를 위해 재실행했으며 새로운 gain/게임/helper/AI/engine 변경은 없다. 이전 완료행과 최종행의 raw trace/input/targets 반복 일치를 metrics에 남겼다. 반복을 독립 표본으로 추가하지 않았다.

\`\`\`sh
${raw.command}
node tools/sim/experiments/stance_memory_combat_report.mjs ${path}
\`\`\`

새 --out 경로로 재실행하며 기존 checkpoint/start를 덮어쓰지 않는다. Q05 historical exact는 기록한 기준 source/설정이 동일할 때만 판정한다. 일반 코드 변경 뒤 이 검사를 숨기지 않고 새 분기 parity로 별도 검증한다. 원본/상대 자료·네트워크 조회, core/shared tool 수정, commit/push는 이 PM 작업에 없다.
`;
fs.writeFileSync(root+'docs/strike/stance_memory_combat_round1.md',doc);
console.log(JSON.stringify({executionPass:raw.pass,sourceStable:raw.sourceStable,comparisonOnlyEligible,rows:rows.length,actualTriggerCoverage:metrics.actualTriggerCoverage,anyCoarseAnomaly:metrics.anyCoarseAnomaly,comparisons:raw.comparisons}));
