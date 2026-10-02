/** Compact, auditable Q05 postprocessing. Reads executed artifact; no game changes. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const path=process.argv[2];if(!path)throw Error('Provide completed Q05 artifact');
const raw=JSON.parse(fs.readFileSync(path,'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const hashFile=p=>({path:p,sha256:sha(fs.readFileSync(p)),bytes:fs.statSync(p).size});
const modes=['baseline','cut','arm','combined'],norm=v=>Math.hypot(v.x,v.y,v.z);
const max=(rows,key)=>Math.max(0,...rows.map(r=>r.stats[key]));
const maxArray=(rows,key)=>Math.max(0,...rows.flatMap(r=>r.stats[key]));
const sum=(rows,key)=>rows.reduce((s,r)=>s+r.stats[key],0);
const grouped=modes.map(mode=>{
  const rows=raw.runs.filter(r=>r.mode===mode),strikes=rows.flatMap(r=>r.events.filter(e=>e.kind==='strike'));
  const observedGlances=strikes.filter(e=>e.glanceCandidate),acceptedGlances=observedGlances.filter(e=>e.result&&e.woundHookDelta>0);
  const cutPairs=rows.flatMap(r=>r.pairs),drag=cutPairs.filter(p=>p.diagnostic?.regime==='drag'),stuck=cutPairs.filter(p=>p.diagnostic?.regime==='stuck');
  const increasing=cutPairs.filter(p=>p.deltaK>raw.tolerance.energy*(1+p.operations.reduce((s,o)=>s+Math.abs(o.deltaK),0)+Math.abs(p.diagnostic?.deltaKPredicted??0)));
  return {mode,runs:rows.length,woundHooks:sum(rows,'wounds'),finalStoredAppliedWounds:sum(rows,'appliedWounds'),strikeDispatches:sum(rows,'strikes'),nullStrikeDispatches:sum(rows,'nullStrikes'),
    plateBlockedStrikes:sum(rows,'plateBlocks'),acceptedPlateBlockWoundHooks:strikes.filter(e=>e.plateBlocked&&e.woundHookDelta>0).length,
    allKinematicGrazingDispatches:observedGlances.length,acceptedKinematicGrazingWoundHooks:acceptedGlances.length,
    clashCallbacks:sum(rows,'clashes'),freshClashCallbacks:sum(rows,'freshClashes'),cutPairs:cutPairs.length,cutPositiveEnergyPairs:sum(rows,'cutEnergyIncreasePairs'),
    maxCutEnergyIncreaseBeyondToleranceJ:Math.max(0,...increasing.map(p=>p.deltaK)),energyIncreaseExample:increasing.reduce((a,b)=>!a||b.deltaK>a.deltaK?b:a,null),
    sumCutDeltaKJ:sum(rows,'cutActualDeltaKJ'),sumCutDragDeltaKJ:drag.reduce((s,p)=>s+p.deltaK,0),sumCutStuckDeltaKJ:stuck.reduce((s,p)=>s+p.deltaK,0),sumDragBudgetDebitJ:sum(rows,'cutBudgetDebitJ'),
    maxCutDeltaPNs:max(rows,'maxCutDeltaP'),maxCutDeltaLNmS:max(rows,'maxCutDeltaL'),maxCutPredictionErrorJ:max(rows,'maxCutPredictionErrorJ'),maxCutBudgetErrorJ:max(rows,'maxBudgetErrorJ'),
    maxWristCapRatio:maxArray(rows,'maxWristCapRatio'),wristFinalCapViolations:rows.reduce((s,r)=>s+r.stats.wristCapViolations.reduce((a,b)=>a+b,0),0),
    maxExplicitArmTorqueReactionClosureNm:max(rows,'maxExplicitTorqueClosureNm'),maxBodySpeedMps:max(rows,'maxBodySpeedMps'),maxBodyAngularRadps:max(rows,'maxBodyAngularRadps'),
    maxPelvisHeightM:maxArray(rows,'maxPelvisHeightM'),maxJointGapM:maxArray(rows,'maxJointGapM'),maxMainGripJointGapM:maxArray(rows,'maxGripGapM'),maxWholeBodyKJ:max(rows,'peakTotalKJ'),
    falls:rows.map(r=>({scene:r.scene,seed:r.seed,falls:r.stats.falls})),
    cutBoundedChecksApplicable:['cut','combined'].includes(mode),cutBoundedChecksPass:rows.every(r=>r.stats.cutClosurePass&&r.stats.cutPassivityPass&&r.stats.cutBudgetPass),
    actualSourceRuntime:rows.map(r=>({scene:r.scene,seed:r.seed,runtime:r.runtime}))};
});
const distinctInputTraces=raw.configuration.scenes.map(scene=>{
  const rows=raw.runs.filter(r=>r.scene===scene&&r.mode==='unobserved');
  return {scene,rows:rows.map(r=>({seed:r.seed,nativePreparation:r.checkpoint.native,controlPreparation:r.checkpoint.control,inputPreparation:r.checkpoint.input,
    actualInputTraceSHA256:sha(JSON.stringify(r.inputHashes)),actualFullTraceSHA256:sha(JSON.stringify(r.frameHashes))})),
    uniqueActualInputTraces:new Set(rows.map(r=>sha(JSON.stringify(r.inputHashes)))).size,
    note:'Distinct recorded inputs show distinct realized trajectories. Repeats and branch arms are not additional independent random samples; shared seed preparation is intentionally identical within each comparison.'};
});
const review=raw.runs.filter(r=>modes.includes(r.mode)&&r.mode!=='baseline').map(r=>{
  const b=raw.runs.find(b=>b.mode==='baseline'&&b.scene===r.scene&&b.seed===r.seed),s=r.stats,t=b.stats;
  return {mode:r.mode,scene:r.scene,seed:r.seed,newSpeedTripwire:s.maxBodySpeedMps>t.maxBodySpeedMps*3+10,
    newHeightTripwire:s.maxPelvisHeightM.some((h,i)=>h>t.maxPelvisHeightM[i]+.75),newGapTripwire:s.maxJointGapM.some((g,i)=>g>t.maxJointGapM[i]+.1),
    peakWholeBodyKJ:s.peakTotalKJ,baselinePeakWholeBodyKJ:t.peakTotalKJ,maxJointGapM:s.maxJointGapM,baselineMaxJointGapM:t.maxJointGapM,
    maxBodyAngularRadps:s.maxBodyAngularRadps,baselineMaxBodyAngularRadps:t.maxBodyAngularRadps,
    note:'Baseline-relative anomaly review only; inherited prior arm-duel gates, not realism thresholds or controller limits.'};
});
const examples=[];
for(const mode of modes)for(const kind of ['woundedStrike','parry','grazing','plateBlock']){
  let chosen;
  for(const run of raw.runs.filter(r=>r.mode===mode)){
    const event=run.events.find(e=>kind==='parry'?e.kind==='clash'&&e.info.fresh&&e.info.impulse>0:
      e.kind==='strike'&&(kind==='plateBlock'?e.plateBlocked&&e.woundHookDelta>0:kind==='grazing'?e.glanceCandidate&&e.result&&e.woundHookDelta>0:e.result?.severity>0&&e.woundHookDelta>0));
    if(event){
      const frame=run.eventFrames.find(f=>f.frame===event.frame),pair=run.pairs.find(p=>p.frame===event.frame&&(!p.diagnostic||p.diagnostic.key===event.key));
      const bodies=frame?.postPhysicsBodies??[];
      chosen={mode,kind,scene:run.scene,seed:run.seed,frame:event.frame,timeS:event.timeS,event,
        actualCutPairAtSameFrame:pair?{diagnostic:pair.diagnostic,deltaP:pair.deltaP,deltaL:pair.deltaL,deltaK:pair.deltaK,
          applicationPoints:pair.operations.map(o=>o.point),bodyLabels:pair.operations.map(o=>o.label),
          note:pair.diagnostic?'Diagnostic key matches strike key when available.':'Same-frame legacy pair; no per-cut key callback, so not asserted to belong to this strike.'}:null,
        rawNativeContacts:frame?.contacts.map(c=>({labelA:c.labelA,labelB:c.labelB,normal:c.normal,flipped:c.flipped,normalImpulseNs:c.rawNormalImpulseNs,impulses:c.impulses,solverPoints:c.solverPoints}))??[],
        nativeFrameDelta:frame?.nativePhysicsBalance?{deltaP:frame.nativePhysicsBalance.deltaP,deltaL:frame.nativePhysicsBalance.deltaL,deltaK:frame.nativePhysicsBalance.deltaK,
          residualP:frame.nativePhysicsBalance.residualP,residualL:frame.nativePhysicsBalance.residualL,unmeasured:frame.nativePhysicsBalance.unmeasured}:null,
        bodiesAfterNative:bodies.map(b=>({label:b.label,mass:b.mass,P:b.P,L:b.L,K:b.K})),
        note:'Frame native totals include ground/joints/muscles and other contacts; not isolated collision work.'};break;
    }
  }
  examples.push(chosen??{mode,kind,observed:false});
}
const priorArm=JSON.parse(fs.readFileSync(root+'docs/strike/arm_capacity_trial_metrics.json','utf8'));
const priorCut=JSON.parse(fs.readFileSync(root+'docs/strike/cut_reaction_trial_metrics.json','utf8'));
const prior=Object.entries(priorArm.duels.sourceAfter??{}).filter(([p])=>p.startsWith('src/')).map(([p,h])=>({file:p,same:raw.sourceBefore[p]===h,prior:h,current:raw.sourceBefore[p]}));
const interruptedPath='/workspace/halfsword-hybrid-evidence/q05-arm-cut-r2.json.runs.jsonl';
const interruptedRows=fs.readFileSync(interruptedPath,'utf8').split('\n').filter(Boolean).flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}});
const boundedReplay=interruptedRows.map(old=>{const current=raw.runs.find(r=>r.mode===old.mode&&r.scene===old.scene&&r.seed===old.seed);return {mode:old.mode,scene:old.scene,seed:old.seed,
  checkpointExact:JSON.stringify(old.checkpoint)===JSON.stringify(current?.checkpoint),frameTraceExact:JSON.stringify(old.frameHashes)===JSON.stringify(current?.frameHashes),inputTraceExact:JSON.stringify(old.inputHashes)===JSON.stringify(current?.inputHashes)};});
const executedSource=fs.readFileSync('/workspace/halfsword-hybrid-evidence/q05-arm-cut-r3-executed-probe.mjs','utf8');
const currentSource=fs.readFileSync(root+'tools/sim/experiments/arm_cut_interaction_probe.mjs','utf8');
const gamePrefix=s=>s.slice(s.indexOf('function ownState')).split(/fs.writeFileSync\(out,JSON.stringify\(report,null,2\)|\/\/ Serialize rows independently;/)[0];
const simulationPrefixUnchanged=gamePrefix(executedSource)===gamePrefix(currentSource);
const metrics={schemaVersion:1,scope:'Q05 actual runtime cut reaction x explicit shoulder/wrist final cap, bounded instant reactions and actual contact evidence',
  createdUTC:new Date().toISOString(),sourceCommit:raw.baselineCommit,command:raw.command,configuration:raw.configuration,sourceStable:raw.sourceStable,sourceBefore:raw.sourceBefore,sourceAfter:raw.sourceAfter,
  probeSHA256:raw.toolSHA256,executedProbeSource:hashFile('/workspace/halfsword-hybrid-evidence/q05-arm-cut-r3-executed-probe.mjs'),
  reportToolSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),artifact:hashFile(path),checkpointsArtifact:hashFile(raw.finalization?.fullRawCheckpoints??path+'.runs.jsonl'),
  initialManifestArtifact:hashFile(raw.finalization?.initialManifest??path+'.start.json'),finalization:raw.finalization??null,
  serializationRecovery:{log:hashFile('/workspace/halfsword-hybrid-evidence/q05-arm-cut-r3.log'),completedCheckpointRows:raw.runs.length,
    issue:'After all20 executed rows, optional monolithic pretty JSON writer threw RangeError: Invalid string length. Finalizer computes source-after and original gates from full JSONL checkpoints without simulation rerun.',
    executedArchiveMatchesLoadedHash:sha(executedSource)===raw.toolSHA256,currentProbeSHA256:sha(currentSource),simulationPrefixUnchanged,
    writerFix:'Final serialization streams individual rows; existing checkpoint/start paths are also guarded against reuse. Executed source archived; game/runtime/observer prefix byte-identical.',
    byteComparisonScope:'function ownState through final report.pass calculation; excludes pre-run output-file guards and final file serialization.'},
  executionPass:raw.pass,comparisonGuards:raw.comparisons,distinctInputTraces,tolerance:raw.tolerance,modes:grouped,
  inheritedAnomalyReview:review,anyNewAnomalyTripwire:review.some(r=>r.newSpeedTripwire||r.newHeightTripwire||r.newGapTripwire),examples,
  classification:raw.classification,angularReference:'Instant operation L about fixed world origin (0,0,0); body spin and native frame totals retained in raw.',
  reusedEvidence:{armTrialMetrics:hashFile(root+'docs/strike/arm_capacity_trial_metrics.json'),cutTrialMetrics:hashFile(root+'docs/strike/cut_reaction_trial_metrics.json'),
    priorArmRuntimeSourceParity:prior,priorCutSourceParity:priorCut.evidence.filter(e=>typeof e.sourceBefore==='object').map(e=>({file:e.file,
      combatMatches:raw.sourceBefore['src/combat.js']===e.sourceBefore['src/combat.js'],helperMatches:raw.sourceBefore['src/cut_reaction.js']===e.sourceBefore['src/cut_reaction.js']})),
    fixtureRerun:false,reason:'Existing runtime API/source contracts unchanged; no new gain or engine code. Existing fixtures reused; Q05 real integration and observation guards executed.'},
  failedScreen:{log:hashFile('/workspace/halfsword-hybrid-evidence/q05-screen-r1.log'),completedDuels:10,secondsEach:12,
    issue:'All screen duels completed, then final git subprocess spawnSync returned EPERM despite captured stdout. Detailed report was not written; screen log is discovery only, not a passed comparison. New version reads HEAD directly and checkpoints every executed run.'},
  interruptedExpandedArtifact:{log:hashFile('/workspace/halfsword-hybrid-evidence/q05-arm-cut-r2.log'),checkpoints:hashFile(interruptedPath),completedCheckpointRows:interruptedRows.length,
    issue:'Interrupted to remove repeated per-frame force-path byPath books after raw exceeded 129MB in eight rows. Physics/observer/runtime code unchanged; native P/L/K/residuals and exact manual operations retained. Replay rows are repeated evidence, not independent samples.',
    boundedReplay,boundedReplayExact:boundedReplay.every(r=>r.checkpointExact&&r.frameTraceExact&&r.inputTraceExact)},
  conclusions:['Both runtime options can coexist in these executed contacts without instant cutting P/L/passivity/budget violations or measured wrist cap violations.',
    'Legacy cutting can add instant pair K and has unequal/separate-point P/L residuals. Explicit arm final cap does not repair the legacy cut path; budgeted cut repairs its own instant path with either arm mode.',
    'Real weapon contacts, kinematic grazing and armor-block results were observed rather than imposed. Reactive input/contact/wound counts vary and do not show better damage, balance or naturalness.',
    'Keep optional comparison; native work and human/mobile acceptance remain outstanding.'],limitations:raw.limitations};
const destination=root+'docs/strike/arm_cut_interaction_round1_metrics.json';fs.writeFileSync(destination,JSON.stringify(metrics,null,2)+'\n');
const labels={baseline:'기본 (legacy/legacy)',cut:'절삭 단독 (budgeted/legacy)',arm:'팔 단독 (legacy/sharedCap)',combined:'결합 (budgeted/sharedCap)'};
const fmt=x=>Number(x).toPrecision(6);
const table=grouped.map(g=>`| ${labels[g.mode]} | ${g.woundHooks} / ${g.finalStoredAppliedWounds} | ${g.freshClashCallbacks} | ${g.acceptedKinematicGrazingWoundHooks} / ${g.allKinematicGrazingDispatches} | ${g.acceptedPlateBlockWoundHooks} / ${g.plateBlockedStrikes} | ${g.cutPairs} / ${g.cutPositiveEnergyPairs} |`).join('\n');
const instant=grouped.map(g=>`| ${labels[g.mode]} | ${fmt(g.maxCutDeltaPNs)} | ${fmt(g.maxCutDeltaLNmS)} | ${fmt(g.maxWristCapRatio)} | ${g.wristFinalCapViolations} |`).join('\n');
const budget=grouped.filter(g=>g.cutBoundedChecksApplicable).map(g=>`- ${labels[g.mode]}: drag 실제 pair ΔK=${fmt(g.sumCutDragDeltaKJ)}J, 예산 차감=${fmt(g.sumDragBudgetDebitJ)}J; stuck ΔK=${fmt(g.sumCutStuckDeltaKJ)}J. 예측 오차 최대 ${fmt(g.maxCutPredictionErrorJ)}J, drag 예산 오차 최대 ${fmt(g.maxCutBudgetErrorJ)}J.`).join('\n');
const rowTable=raw.runs.filter(r=>r.mode!=='unobserved').map(r=>`| ${r.scene}/${r.seed} | ${r.mode} | ${r.stats.wounds} | ${r.stats.plateBlocks} | ${r.stats.cutPairs} | ${fmt(r.stats.peakTotalKJ)} | ${fmt(r.stats.maxBodyAngularRadps)} | ${fmt(Math.max(...r.stats.maxJointGapM)*1000)} |`).join('\n');
const localMobileRecommended=metrics.executionPass&&!metrics.anyNewAnomalyTripwire&&grouped.find(g=>g.mode==='combined').cutPairs>0;
const document=`# 절삭·명시적 팔 최종 한도 상호작용 1차 (Q05)

2026-10-02. 기준 소스 \`${raw.baselineCommit}\`. [metrics](arm_cut_interaction_round1_metrics.json)에 실제 명령·소스/엔진 해시·접촉점 속도·순간 운동량·충격량·상처·원자료 해시를 보존했다. 실행/관찰/동일 준비/동결 관문 **${metrics.executionPass?'PASS':'FAIL'}**. 결합은 이 표본의 순간 절삭 예산과 측정한 손목 cap을 함께 지켰다. 일반판 채택·전신 물리·자연스러움의 판정은 아니다.

## 실행과 분모

실제 \`harness_m.newRound\`와 양쪽 원래 AI/상처/native 충돌/되튐/회복을 실행했다. 누비옷 기본 상대(롱소드→츠바이핸더), 실제 Heinrich v2 판금 상대(츠바이핸더→롱소드)의 2장면 × seed7/17 × 기본/절삭 단독/팔 단독/결합 = **16 설정 비교 행**과 관찰 없는 기본 4행, 각 준비1초 뒤30초, **20 실행 행**이다. 몸 고정·속도 덮어쓰기·상처 억제·합성 glancing/plate 주입은 없다.

같은 장면/seed의 모든 분기는 준비 native/control/input이 exact이고, 기본 관찰↔무관찰의 전체 trace와 실제 입력도 exact다. 두 seed의 실제 입력 궤적은 ${distinctInputTraces.map(d=>d.scene+' '+d.uniqueActualInputTraces+'개').join(', ')}로 구별했다. 준비 native/input 해시도 metrics에 남겼다. 독립 분모는 장면/seed별 시작 4개이며 분기·관찰 대조·재실행을 새 독립 표본으로 세지 않는다. 옵션은 같은 준비 뒤 실제 \`combat.cutReactionModel\`과 양쪽 \`fighter.armTorqueModel\`에 설정했다. 공개 메뉴 생성부터 켜는 동작은 별도 모바일 검사 대상이다.

후보 개입 뒤 AI는 달라진 물리를 보고 입력을 바꾼다. 상처·맞음·막힘 횟수 비교는 같은 입력/같은 접촉의 피해효율 실험이 아니다. 첫 trace/input 차이 프레임을 각 분기별로 기록했다.

누비옷/판금 장면은 무기 순서와 실제 외형도 다르므로 두 장면 간 차이를 판금 또는 질량만의 효과로 판정하지 않는다. 기본/단독/결합 대조는 각 장면 안에서 한다.

## 실제 사건

‘상처 hook / 종료 상처 기록’은 서로 다른 분모다. 후자는 실제 \`fighter.wounds\`에 종료 시 남은 기록이며 applyWound 호출 총수가 아니다. ‘받아내기’는 실제 \`onClash\` fresh 사건으로 관찰하며 방어 의도 성공으로 해석하지 않는다.

빗맞음 후보는 실제 manifold 법선과 실제 접촉점의 **스텝 전 cached 상대속도**에서 접근 법선속도>0, 속도≥0.5m/s, 법선속도/전체속도≤.25로 분류했다. 이 .25는 관찰용 운동학 분류이며 제어·피해 문턱에 넣지 않았다. hook이 실제 나온 사례와 cooldown/null dispatch를 분리했다. 판금 막힘은 실제 결과의 plate=true, pass=false, severity=0, eff≤thr이며 실제 hook 유무도 분리했다.

| 설정 (절삭/팔) | 상처 hook / 종료 기록 | fresh 칼 접촉 | 빗맞음 hook / 분류 dispatch | 판금 막힘 hook / 결과 dispatch | 절삭 pair / K증가 pair |
|---|---:|---:|---:|---:|---:|
${table}

metrics의 각 설정별 wounded strike/칼 접촉/빗맞음/판금 막힘 예는 실제 frame·point·cached/live 상대속도·법선/접선속도·판정 energy/ephys/severity·raw native normal impulse를 포함한다. native 스텝 전후 관련 강체 P/L/K와 전체 스텝 잔차도 남겼다. 관찰 못한 예는 \`observed:false\`로 표시하며 다른 장면에서 만든 것으로 대체하지 않는다.

## 순간 절삭 장부와 팔 한도

각 실제 수동 impulse 호출의 직전/직후 속도와 관성을 읽었다. 선운동량 P는 kg·m/s, 각운동량 L은 **고정 world origin(0,0,0)** 기준 kg·m²/s다. legacy의 서로 다른 작용점과 0.8배 반작용을 그대로 기록하고, budgeted의 같은 점 ±J·Float32 순간 pair 감소·잔여 Eleft를 대조했다.

| 설정 | 최대 ΔP 크기 N·s | 최대 ΔL 크기 N·m·s | 최종 손목 토크/cap 최대 | 손목 cap 초과 호출 |
|---|---:|---:|---:|---:|
${instant}

${budget}

legacy의 양의 pair ΔK는 실제 수동 절삭 경로에서 관찰됐다. 팔 finalCap 단독으로 이 경로의 운동량/에너지 예산을 수리하지 않는다. budgeted는 팔 방식 두 조건 모두 순간 pair 수동성·P/L·실제 예산 차감을 통과했다. stuck 손실은 drag 예산 차감과 별도다. baseline/arm의 JSON \`cutBoundedChecksPass\` 값은 해당 없는 관문의 기본값이므로 legacy 보존/수동성 통과의 증거로 쓰지 않는다.

실제 어깨/손목 addTorque 반작용 합 최대는 ${fmt(Math.max(...grouped.map(g=>g.maxExplicitArmTorqueReactionClosureNm)))}N·m이다. 손목은 \`debug.wristCap\`과 최종 실제 torque를 직접 대조했다. 어깨 cap의 독립 readout은 이 실행에 없으며 기존 runtime↔finalCap source parity와 관련 파일 해시를 재사용했다. cap이 native 팔꿈치/빈팔/척추/그립 spring까지 포함하지 않는다. 순간 명시적 torque power×dt는 native/총 근육 일이 아니다.

## 궤적과 한계

| 장면/seed | 설정 | hook | 판금 결과 | 절삭 pair | 최고 전체 K J | 최대 몸체 각속도 rad/s | 최대 유효 관절 gap mm |
|---|---|---:|---:|---:|---:|---:|---:|
${rowTable}

기존 팔 결투의 baseline-relative 속도×3+10m/s, 골반높이+.75m, 유효 joint gap+.1m 관찰 문턱에 걸린 후보는 ${review.filter(r=>r.newSpeedTripwire||r.newHeightTripwire||r.newGapTripwire).length}행이다. 이는 자연스러움 기준이나 게임의 숨은 상한이 아니다. 전체 K/상처/접촉이 바뀐 것을 전달 효율 개선으로 부르지 않는다.

최대 각속도도 표에 따로 남겼다. 순간 pair budget 관문이나 위 속도/높이/gap 문턱이 전체 몸체 회전의 자연스러움 또는 부상 뒤 제동을 입증하지 않는다. 회전 peak의 부품/파지/사망 원인별 전수 장부는 이번 실행 범위 밖이다.

native normal/tangent impulse와 solver point는 서로 다른 배열이고 대응하지 않는다. native 반작용·motor/contact/friction 일, native damping/constraint/elastic 저장량은 미측정이다. 전체 스텝의 P/L/K 변화는 발바닥·지지·관절·다른 충돌을 함께 포함하므로 절삭 예산과 같은 장부로 닫지 않는다. 판정용 wound energy는 게임 배율·팔 assist가 들어가며 실제 pair 소모 에너지와 다르다.

결론: **선택형 비교 유지**. ${localMobileRecommended?'이 실행은 기존 URL의 4way 옵션 dispatch·터치/놓기/재입력·재시작·일반 복귀를 로컬 모바일에서 확인할 근거가 된다.':'새 비교판 모바일 확장 전에 실패 관문을 먼저 해결한다.'} 해당 입력 검사는 효능·인간 체감 수락을 대체하지 않는다. 일반판 승격·배포는 하지 않았다.

## 원자료·재현·실행 비용

\`q05-screen-r1.log\`: 12초10행을 완료한 뒤 마지막 git subprocess가 EPERM으로 보고서 저장에 실패했다. 로그는 실제 사건 발견용이며 통과 보고서가 아니다. git HEAD를 직접 읽도록 고쳤다.

\`q05-arm-cut-r2.json.runs.jsonl\`: ${interruptedRows.length}개 완료 checkpoint를 남기고 중단했다. 8행에서129MB를 넘긴 반복 force-path byPath 출력만 줄였다. 완성 r3와 비교한 준비·물리 trace·입력의 반복 ${boundedReplay.length}행은 ${metrics.interruptedExpandedArtifact.boundedReplayExact?'모두 exact':'불일치 있음'}이며 새 독립 표본이 아니다. r3는 시작 manifest를 먼저 저장하고 모든 행을 JSONL로 보존했다. 상세 native frame은 raw JSONL 전체에 있고 bounded JSON에는 첫64개와 예시 사건 frame을 넣었다.

r3의20행을 모두 완료한 뒤 선택형 전체 pretty JSON 저장이 V8 문자열 한도로 실패했다. 시작 manifest와 전체 완료 JSONL에서 source-after 및 원래 비교 관문을 실행해 bounded 결과를 만들었으며 게임은 재실행하지 않았다. 실제 로드한 probe 원문은 \`q05-arm-cut-r3-executed-probe.mjs\`에 보존했고 시작 해시와 일치한다. 이후 마지막 저장을 행별 stream으로 바꾸고 이미 있는 checkpoint/start 경로도 재사용하지 못하게 막았다. 수정 전후 게임/관찰 prefix(ownState 시작→report.pass 계산)는 ${simulationPrefixUnchanged?'byte-identical':'불일치'}이다.

최종20행의 실제 게임 시간 합600초, 실행 wall 합 ${fmt(raw.runs.reduce((s,r)=>s+r.wallSeconds,0))}초(설정/직렬화 포함, 모델 작성 시간 제외). raw와 로컬 소스만 사용했으며 네트워크·원본/상대 조회·core/엔진 수정·커밋/전송은 없다. 기존 fixture suite는 재실행하지 않았다. 해당 source parity와 Q05 실제 관찰/동결 관문을 사용했다.

\`\`\`sh
${raw.command}
node tools/sim/experiments/arm_cut_interaction_finalize.mjs ${raw.finalization?.fullRawCheckpoints.replace('.runs.jsonl','')??path}
node tools/sim/experiments/arm_cut_interaction_report.mjs ${path}
\`\`\`

재실행은 새로운 --out 경로를 사용한다. 기존 원자료를 덮어쓰지 않는다. 소유 파일은 새 \`arm_cut_interaction_*\` 도구와 이 보고서/metrics뿐이며 root가 Q05 대장·다음 작업을 갱신한다.
`;
fs.writeFileSync(root+'docs/strike/arm_cut_interaction_round1.md',document);
console.log(JSON.stringify({destination,executionPass:metrics.executionPass,sourceStable:metrics.sourceStable,distinctInputTraces,modes:grouped,anyNewAnomalyTripwire:metrics.anyNewAnomalyTripwire,exampleCoverage:examples.map(e=>({mode:e.mode,kind:e.kind,observed:e.observed!==false}))}));
