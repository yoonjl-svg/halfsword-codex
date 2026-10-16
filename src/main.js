// ─────────────────────────────────────────────────────────────
//  게임 본체: 화면 준비 → 물리 세계 → 매 프레임 반복(게임 루프)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as CONFIG from './config.js';
import { PHYSICS, ARENA, CAMERA, AI_PROFICIENCY } from './config.js';
import { FINISH as FINISH_SWITCH } from './finish.js'; // 마무리 스위치 entry·mode·vital·plateNeck (주소 ?finishEntry · ?finishMode · ?vital · ?plateNeck)
import { VITAL as VITAL_SWITCH } from './vital_target.js'; // 약한 자세 겨눔 갈래 스위치 (10/12)
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { createStaminaHud } from './stamina_hud.js';
import { createScreenTint } from './screen_tint.js';
import { isDirectGameLink, readJourney, writeJourney } from './journey_save.js';
import { readProfile, recordDuel } from './player_profile.js';
import { InputTrail } from './trail.js';
import { Input, attachStick } from './input.js';
import { LOOKS, getLook } from './looks.js';
import { AI } from './ai.js';
import { CHARACTERS_BY_ID, randomCharacter, pickCharacterWeapon, randomLine, lineSourceOf, aiAtProficiency } from './characters.js';
import { Emotions, EMO_ABILITY } from './emotions.js';
import { WEAPON_LIST, getWeapon, drawWeaponCards, TIER_LABEL, setGripTorque, RETIRED_WEAPONS } from './weapons.js';
import { attachAura } from './aura.js';
import { Particles, haptic, stickDecal, rebuildDecal, disposeDecals, decalWarmMesh } from './effects.js';
import { Sound, BodySounds } from './sound.js';
import { Combat, woundDegree, woundRageMult } from './combat.js';
import { Stages, nextStage, STAGE_IDS, stageFoeId, stageLabel } from './stages.js';
import { installGunFx, clearGunFx, warmGunFx } from './gun_fx.js';
import { GUN_STANCE } from './gun.js';
import { attachMadEyes } from './mad_eyes.js';
import { createSwordTrails } from './sword_trail.js';
import { createDecapFx } from './decap_fx.js';
import { createLimbFx } from './limb_fx.js';
import { attachHands } from './hands.js';
import { PerfMeter } from './perfmeter.js';
import { createRenderCap } from './render_cap.js';
import { createFighterLight } from './fighter_light.js';
import { tickDebris, clearDebris, debrisCount, DEBRIS } from './debris.js';
import { ReviveFx } from './revive_fx.js';
import { PlayerSecretWatch, bindGain } from './secret.js'; // 플레이어 비기 창 (10/9 23:5x — AI 와 같은 조건 함수)
import { PlayerParryGuard } from './parry_button.js'; // 플레이어 막기 버튼 (10/11 — AI 막기와 같은 판단으로 유파 막기 자리로)
import { PlayerUniqueAssist, uniqueStageFor, setClearsOverride, addJourneyClear, sealNotice } from './unique_assist.js'; // 플레이어 고유 동작 강화 (10/13 이어 주기 → 10/14 강화 — docs/strike/unique_player_2026-10-13.md)
import { TRADITIONS, setItalianRhythm, setItalianStride } from './schools.js';
import { createTestRoute } from './test_route.js'; // 테스트 전용 경로 (test.html → ?test=1&weapon=&hero=&foe=random&stage=random, docs/test_route_2026-10-10.md)
import { WhiffDrill } from './whiff_drill.js'; // 시험: 헛스윙 연습 상대 (?foeWhiff=1 — test.html '상대 헛스윙', docs/strike/german_hold_2026-10-15.md §7)
import { configureStageObstacle, clampStageCamera, stageStartZ } from './arena_obstacle.js'; // 잠든 습지 가운데 석상: 충돌체 · 시작 비킴 · 카메라 보호 (docs/import/sluice_port_2026-10-14.md)
import { configureWetlandMovement } from './wetland_ground.js'; // 잠든 습지 진흙 웅덩이 감속 (다른 무대는 배율 1)
import { setSupportFloor } from './gait.js'; // 발 체중 받침은 바닥 콜라이더 접촉만 (10/14 — 벽·석상에 발이 닿은 힘은 받침이 아님)
import { terrainForStage, createTerrainGround, applyTerrainHazards } from './etna_ground.js'; // 화산섬 비탈 땅(삼각형 그물 바닥 · 땅 따라 올린 벽 · 용암 화상) — 지형 없는 무대는 아래 평평한 바닥 그대로 (docs/import/volcano_port_2026-10-14.md)
import { followState, followReset, followStep, retreatStep, basePose, keepDistance, sweepParams, sweepPose, settlePose } from './camera_rig.js'; // 카메라 셈: 따라가기 · 판 시작(무대 훑기 · 다시 겨루기 내려앉기) — 10/15, docs/strike/camera_open_2026-10-15.md (노드 측정 도구와 같은 함수)

await RAPIER.init();

// 테스트용 URL 파라미터: ?weapon=monohoshizao&foeWeapon=chicken (무기 id는 weapons.js의 WEAPONS 키,
//  Fighter 생성자가 알아서 getWeapon()으로 찾는다. 없으면 기본 롱소드)
const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&')); // 주소에 ? 를 두 번 써도(…?r2p=1?weapon=…) 뒤쪽 인자까지 읽는다 (사장님 10/8 08:30 링크 입력 실수 대비)
const JOURNEY_SAVE_ENABLED = !isDirectGameLink(params);
let pendingJourney = null;
if (params.has('stamina')) CONFIG.STAMINA.on = params.get('stamina') !== '0';
const staminaHud = createStaminaHud(document.getElementById('staminaHud'));
const screenTint = createScreenTint();
// 주인공은 판마다 무기 카드 세 장 중 하나를 골라 받는다 (아래 "무기 뽑기"). 주소에 ?weapon=을 적으면 뽑기 없이 그 무기로 고정.
//  진짜 엑스칼리버는 주인공만 받을 수 있고, 복제품은 하인리히 몫이라 뽑기에서 뺀다
const PLAYER_WEAPON_POOL = WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // 빼 둔 무기(에스톡·세이버·팔쉬온 — 사장님 10/13 23:2x)는 카드에 안 나온다
const FIXED_WEAPON = params.get('weapon');
const testRoute = createTestRoute(params); // 인자가 없으면 아무것도 바꾸지 않는다
// 테스트용 ?morgTorque=33 : 모르겐슈테른 손목 겨눔 토크 상한(기본 22 = 한손 무기 공통, 확인표 169)을 이번 실행에만 바꾼다 — 사장님 비교용, 저장하지 않는다
const morgTorque = +params.get('morgTorque');
if (morgTorque > 0) getWeapon('morgenstern').controlOverrides.maxAimTorque = morgTorque;
// 테스트용 ?cutReact=same|full|legacy : 절삭 끌림 반작용 방식(config STRIKE.cutReact, 기본 legacy)을 이번 실행에만 바꾼다 — 사장님 비교용(10/8 타격 B 질문)
const cutReact = params.get('cutReact');
if (cutReact === 'same' || cutReact === 'full' || cutReact === 'legacy') CONFIG.STRIKE.cutReact = cutReact;
// R2′ 팔 단계 인자(10/8): ?trunkArc= ?trunkArcSpeed= ?trunkFollow= ?servoLead= ?vertLead= ?r2pScope=player|all ?anchorYawMax= ?twoHandCap= ?chain=legs ?pushAtFoot= ?cutStep= — 기각된 ?swing=arc ?handFollow= ?servoLagRelease= ?dropArc= ?pitchArc= 는 17:20 코드에서 지움
// ?r2p=1 : R2′ 팔 단계 묶음(trunkArc 2 · trunkFollow 0.5 · 한손 servoLead 0.5) — 10/8 17:15 부터 플레이어·AI 모두 본판 기본이라 1 은 확인용. `?r2p=off` 가 묶음 전 물리(세로 follow 는 `?vertLead=0`, 닻 상한은 `?anchorYawMax=0`, 두 손 상한은 `?twoHandCap=22` 로 따로)
//  ?r2p=legs 는 chain legs(발 힘쌍 A)+걸음 채널까지, ?r2p=all 은 범위 all(이제 기본과 같음; 옛 범위는 ?r2pScope=player). 개별 인자가 뒤에 오면 그것이 덮는다
const r2pAll = params.getAll('r2p'); // ?r2p=1&r2p=legs 처럼 여러 번 와도 전부 적용 (legs·all 은 1 을 포함한다)
if (r2pAll.includes('off') || r2pAll.includes('0')) { CONFIG.BODY.trunkArc = 0; CONFIG.BODY.trunkFollow = 0; CONFIG.ARM.servoLead = 0; } // 10/8 14:40 본판 기본이 묶음(플레이어만)이 된 뒤 비교용: 전 물리
if (r2pAll.some((v) => v === '1' || v === 'legs' || v === 'all')) { CONFIG.BODY.trunkArc = 2; CONFIG.BODY.trunkFollow = 0.5; /* 10/8 WA5: 1 이면 두 손 무기 AI 첫 베기 25 → 17/30 (몸이 더 돌아 칼이 짧아짐), 0.5 면 24/30 */ CONFIG.ARM.servoLead = 0.5; /* 10/8 T2 (c): 한손 서보 겨눔 앞세움 — 모르겐슈테른 8.8 → 9.7 m/s, 두 손 무기엔 안 걸림 */ if (r2pAll.includes('legs')) { CONFIG.BODY.chain = 'legs'; CONFIG.GAIT.pushAtFoot = 1; CONFIG.GAIT.cutStep = 1; } /* 10/8 T3: legs 는 걸음 조율 채널 A·B 와 함께 */ if (r2pAll.includes('all')) CONFIG.BODY.r2pScope = 'all'; }
const r2pScope = params.get('r2pScope');
if (r2pScope === 'player' || r2pScope === 'all') CONFIG.BODY.r2pScope = r2pScope;
const twoHandCap = +params.get('twoHandCap');
if (twoHandCap > 0 && params.has('twoHandCap')) setGripTorque('two-hand', twoHandCap); // 10/8 16:20 두 손 서보 상한 26 본판 뒤 비교용(22 = 전 값)
const vertLead = +params.get('vertLead');
if (vertLead >= 0 && params.has('vertLead')) CONFIG.ARM.vertLead = vertLead;
const anchorYawMax = +params.get('anchorYawMax');
if (anchorYawMax >= 0 && params.has('anchorYawMax')) CONFIG.BODY.anchorYawMax = anchorYawMax; // 실험(10/8 15:10): 닻 yaw 모터 토크 상한 N·m, 0 = 오늘
const getupLead = +params.get('getupLead');
if (getupLead >= 0 && params.has('getupLead')) CONFIG.BODY.getupLead = getupLead; // 일어서기 다리 차례(10/8 18:26 본판 기본 1·lag 0.5, 확인표 194): `?getupLead=0` = 전 물리(두 다리 함께)
const motionLib = +params.get('motionLib');
if (motionLib >= 0 && params.has('motionLib')) CONFIG.SKILL.motionLib = motionLib; // 동작 라이브러리(무기 PM) 본판 스위치 — 10/8 18:50 기본 1(사장님 '적용', 확인표 34). `?motionLib=0` = 전 물리
const schoolArt = +params.get('schoolArt');
if (schoolArt >= 0 && params.has('schoolArt')) CONFIG.SKILL.schoolArt = schoolArt; // 유파 자료(10/9 ②③): 기본 1(사장님 10/9 01:5x '스위치 켜') = 유파 가중치·맞받아치기·새 기술(燕返し) 켬. `?schoolArt=0` = 그 전 판(이름·쉴 자세는 늘)
if (params.has('secret')) CONFIG.SKILL.schoolSecret = +params.get('secret') ? 1 : 0; // 유파 비기(10/9 유파 설계 v3): 기본 1, `?secret=0` = 비기 없는 판 (docs/strike/school_secret_2026-10-09.md)
if (params.has('playerSecret')) CONFIG.SKILL.playerSecret = +params.get('playerSecret') ? 1 : 0; // 플레이어 비기(10/9 23:5x): 기본 1, `?playerSecret=0` = 끔 (docs/strike/player_secret_2026-10-09.md)
if (params.has('instant')) CONFIG.SECRET.instant = +params.get('instant') ? 1 : 0; // 일본 비기 순간 베기(10/10, secret_instant.js): 기본 1, `?instant=0` = 10/9 길(담았다 터뜨림) 대조
const SECRET_SLOWMO = params.get('slowMo') !== '0';
if (['v1', 'parry'].includes(params.get('cnSecret'))) CONFIG.SECRET.cnSecret = params.get('cnSecret'); // 중국 비기 판(10/11): 기본 'parry'(막기 연환 — docs/strike/parry_combo_secret_2026-10-11.md), `?cnSecret=v1` = 連環三擊
if (['v1', 'parry'].includes(params.get('deSecret'))) CONFIG.SECRET.deSecret = params.get('deSecret'); // 독일 비기 판(10/11): 기본 'parry'(막기 연환 — 감아 들기), `?deSecret=v1` = Versetzen
if (params.has('parryAssist')) CONFIG.SKILL.parryAssist = Math.max(0, Math.min(3, +params.get('parryAssist') || 0)); // 플레이어 막기 버튼 거듦 단계(10/12 — parry_button.js, 확인표 990): `?parryAssist=0` = 끔(10/11 판) · 1 무게 보정 · 2 + 일찍 읽기 · 3 + 자리 덧힘
if (params.has('kron')) CONFIG.SKILL.deKron = +params.get('kron') ? 1 : 0; // 독일 왕관 막기 자리(10/11 22:2x 사장님 기본): `?kron=0` = 전 자리(머리 위 = 긴 자세)
for (const k of ['cnBongdu', 'cnBuffer', 'cnFast']) if (params.has(k)) CONFIG.SECRET[k] = +params.get(k) ? 1 : 0; // 중국 막기 연환 사람이 쓰게 (10/12 — docs/strike/cn_combo_play_2026-10-12.md): 봉두세 자리 · 미리 받기 · 빠른 연환. 기본 1, `?cnBongdu=0` · `?cnBuffer=0` · `?cnFast=0` = 전
if (+params.get('cnFastShare') > 0) CONFIG.SECRET.cnFastShare = +params.get('cnFastShare'); // 빠른 연환 비율(빠르기·잔상 같이 — 기본 0.5): 사장님이 한 값만 바꿔 보시게 `?cnFastShare=0.65`
if (params.get('cnCombo') === '2') CONFIG.SECRET.cnCombo = 2; // 연환 3 연격(10/12 08:2x): 기본 3, `?cnCombo=2` = 전 두 수
if (params.has('cnPath')) CONFIG.SECRET.cnPath = +params.get('cnPath') ? 1 : 0; // 연환 길 그때 계산(10/12 03:0x): 기본 1, `?cnPath=0` = 패드 길
if (['cutFirst', 'thrustFirst'].includes(params.get('cnGeojeongOrder'))) CONFIG.SECRET.cnGeojeongOrder = params.get('cnGeojeongOrder'); // 거정세 연환 순서: 기본 원문대로 벰 → 찌름
if (params.has('secretReach')) CONFIG.SECRET.secretReach = +params.get('secretReach') ? 1 : 0; // 비기 동안 팔 끝까지 펴짐(10/12 03:0x·03:1x): 기본 1, `?secretReach=0` = 평소 제한
if (params.has('iaiRise')) CONFIG.SECRET.iaiRise = +params.get('iaiRise') ? 1 : 0; // 고노센 올려베기·한 손(10/12 03:2x): 기본 1, `?iaiRise=0` = 가로 휩쓸기·두 손
if (params.has('kronH')) CONFIG.SKILL.deKronH = +params.get('kronH') ? 1 : 0; // 왕관 손·칼끝 자리(10/12 08:2x): 기본 1 = 쓸어 고른 자리, `?kronH=0` = 00:1x 값
if (['true', 'pad'].includes(params.get('kronShape'))) CONFIG.SKILL.deKronShape = params.get('kronShape'); // 왕관 꼴(10/12 00:1x 사장님): 기본 'true'(진짜 왕관 꼴 — 코등이 가로), `?kronShape=pad` = 10/11 패드 꼴 (docs/strike/kron_shape_2026-10-12.md)
if (params.has('bind')) CONFIG.BIND.natural = +params.get('bind') ? 1 : 0; // 자연 바인드 실험(10/11 — docs/strike/natural_bind_2026-10-11.md): 기본 0, `?bind=1` = 칼끼리 덜 튕기고 더 물림 · 막힌 칼을 노리던 자리로 밂 · 독일 느낌 · 넓은 맞부딪힘
if (['v4', 'flow', 'gilmok'].includes(params.get('ibSecret'))) CONFIG.SECRET.iberianSecret = params.get('ibSecret'); // 이베리아 비기 판(10/11): 기본 'gilmok'(v6 길목 지키기 — docs/strike/iberian_secret_v6_2026-10-11.md), `?ibSecret=flow` = v5 멈추지 않는 흐름, `?ibSecret=v4` = 10/10 비켜 서며 크게 가로베기
if (['chest', 'head', 'headTop'].includes(params.get('gilAim'))) CONFIG.SECRET.gilmokAim = params.get('gilAim'); // 길목 한 칼 겨누는 자리 (사장님 결정 10/11 13:5x — 기본 config.js SECRET.gilmokAim) · 확인용 `?gilAim=head`
if (params.has('iai')) CONFIG.SECRET.iai = +params.get('iai') ? 1 : 0; // 고노센 = 발도(10/10 02:3x): 기본 1, `?iai=0` = 순간이동 고노센
if (params.has('uniqueAssist')) CONFIG.UNIQUE_ASSIST.on = +params.get('uniqueAssist') ? 1 : 0; // 플레이어 고유 동작 강화(10/14 — 10/13 이어 주기): 기본 1, `?uniqueAssist=0` = 끔 (기술 이름 알림도 없음)
// 테스트 경로도 기본 켬 (사장님 10/14 03:1x '테스트에서 켜' — 10/14 02:0x 부터 '궤적은 내 것' 강화 판으로 다시 만드는 동안 꺼 두었던 것). 끄려면 `?uniqueAssist=0`
if (params.has('uniqueEnhance')) CONFIG.UNIQUE_ASSIST.enhance = Math.max(0, +params.get('uniqueEnhance') || 0); // 고유 동작 강화 세기(10/14): 기본 1 · 0 = 기술 이름 알림만 · 0.5 = 절반 (걸음·몸·끝 힘 한꺼번에)
const UNIQUE_STAGE_PARAM = params.get('uniqueStage'); // 고유 동작 해금 단계 덮어쓰기 `?uniqueStage=0..5` (5 = 비기까지) — 모든 유파를 그 단계로 (본판·테스트 경로 모두). 없으면 테스트 경로 4 · 본판은 손에 든 무기 유파의 인장 수
const FOE_PROF_PARAM = params.get('foeProficiency'); // 시험: 그 판 상대의 숙련도 덮어쓰기 `?foeProficiency=0..5` (실력 숫자 이름·고유 동작 거르기·5 비기 모두 — characters.js aiAtProficiency). 없거나 범위 밖이면 인물 시트 값
const FOE_PROF = /^[0-9]$/.test(FOE_PROF_PARAM ?? '') && +FOE_PROF_PARAM <= AI_PROFICIENCY.max ? +FOE_PROF_PARAM : null;
setClearsOverride(params.get('clears')); // 시험용 `?clears=N`: 여정에서 깬 무대 수를 N 으로 (저장소는 건드리지 않는다 — 그 판 동안 깬 수도 여기에만 더함)
// 마무리 스위치 (10/12 샛별 가져오기 2차 — docs/import/saetbyeol_round2_2026-10-12.md, 기본은 둘 다 끔):
//  `?finishEntry=low` = 낮은 상대 진입(몸 높이로 내려찍기를 연다, finish_entry.js) · `?finishMode=power25` = 즉사 대신 판정 에너지 2.5 배 + 갑옷 판정
if (['down', 'low', 'downlow', 'auto'].includes(params.get('finishEntry'))) FINISH_SWITCH.entry = params.get('finishEntry'); // downlow = 고친 판 (큰 쓰러짐은 지금처럼 + 일어나는 중 낮은 몸) · 기본 auto (10/12)
//  10/12 약한 자세 겨눔 묶음 (docs/import/saetbyeol_vital_2026-10-12.md): `?vital=0` = 끔 (진입도 'down' 으로 — 추천 기본 켬) · `?plateNeck=1` = 판금 상대 찍기를 목 한 점으로 (10/1 C, 10/12 기본 끔)
if (params.get('vital') === '0') FINISH_SWITCH.vital = false;
if (params.get('vital') === '1') FINISH_SWITCH.vital = true;
if (params.get('plateNeck') === '1') FINISH_SWITCH.plateNeck = true;
if (params.get('plateNeck') === '0') FINISH_SWITCH.plateNeck = false;
for (const [q, k] of [['vitalAi', 'aiCut'], ['vitalThrust', 'thrust'], ['vitalCut', 'playerCut']]) if (['0', '1'].includes(params.get(q))) VITAL_SWITCH[k] = params.get(q) === '1'; // 묶음 갈래: AI 목 가로 베기 · 찌르기 목·얼굴·머리 + 간격 맞추기 · 플레이어 베기 겨눔 보정
if (['power25', 'kill'].includes(params.get('finishMode'))) FINISH_SWITCH.mode = params.get('finishMode'); // 10/12 기본 power25 · kill = 9/30 즉사
// 10/13 내려찍기 동작 (docs/strike/finish_plunge_2026-10-13.md): `?finishLift=0` = 전 동작(더 높이 들기·찍는 동안 힘 배율 끔) · `?finishAim=chest` = 가슴 쪽 몸 점 (기본 torso = 몸통 선)
if (params.get('finishLift') === '0') FINISH_SWITCH.lift = false;
if (params.get('finishLift') === '1') FINISH_SWITCH.lift = true;
if (['chest', 'torso'].includes(params.get('finishAim'))) FINISH_SWITCH.aim = params.get('finishAim');
if (params.has('schoolGait')) CONFIG.GAIT.school = +params.get('schoolGait') ? 1 : 0; // 유파 걸음(10/10 비싼 층, gait.js gaitParams): 기본 1, `?schoolGait=0` = 모든 유파 같은 걸음(전 판)
if (params.has('strideRule')) CONFIG.GAIT.strideRule = +params.get('strideRule') ? 1 : 0; // 보폭 규칙(10/15 20:3x 사장님 — 유파 보폭 상한 0.62 × k · 박자 2.05 ÷ k, 최고 빠르기 같음 · docs/strike/stride_rule_2026-10-15.md): 기본 1, `?strideRule=0` = 옛 유파 값
if (params.has('jpSteady')) CONFIG.BALANCE.schoolSteady = +params.get('jpSteady') ? 1 : 0; // 일본 보법 버티기(10/15 — 흔들림 × 0.75, fighter.js swayScale): 기본 1, `?jpSteady=0` = 끔
// 이탈리아 박자 걸음 셈(10/15 — schools.js ITALIAN_GAIT.rhythm · setItalianRhythm, docs/strike/italian_rhythm_2026-10-15.md §8 · §9 · §10): 기본 디딤 셈 2 + 2 · ×1.5(보통 디딤 둘 → 빠른 디딤 둘 — 사장님 10/15 15:1x 2 + 2 · 19:3x '50%로 해'),
//  15:1x 판(×1.3) 비교 `?itRhythm=2+2x1.3`('N+MxK' = 배율 손으로) ·
//  지난 판 비교(그때 ×1.5): `?itRhythm=4+2`(13:2x 판) · `?itRhythm=3+2` · `?itRhythm=3` = 옛 짝 셈 3 + 1(10/15 오전 판 — 짝걸음 한 짝 = 한 걸음) · `?itRhythm=4` = 옛 짝 셈 4 + 1 · `?itRhythm=0` = 끔
if (params.has('itStride')) setItalianStride(params.get('itStride')); // 이탈리아 보폭 박자(10/15 22:1x · 22:5x — 짧은 디딤 둘 0.8 + 몸 ×1.3 → 긴 디딤 둘 1.1): `?itStride=0` = 22:0x 판(속도 ×1.5 · 계수 0.7) · `?itStride=a,b[,c]` = 짧은·긴 계수·짧은 디딤 빠르기(예 0.8,1.1 = 보폭만 · 0.7,1.2 · 0.8,0.8,1.5)
if (params.has('itRhythm')) setItalianRhythm(params.get('itRhythm'));
if (params.has('itGait')) CONFIG.GAIT.itEven = params.get('itGait') === 'old' ? 0 : 1; // 이탈리아 고른 바탕 걸음(10/15 19:3x 사장님 '이탈리아 보법 자체가 이미 불균질' — 고른 짝걸음, docs/strike/italian_rhythm_2026-10-15.md §10): 기본 켬, `?itGait=old` = 옛 짝걸음('따·닥 + 쉼')
if (params.has('deChase')) CONFIG.GAIT.deChase = +params.get('deChase') ? 1 : 0; // 독일 간격 잡기의 빠른 디딤(10/15 — 상대 헛침 뒤 앞 두 걸음 빠른 걸음, docs/strike/german_chase_2026-10-15.md · 그때 이름 '따라 들어가기'): 기본 1, `?deChase=0` = 끔(잡기도 없음)
if (params.has('deHold')) CONFIG.GAIT.deHold = +params.get('deHold') ? 1 : 0; // 독일 간격 잡기의 잡기(10/15 18:0x — 칼이 제대로 들어가는 거리 contact 에서 서고 0.6 s 앞 몫 0 · 스틱 놓았다 밀면 풀림 · 플레이어만, docs/strike/german_hold_2026-10-15.md): 기본 1, `?deHold=0` = 끔(빠른 디딤만 — 지금 판)
if (params.has('cnLight')) CONFIG.GAIT.cnLight = +params.get('cnLight') ? 1 : 0; // 동방 보법 가벼운 발(10/15 18:3x — 발로 내는 가속 한도의 보통 걸음 몫 × 1.5, 최고 빠르기 그대로 · 사람·AI 같이, docs/strike/cn_light_feet_2026-10-15.md): 기본 1, `?cnLight=0` = 끔(지금 판)
if (params.has('cnLightAi')) CONFIG.GAIT.cnLightAi = +params.get('cnLightAi') ? 1 : 0; // 동방 AI 걸음 박자(10/15 — 가벼운 발 몸의 AI 는 공격 꼴에서만 가벼운 발 · 간 보기·막기·물러남은 옛 가속, docs/strike/cn_light_feet_2026-10-15.md §7): 기본 1, `?cnLightAi=0` = 끔(사람·AI 같이 — 지금 판)
if (params.has('cnAiTune')) CONFIG.GAIT.cnAiTune = +params.get('cnAiTune') ? 1 : 0;
if (params.has('attackTempo')) CONFIG.STAMINA.attackTempo = params.get('attackTempo') === '1';
if (params.get('walk') === 'old') Object.assign(CONFIG.GAIT, { moveSpeed: 2.3, backFactor: 0.45, sideFactor: 0.31 }); // 걷기 빠르기 전 값(10/15 사장님 결정 전 — 앞 2.3 · 뒤 × 0.45 · 옆 × 0.31) 비교용: `?walk=old`
if (params.has('burstDe')) CONFIG.GAIT.burstDe = +params.get('burstDe') ? 1 : 0; // 박차기는 독일 보법(10/15 20:4x 사장님 '박차기는 독일 보법으로 넣어' — 뒤 박차기는 독일 유파만 · 옆은 이베리아만 그대로 · 그 밖 유파 없음, docs/strike/step_burst_2026-10-15.md §10): 기본 1, `?burstDe=0` = 지금 판(이탈리아 빼고 모든 유파)
if (params.has('stepBurst')) CONFIG.GAIT.stepBurst = +params.get('stepBurst') ? 1 : 0; // 첫 걸음 박차기(10/15 — 서 있다가 뒤·옆으로 떼는 첫 걸음만 빠름, 플레이어만 · 이탈리아 빼고 · 옆은 이베리아만(10/15 15:1x), docs/strike/step_burst_2026-10-15.md): 기본 1, `?stepBurst=0` = 끔
// 전체 빠르기 손잡이 (10/10 사장님 '모티브 게임은 모든 움직임이 다 빠르다'): `?tempo=1.35|1.5|1.7` — 게임 시간 배율(실제 1 초에 물리 스텝을 더 돌림, 비기 느린 화면의 반대 꼴).
//  기본 1 = 오늘 그대로. 시뮬 도구에는 닿지 않는다(이 파일만). 프레임마다 스텝 상한(PHYSICS.maxStepsPerFrame)은 그대로 — 느린 폰에선 상한에 걸리면 그만큼 덜 빨라진다
const TEMPO = Math.min(2, Math.max(0.5, +(params.get('tempo') ?? 1.1) || 1.1)); // 기본 1.1 (사장님 10/10 05:1x '기본 템포 1.1로'), 전 값 `?tempo=1` // 결정타 연출(비기 터뜨림 순간 화면 시간 늦춤, CONFIG.SECRET.slowMo): `?slowMo=0` = 끔
// 판 시작 카메라 · 따라가기 (10/15 사장님 — docs/strike/camera_open_2026-10-15.md, 확인표 1560~1579): `?openSweep=0` = 9/30 판 시작(정지 2 s · 조금 높고 먼 자리에서 내려오기 — 다시 겨루기도 같음)
//  `?camFollow=old` = 예전 따라가기(무게중심 follow 5 → 카메라 자리 6 두 번 거름 · 최소 거리·물러날 때 올리기 없음). 둘 다 쓰면 10/15 오전 판과 거의 같다
const OPEN_SWEEP = params.get('openSweep') !== '0';
const CAM_OLD = params.get('camFollow') === 'old';
const schoolRest = params.get('schoolRest');
if (schoolRest != null) CONFIG.SKILL.schoolRest = schoolRest; // 유파 쉴 자세 비교(10/9 안 A 결정 뒤): `?schoolRest=pflugR` = 안 B(쟁기 자리), 빈 값 = 유파 값(中段·中平)
const oneVersatile = params.get('oneVersatile');
if (oneVersatile === 'mixed' || oneVersatile === 'thrust' || oneVersatile === 'cut') CONFIG.SKILL.oneVersatileTable = oneVersatile; // 한손 두루(청강검) 자세표(10/9 바닥 고침): 기본 'mixed'(섞은 표, 사장님 확인 전). `?oneVersatile=thrust` = 그 전 판(찌르기 표) · `cut` = 세이버 표(안 B)
const getupLag = +params.get('getupLag');
if (getupLag >= 0 && params.has('getupLag')) CONFIG.BODY.getupLag = getupLag; // 뒷다리가 기다리는 몫(riseTime 비율, 기본 0.5)
const pushAtFoot = +params.get('pushAtFoot');
if (pushAtFoot >= 0 && params.has('pushAtFoot')) CONFIG.GAIT.pushAtFoot = pushAtFoot;
const cutStep = +params.get('cutStep');
if (cutStep >= 0 && params.has('cutStep')) CONFIG.GAIT.cutStep = cutStep;
const servoLead = +params.get('servoLead');
if (servoLead >= 0 && params.has('servoLead')) CONFIG.ARM.servoLead = servoLead;
// 손잡이 찍기 시제품(10/9, docs/strike/pommel_strike_2026-10-09.md): `?pommel=1` = persona.close 가 있는 AI 는 밀치기 뒤 베기 대신 폼멜로 찍는다(CLOSE.pommelAll).
//  `?pommel=tap` = 그에 더해 플레이어가 붙은 거리(CLOSE.pommelDist)에서 탭하면 찌르기 대신 찍는다. 없으면 오늘 그대로
const pommelKnob = params.get('pommel');
if (pommelKnob === '1' || pommelKnob === 'tap') CONFIG.CLOSE.pommelAll = true;
const pommelTap = pommelKnob === 'tap';
const trunkArc = +params.get('trunkArc');
if (trunkArc >= 0 && params.has('trunkArc')) CONFIG.BODY.trunkArc = trunkArc;
const trunkFollow = +params.get('trunkFollow');
if (trunkFollow >= 0 && params.has('trunkFollow')) CONFIG.BODY.trunkFollow = trunkFollow;
const trunkArcSpeed = +params.get('trunkArcSpeed');
if (trunkArcSpeed > 0) CONFIG.BODY.trunkArcSpeed = trunkArcSpeed;
if (CONFIG.JOINTS.presets[params.get('joints')]) CONFIG.JOINTS.mode = params.get('joints'); // 칼 팔 관절 가동 범위 교정 시제품(10/9, docs/motion/joint_range_2026-10-09.md): `?joints=off|anat|hard|soft|reach`, 없으면 기본 anat(켬)
const chainParam = params.get('chain');
if (chainParam === 'legs' || chainParam === 'anchor') CONFIG.BODY.chain = chainParam;
let lastPlayerWeapon = null; // 지난 판에 고른 무기 (다음 판 카드에서 되도록 뺀다)
/** 이번 판 내 카드 두 장 (맨 오른쪽 세 번째 칸은 상대 무기라 여기서 뽑지 않는다): 뽑기 목록에서 겹치지 않게 고르게 뽑는다
 *  (지난 판 무기는 되도록 빼서 같은 무기가 두 판 연속 나오지 않게).
 *  테스트용 ?cards=excalibur,rubber_chicken 으로 두 장을 정할 수 있다 (세 번째 id 를 적어도 버린다: 상대 카드는 상대 무기다) */
function drawCardIds() {
  // 모르는 id 는 버리고(getWeapon 이 롱소드로 바꿔 버린다) 서로 다른 두 장일 때만 쓴다
  const forced = (params.get('cards') || '').split(',').filter((id) => id && getWeapon(id).id === id).slice(0, 2);
  if (forced.length === 2 && forced[0] !== forced[1]) return forced;
  // 등급을 먼저 뽑고 그 등급 안에서 고른다 (사장님 결정: 커먼 40 · 레어 27 · 에픽 16 · 레전드 5 · 쓰레기 7 · ??? 5, weapons.js TIER_DRAW)
  return drawWeaponCards(PLAYER_WEAPON_POOL, 2, { exclude: lastPlayerWeapon });
}

// ── 설정 (브라우저에 저장) ──
//  메뉴에 남은 설정은 하나 — 화면 60 fps 제한 (10/10 19:2x 사장님 '시작 전 설정에서도 뺄 기능이 많아' — docs/ui/hud_type_system_2026-10-10.md §13).
//  상대 난이도 줄은 뺐다 (사장님 결정 10/13 '상대 난이도는 메뉴에서 빼자' — 상대의 실력은 인물 숙련도가 정한다, characters.js). 저장된 옛 difficulty 값은 읽지 않는다.
//  늘 켬으로 고정해 줄을 지운 것: 자세 이름 · 피 · 조작 흔적 · 유파 기술 알림 · 소리 · 비기 화면 번쩍임 · 비기 카메라 연출.
//  주소 인자로만 켜는 것: 픽셀 모드(실험, ?pixel=1). 기울기 이동은 기능째 지웠다 (터치는 조이스틱만).
//   모든 기술 이름 보기(디버그 ?techCueAll=1)는 상대 기술을 보이던 것이라 10/14 03:3x 상대 기술 표기를 없앨 때 같이 걷어냈다 (docs/ui/hud_type_system_2026-10-10.md §15).
const DEFAULTS = { skill: '0.7', fpsCap: true };
const PIXEL_MODE = params.get('pixel') === '1'; // 실험: 작은 해상도로 그려 크게 늘린다 (도트 그래픽처럼)
const settings = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('gladiator-settings') || '{}');
  // 남은 설정만 읽는다: 지운 설정(옛 legWeight · corr · corrTip · 위의 늘 켬 7 개 · 픽셀 · 기울기 moveMode·invertTilt)의 저장 값은 무시 — 끈 채 저장돼 있어도 켜진다
  for (const k of ['fpsCap']) if (k in saved) settings[k] = saved[k];
  // 검술 보정은 한 단계(0.7)만 — 사장님 10/8 21:5x "플레이어에겐 끔 약 보통 강 같은 구분이 필요 없어. 한 단계로 기본 적용": 메뉴를 뺐고 저장된 옛 값(0·0.4·1)도 무시한다. AI 는 인물 숫자(persona.level.skill)
} catch {
  /* 저장소를 못 쓰면 기본값으로 */
}
const saveSettings = () => {
  try {
    localStorage.setItem('gladiator-settings', JSON.stringify(settings));
  } catch {
    /* 무시 */
  }
};

// 보이지 않는 받침(GAIT.assist 0.2)·붙잡기 반사(GAIT.catchMode)·다리 근육 상한(BODY.legTorque)은 config.js 에서만 온다
//  (탐색판 주소 스위치 ?assist ?catch ?legs 는 값이 정해져(사장님 10/1 21:10 받침 0.2·반사 켬·다리 그대로) 본판에서 뺐다, 10/1 22:05)

// ── 겉모습 미리보기 (모델링 PM 라운드): 마음에 안 들어도 지우지 않고 archive에 쌓아 둔 옛 버전들을
//  주소창에서 바로 볼 수 있게 한다. 플레이어 외형에는 적용하지 않는다(감독 지시: 주인공은 그대로).
//  ?look=margarethe:v0  : 그 캐릭터를 상대로 고정하고 그 버전을 입힌다 (버전 생략 시 지금 버전)
//  ?lookv=0              : 이번에 고른 상대가 누구든 그 버전을 입힌다 (?foe=와 함께 써도 됨)
let lookPreviewId = null;
let lookPreviewVersion = null;
const lookParam = params.get('look');
if (lookParam) {
  const [id, ver] = lookParam.split(':');
  lookPreviewId = id;
  lookPreviewVersion = ver ? (ver.startsWith('v') ? ver : `v${ver}`) : null;
}
const lookvParam = params.get('lookv');
const lookvVersion = lookvParam != null ? (lookvParam.startsWith('v') ? lookvParam : `v${lookvParam}`) : null;

// ── 상대 캐릭터 고르기 (테스트/데모용 최소 기능. 정식 선택 UI는 나중에) ──
//  (없음)        : 무대마다 그곳이 고향인 검객 (stages.js STAGE_FOE, 오너 결정). 짝이 없는 무대는 무작위
//  ?foe=<id>     : characters.js의 특정 캐릭터로 고정
//  ?foe=random   : 판마다 무작위로 다른 캐릭터
//  ?foe=default  : 예전처럼 LOOKS.enemy + 무작위 성격의 "기본 상대" (숙련도 2 = 실력 숫자 normal — 10/13 메뉴의 난이도 줄을 뺀 뒤)
const foeParam = params.get('foe') || lookPreviewId || 'stage';
const foeRandomEachRound = foeParam === 'random';
let currentFoe = null; // 이번 판에 고른 캐릭터 (없으면 기본 상대)
let auras = []; // 진짜 엑스칼리버의 일렁임·빛 (aura.js)
/** 캐릭터의 목소리 id: 변형(광기의 하인리히 등, characters.js CHARACTER_VARIANTS)은 원래 캐릭터의 목소리를 쓴다 */
function voiceOf(ch) {
  return ch?.voice || ch?.variantOf || ch?.id || 'generic'; // voice: 다른 인물의 녹음을 빌려 쓰는 인물 (샛별 저장소에서 가져온 셋)
}
function pickFoe() {
  const testFoe = testRoute.pickFoe(currentFoe?.id, foeRandomEachRound); // test=1 · foe=random: 고른 인물은 상대에서 뺀다
  if (testFoe) return testFoe;
  if (foeParam === 'stage') return CHARACTERS_BY_ID[stageFoeId(stages.id, currentFoe?.id)] || randomCharacter(currentFoe?.id); // 이번 판 무대의 검객 (짝 + 후보 STAGE_FOE_EXTRA — 10/10)
  if (foeRandomEachRound) return randomCharacter(currentFoe?.id); // 같은 상대가 두 번 연속 나오지 않게
  if (foeParam && CHARACTERS_BY_ID[foeParam]) return CHARACTERS_BY_ID[foeParam];
  return currentFoe; // 고정 지정이 없으면 같은 상대를 계속 쓴다
}

// ── 화면(Three.js) ──
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // three 0.186 은 PCFSoft 를 없애고 이것으로 바꿔 그렸다 (같은 그림, 경고만 없앰)
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
// 흐린 늦은 오후의 바닷가: 옅은 잿빛 안개 (싸우는 곳엔 거의 안 끼고 먼 바다만 흐려진다)
scene.background = new THREE.Color(0xc4c8c6);
scene.fog = new THREE.Fog(0xc4c8c6, 20, 480);

const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 700); // 먼 바다·하늘까지 보이게
camera.position.set(-3.5, CAMERA.height, 0.5);

const hemi = new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.2); // 구름 낀 하늘빛 + 모래에 되비친 빛
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe7cb, 1.7); // 구름 사이로 드는 누그러진 해
sun.position.set(4, 9, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
scene.add(sun, sun.target);

// 캐릭터 전용 조명: 스테이지 빛이 모자라면(밤) 카메라 쪽 보조광·바탕빛·테두리광·윤곽 빛을 캐릭터 재질에만 채운다.
//  스테이지는 fighterLight 로 색만 물들이고 더 밝게 할 수 있을 뿐 끌 수 없다 (fighter_light.js, docs/stages.md 조명 약속)
//  배경이 바뀔 때마다 useStage 가 그 배경의 fighterLight 설정으로 바꿔 끼운다
const fighterLight = createFighterLight({ hemi, sun });
// 부활 연출 (이졸데, src/revive_fx.js): 하늘에서 내린 빛기둥·빛 알갱이·땅의 빛·진짜 빛 하나·몸의 빛. 부활하는 동안만 장면에 붙는다
const reviveFx = new ReviveFx(scene, { renderer, camera, fighterLight });

// ── 배경(스테이지): 판마다 정해진 순서 ─────────────────────────────────────
//  오너 결정: 고르는 화면 없이 늘 포세이돈 신전 → 성 안뜰 → 산사 → 대성당 순서. 대성당 다음 판은 다시 포세이돈 (stages.js STAGE_ORDER)
//  어두운 홀은 쓰지 않는다 (오너 결정. 순서에 없고 ?stage=darkhall 로만 볼 수 있다)
//  짓고 치우는 법은 stages.js, 배경마다 설명은 docs/stages.md
//  ?stage=<id> : 그 배경으로 고정 (시험용, poseidon 도 된다)
//  메뉴 뒤에 보이는 배경(포세이돈)이 첫 판의 배경이다. 그 다음 판부터는 판을 열 때(startFight → nextRoundStage) 다음 배경을 짓는다.
//  짓는 동안의 멈칫(산사·대성당이 가장 길다, 개발 기계에서 0.3초 안팎)은 버튼을 누른 뒤 메뉴가 아직 떠 있는 동안 지나간다
const stages = new Stages(scene, { hemi, sun }); // 지금의 빛·안개·하늘색(포세이돈)을 처음 값으로 적어 둔다
const STAGE_PIN = STAGE_IDS.includes(params.get('stage')) ? params.get('stage') : null;
let arena = null; // 지금 배경 { update(dt), excite(amount) }
let SUN_OFF = null; // 해가 싸우는 자리를 따라다닐 때의 방향 (배경마다 다르다)
let stageFought = false; // 지금 배경에서 이미 한 판을 열었나 (그러면 다음 판을 열 때 다음 배경으로 넘어간다)
let lastRoundWon = false; // 지난 판을 이겼나 (사장님 결정: 이겨야 다음 무대·다음 상대로, 지면 같은 무대에서 같은 상대와 다시)
function useStage(id) {
  if (id === stages.id) return false;
  reviveFx.reset(); // 부활 연출이 남아 있으면 떼고 짓는다 (새 배경의 물체로 잘못 세지 않게)
  arena = stages.build(id); // 먼저 지은 배경은 치우고(GPU 자원까지), 빛·안개를 처음 값으로 되돌린 뒤 짓는다
  SUN_OFF = stages.sunOffset;
  fighterLight.setStage(arena);
  arena.onEvent = (name, data) => sound.stageEvent?.(name, data); // 배경이 알리는 일(성 안뜰: 종이 흔들려 칠 때 'bell') → 소리
  return true;
}
/**
 * 판을 열 때(startFight) 부른다: 지난 판을 이겼으면 순서대로 다음 배경을 짓는다 (첫 판은 메뉴 뒤 배경 그대로).
 *  지거나 도중에 "처음부터 다시"를 누르면 같은 배경 — 상대도 배경을 따르니 같은 상대와 다시 싸운다 (사장님 결정)
 */
function nextRoundStage() {
  const advance = stageFought && testRoute.advance(lastRoundWon); // test=1: 이기든 지든 다음 판으로
  lastRoundWon = false;
  if (advance && useStage(STAGE_PIN || testRoute.nextStage(stages.id) || nextStage(stages.id))) {
    clearFlying(); // 지난 판에 흩어지던 칼·방어구 조각과 벗겨진 투구가 새 배경에 남지 않게
    stages.warm(renderer, camera); // 셰이더·모양·질감도 지금 GPU 에 올려 둔다 (싸움 첫 프레임에서 멈칫하지 않게)
    sound.setStage(stages.id); // 배경 소리가 3초에 걸쳐 바뀐다 (발소리·쓰러짐의 바닥 소리도 배경을 따른다)
  }
  stageFought = true;
}
useStage(STAGE_PIN || testRoute.nextStage(null) || nextStage());
// ── (배경 끝) ─────────────────────────────────────────────────────────────

// ── 화면 크기 / 픽셀 모드 ──
//  크기는 캔버스의 실제 CSS 상자(#game, 화면 가득)에서 읽는다 — innerWidth/innerHeight 가 아니라. 홈 화면 앱(아이폰 standalone)은 처음 열 때·돌릴 때
//  innerHeight 와 resize 이벤트가 늦거나 빠질 수 있다고 알려져 있어, 상자가 실제로 바뀌면 ResizeObserver 가 한 번 더 잰다 (docs/ui/app_layout_2026-10-14.md)
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (!w || !h) return;
  if (PIXEL_MODE) {
    // 작은 해상도로 그린 뒤 크게 늘리면 도트 그래픽처럼 보인다
    const px = Math.max(3, Math.round(h / 180));
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / px), Math.ceil(h / px), false);
    canvas.classList.add('pixel');
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    canvas.classList.remove('pixel');
  }
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? CAMERA.fov + 15 : CAMERA.fov;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); // 화면 배율(devicePixelRatio)만 바뀌는 때도 여기로 온다
if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(canvas); // resize 이벤트 없이 상자만 바뀌어도
resize();

// ── 물리 세계와 등장인물 ──
const particles = new Particles(scene);
const decapFx = createDecapFx(particles); // 참수 목 단면·피 분출 (외형 PM, decap_fx.js — 겉모습만)
const limbFx = createLimbFx(particles); // 팔·다리 절단 단면·피 (limb_fx.js — 겉모습만, 판정은 fighter.sever)
const sound = new Sound();
// 권총(??? 등급) 총구 섬광·연기·총알 궤적·희미한 조준 레이저 (외형 PM, gun_fx.js — 소리는 그대로 두고 GUN_HOOKS.onShot 을 감싼다).
//  world·combat 은 판마다 새로 만들어지니, 늘 지금 판 것을 가리키는 얇은 겉감을 넘긴다 (읽기만 한다 — 판정과 무관)
const swordTrails = createSwordTrails(scene); // 칼 잔상 띠 (외형 PM, sword_trail.js — R0 화면 신호. 판마다 attach, 스텝마다 sample, 프레임마다 update)
installGunFx({
  scene,
  sound,
  world: { castRay: (...a) => world?.castRay(...a) ?? null },
  combat: { get info() { return combat?.info; }, get fighters() { return combat?.fighters ?? []; } },
  shake: (dir, strength) => kickCamera(dir, strength), // 발사 순간 짧은 화면 흔들림 (외형 PM v2, 사장님 '발사 이펙트 약하다')
});
sound.setStage(stages.id); // 배경 소리·바닥 소리가 배경을 따른다
sound.listener = camera; // 배경 소리(성 종 등)의 좌우 자리를 카메라 기준으로 정한다
const input = new Input(canvas);
const trail = new InputTrail(canvas); // 방금 조작한 흔적 (반투명 선)
input.trail = trail;

let world, eventQueue, colliderInfo, player, enemy, ai, combat;
let arenaStone = null; // 무대 고정 장애물 (잠든 습지 석상 — arena_obstacle.js, 다른 무대는 null)
let arenaGround = null; // 지형 무대의 바닥 { floor, lava, terrain } (화산섬 — etna_ground.js, 평지 무대는 null)
let bodySounds = [];
/**
 * 흩어지던 조각(부러진 칼날 끝·투구·판금 — debris.js 한 곳)과 벗겨진 케틀햇(캐릭터 그룹 밖, 장면에 있다)을 치운다:
 *  새 판(newRound)·배경이 바뀔 때. 여러 번 불러도 괜찮다 (무기 뽑기 때문에 newRound 가 한 판에 두 번 불린다)
 */
function clearFlying() {
  clearDebris();
  clearGunFx(); // 총구 섬광·연기도 새 판에 남지 않게
  // 벗겨진 투구의 긁힌 자국 재질도 푼다 (clearLoose 가 장면에서 떼고 모양을 푼다)
  for (const f of [player, enemy]) for (const m of f?.meshes ?? []) if (m.kind === 'loose' && m.group.parent) disposeDecals(m.group);
  player?.clearLoose();
  enemy?.clearLoose();
}
const fighterMeshes = [];
let foeWeaponId = 'longsword'; // 이번 판 상대 무기 (prepareRound 가 정한다)

/**
 * 판 준비: 이번 상대와 상대 무기를 정한다 (싸움판은 아직 만들지 않는다).
 *  판을 여는 쪽(startFight)이 이것을 한 번 부르고, 무기 뽑기 동안 newRound 를 두 번 불러도 상대는 그대로다.
 */
function prepareRound() {
  currentFoe = pickFoe();
  // 상대 무기: 주소에 foeWeapon/weapon을 직접 적었으면 그것, 아니면 캐릭터가 쓰는 무기 (브란은 10% 확률로 주워 온 커먼 칼)
  foeWeaponId = params.get('foeWeapon') || testRoute.foeWeapon(currentFoe) || FIXED_WEAPON || (currentFoe ? pickCharacterWeapon(currentFoe) : 'longsword');
  // 이번 판에 나오는 목소리만 미리 만든다 (시작 단추를 누르기 전에는 소리 장치가 없어 그냥 넘어간다)
  sound.prepareVoices(['player', voiceOf(currentFoe)]);
}

/**
 * 판 시작 예열: 싸움 도중 처음 나오는 효과의 셰이더를 지금(메뉴·카드가 가리는 동안) 만든다 — 처음 나오는 순간 멈칫하지 않게.
 *  상처 자국(캐릭터 겉면에 붙어 캐릭터 조명이 고친 재질) · 칼 잔상 · 피·불꽃 입자 · 칼이 부러질 때의 조각과 부러진 면.
 *  compile 만 하고 그리지 않는다 (화면 그대로). 캐릭터 조명이 재질을 먼저 고쳐 놓아야(셰이더가 달라진다) 그 셰이더가 준비된다.
 *  셰이더는 쓰는 재질이 하나라도 살아 있어야 남으므로 예열 재질은 다음 예열까지 들고 있다.
 *  예열 물체는 따로 된 난수로 만든다 (three 가 UUID 에 Math.random 을 쓴다 — 판의 난수 흐름을 그대로 두게)
 */
let fxWarmMats = [];
let fxWarmSeed = 0x6a09e667;
let fxWarmGeo = null;
function quietly(fn) {
  const real = Math.random;
  Math.random = () => (fxWarmSeed = (Math.imul(fxWarmSeed, 1664525) + 1013904223) >>> 0) / 4294967296;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}
const fragileOf = () => [player, enemy].filter((f) => f.weapon?.fragile && f.swordGroup);
const breakFace = () => new THREE.MeshStandardMaterial({ flatShading: true, side: THREE.DoubleSide }); // weapon_looks.js breakWeaponLook 톱니 면과 같은 설정
/** 캐릭터에 잠깐 붙일 예열 물체: 상처 자국(겉면) · 부러진 칼의 톱니 면(칼 그룹) */
function fxWarmers() {
  return quietly(() => {
    fxWarmGeo ??= new THREE.PlaneGeometry(0.001, 0.001);
    const on = [];
    const host = Object.values(player.partMesh).find(Boolean);
    if (host) on.push([host, decalWarmMesh()]);
    for (const f of fragileOf()) on.push([f.swordGroup, new THREE.Mesh(fxWarmGeo, breakFace())]);
    return on;
  });
}
function withWarmers(on, fn) {
  for (const [parent, mesh] of on) parent.add(mesh);
  try {
    fn();
  } finally {
    for (const [, mesh] of on) mesh.removeFromParent();
  }
}
/** newRound 끝에서: 붙여 둔 예열 물체와 칼 조각(장면에 뜬다)·잔상·입자의 셰이더를 지금 무대 빛으로 만든다 */
function warmRoundFx(on) {
  const mats = on.map(([, mesh]) => mesh.material);
  withWarmers(on, () => {
    fighterLight.update(fighterMeshes);
    // 칼 조각 (breakWeaponLook · debris.js spawnDebris 와 같은 재질 설정): 떨어지는 쪽은 칼 재질 복제본(캐릭터 조명이 고친 뒤 복제 —
    //  조명 셰이더는 안 따라간다)과 톱니 면 복제본을 흐리게 해 장면에 띄운다
    const loose = quietly(() => {
      const g = new THREE.Group();
      const put = (m, geo) => {
        m.transparent = true;
        mats.push(m);
        g.add(new THREE.Mesh(geo, m));
      };
      for (const f of fragileOf()) {
        f.swordGroup.traverse((o) => {
          if (!o.isMesh || on.some(([, mesh]) => mesh === o)) return;
          for (let p = o; p && p !== f.swordGroup; p = p.parent) if (!p.visible) return;
          for (const m of [].concat(o.material)) put(m.clone(), o.geometry);
        });
        put(breakFace(), fxWarmGeo);
      }
      return g;
    });
    scene.add(loose);
    for (const o of [...on.map(([, mesh]) => mesh), loose, swordTrails.mesh, particles.mesh]) renderer.compile(o, camera, scene);
    scene.remove(loose);
  });
  for (const m of fxWarmMats) m.dispose(); // 지난 예열 재질: 새 것이 같은 셰이더를 잡은 뒤에 푼다
  fxWarmMats = mats;
}

/**
 * 싸움판 만들기: prepareRound 가 정한 상대와 주인공 무기(weaponId)로 물리 세계와 두 사람을 새로 세운다.
 *  만들기만 하고 시간은 흐르지 않는다 (게임 루프가 state 'fight' 일 때만 물리를 돌린다).
 */
function newRound(weaponId) {
  input.resetTransient(); // 지난 판의 손가락 상태를 물려받지 않는다 (10/8 입력 수명주기)
  // 다리로 체중 받치기: 게임은 늘 gait.js 걸음(다리가 체중 대부분을 받친다). 오너 결정으로 설정 토글을 없애고 기본 적용했다.
  //  CONFIG 기본값도 'hybrid'라 시뮬 도구가 게임과 같은 걸음을 잰다(9/29). 이 줄은 콘솔·도구가 바꿔 둔 값을 판마다 되돌린다
  CONFIG.BODY.weightMode = 'hybrid';
  // 이전 판 정리 (무기 뽑기 때문에 한 판에 두 번 만들 수 있어 모양 데이터는 바로 풀어 준다. 재질·텍스처는 다음 판이 다시 쓴다.
  //  상처 자국 재질만은 자국마다 새로 만들어 다시 안 쓰니 푼다 — 자국 그림은 종류별로 같이 써서 둔다)
  //  흩어지던 칼·투구·판금 조각과 벗겨진 케틀햇은 캐릭터 그룹 밖(장면)에 있어서 따로 치운다 (두 번 불러도 괜찮다)
  clearFlying();
  for (const g of fighterMeshes) {
    scene.remove(g);
    g.traverse((o) => o.geometry?.dispose());
    disposeDecals(g);
  }
  fighterMeshes.length = 0;
  if (world) world.free();
  if (eventQueue) eventQueue.free();
  particles.clear();
  reviveFx.reset();

  world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  eventQueue = new RAPIER.EventQueue(true);
  colliderInfo = new Map();

  // 지형 무대(화산섬): 그림과 같은 삼각형 그물 바닥 + 땅을 따라 올린 경계 벽 + 용암 감지 상자 (etna_ground.js). 발 받침은 그물 접촉만
  const terrain = terrainForStage(stages.id);
  arenaGround = terrain ? createTerrainGround(RAPIER, world, GROUND_GROUPS, terrain, { radius: ARENA.radius }) : null;
  if (arenaGround) setSupportFloor(world, arenaGround.floor);
  else {
  // 바닥 + 원형 경계 벽 (보이지 않는 벽: 눈에 보이는 건 대리석 테두리)
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor); // 발 체중 받침은 이 바닥 접촉만 센다 (gait.js groundForce — 벽·석상 접촉은 받침이 아님)
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.6, half)
        .setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }
  }
  particles.terrain = terrain; // 핏방울이 비탈에 앉고 용암에 사라진다 (평지 null — 그대로)
  DEBRIS.terrain = terrain; // 흩어지는 칼·방어구 조각의 바닥도 땅 높이로 (평지 null — 그대로)

  arenaStone = configureStageObstacle(RAPIER, world, stages.id, GROUND_GROUPS); // 잠든 습지: 가운데 석상 충돌체 (다른 무대 null)
  const startZ = stageStartZ(stages.id); // 잠든 습지: 두 사람을 옆으로 비켜 세워 카메라 → 상대 시선이 석상에 막히지 않게 (다른 무대 0)
  const before = new Set(scene.children);
  const foeWeapon = foeWeaponId;
  player = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 0,
    name: readProfile().name,
    x: -ARENA.startGap / 2,
    z: startZ,
    heading: 0,
    terrain, // 지형 무대만 땅 계약 (평지 null)
    look: LOOKS.player,
    weapon: weaponId,
    ...testRoute.player, // ?hero=<인물 id>: 겉모습·이름만 그 인물 (유파·비기는 무기를 따른다)
  });
  let enemyLook = currentFoe ? currentFoe.look : LOOKS.enemy;
  if (currentFoe) {
    const overrideVersion = (lookPreviewId === currentFoe.id && lookPreviewVersion) || lookvVersion;
    if (overrideVersion) enemyLook = getLook(currentFoe.id, overrideVersion) || enemyLook;
  }
  enemy = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 1,
    name: currentFoe ? currentFoe.name : '상대',
    x: ARENA.startGap / 2,
    z: startZ,
    heading: Math.PI,
    terrain,
    look: enemyLook,
    weapon: foeWeapon, // prepareRound 가 정한 상대 무기
    revive: currentFoe?.revive, // 부활 (이졸데: 처음 죽으면 한 번 다시 일어선다, src/revive.js)
    physiology: currentFoe?.physiology, // 몸 규칙 (병마용: 출혈 0 · 머리가 떨어져야만 죽음 · 흙 몸 — fighter.js HUMAN_BODY). 없으면 사람
  });
  for (const f of [player, enemy]) {
    configureWetlandMovement(f, stages.id); // 진흙 웅덩이 감속 (잠든 습지만)
    f.arenaObstacle = arenaStone?.navigation ?? null; // AI 돌아가기가 읽는다 (석상 없으면 null — 아무 일 없음)
  }
  arena?.watchFighters?.([player, enemy]); // 잠든 습지: 웅덩이를 밟으면 물결 (그림만 — 다른 무대는 이 함수가 없다)
  // 진짜 엑스칼리버의 기운 (보여 주기만)
  for (const a of auras) a.dispose();
  auras = [player, enemy].map(attachAura).filter(Boolean);
  for (const c of scene.children) if (!before.has(c)) fighterMeshes.push(c);
  const fxWarm = fxWarmers(); // 싸움 도중 처음 나오는 효과의 셰이더 예열용 (부활 빛 예열에 같이 넣고, 판 끝에 warmRoundFx)
  if (enemy.revive) {
    // 부활하는 상대: 빛 하나가 더해진 셰이더를 지금(메뉴·카드가 가리는 동안) 만들어 둔다 — 빛이 내려오는 순간 멈칫하지 않게.
    //  캐릭터 조명이 새 재질을 먼저 고쳐 놓아야(셰이더가 달라진다) 그 셰이더가 준비된다. 예열용 자국·톱니 면도 잠깐 붙여 같이 만든다
    withWarmers(fxWarm, () => {
      fighterLight.update(fighterMeshes);
      reviveFx.warm();
    });
  }
  const madEyes = attachMadEyes(enemy, ['madGlow','clothGlow'].includes(currentFoe?.eyes) || params.has('madEyes'), { veiled: currentFoe?.eyes === 'clothGlow' }); // clothGlow: faint light transmitted through Liao's wrap
  if (madEyes) auras.push(madEyes);
  for (const f of [player, enemy]) { const h = attachHands(f); if (h) auras.push(h); } // 벙어리장갑 손 (외형 PM, hands.js — 겉모습만)
  swordTrails.attach([player, enemy]); // 칼 잔상 띠: 이번 판 두 검객 (지난 띠는 지운다)
  if (player.weapon?.gun || enemy.weapon?.gun) warmGunFx(renderer, camera); // 권총 효과 재질을 지금 무대 빛으로 미리 컴파일 (첫 발 멈칫 방지)
  // 캐릭터를 골랐으면 그 캐릭터의 숙련도(실력 숫자 이름 level · 유파별 숙련도 persona.proficiency — characters.js)와 성격(persona)을 그대로 쓴다.
  //  캐릭터가 없으면(기본 상대) 숙련도 2(= 실력 숫자 normal, AI_PROFICIENCY.ofLevel) + 무작위 성격 (10/13 메뉴 난이도 줄을 뺌)
  //  ?foeProficiency=N 이면 그 판 상대의 숙련도를 N 으로 (시험)
  //  캐릭터가 평소와 다른 무기를 들었으면(브란의 주워 온 칼) 유파 꾸러미도 그 무기 것으로 (없으면 롱소드 기본) — 숙련도 표는 시트 무기 유파 열쇠라 그 무기 유파는 0(고유 동작 없음)
  const foeAI = currentFoe ? (FOE_PROF != null ? aiAtProficiency(currentFoe, FOE_PROF) : currentFoe.ai) : FOE_PROF != null ? { level: AI_PROFICIENCY.levels[FOE_PROF], persona: { proficiency: FOE_PROF } } : { level: 'normal', persona: null };
  const persona = currentFoe && foeWeapon !== currentFoe.weapon ? { ...foeAI.persona, school: foeWeapon } : foeAI.persona;
  ai = new AI(enemy, player, foeAI.level, persona);
  if (testRoute.foeWhiff) ai.drill = new WhiffDrill(); // ?foeWhiff=1: 상대가 닿지 않는 거리에서 2~3 s 마다 허공을 벤다 (whiff_drill.js — 판마다 새 바깥 거리). 없으면 평소 그대로
  const uniqueStage = uniqueStageFor(player.swordArt?.tradition, { test: testRoute.active, param: UNIQUE_STAGE_PARAM }).stage; // 손에 든 무기 유파의 숙련도 (본판 = 인장 수 · 테스트 경로 5 · ?uniqueStage)
  playerSecret = new PlayerSecretWatch(player, enemy, { locked: uniqueStage < CONFIG.UNIQUE_ASSIST.secretStage }); // 내 무기 유파의 비기 — 숙련도 5 에서만 (사장님 결정 10/13 23:1x '숙련도 5단계 … 거기서 비기를 배우게'). 그 전·스위치 끔·무유파·권총이면 S = null — 아무 일도 없다
  playerGuard = new PlayerParryGuard(player, enemy); // 막기 버튼 (누르는 동안만 손을 쥔다 — 권총·맨손이면 아무 일도 없다)
  player.stamina.controller = playerGuard;
  playerUnique = new PlayerUniqueAssist(player, { stage: uniqueStage }); // 고유 동작 강화: 손에 든 무기 유파의 숙련도(인장 수)만큼 열림 (단계 0 · 무유파 · 끔이면 붙지 않음)
  uniqueCueSeen = null;
  secretSlow = 0;
  secretBurstsSeen = 0;
  secretOpenSeen = 0;
  secretArcSeen[0] = player?.instantArc?.id ?? 0;
  secretArcSeen[1] = enemy?.instantArc?.id ?? 0;
  camSwing.t = -1;
  // 플레이어 감정 (emotions.js): 상대 AI와 같은 규칙으로 겁먹고 화내고 물고 늘어진다. ?emo=0 이면 끔, ?emo=0.5 면 문턱값 셋 다 0.5
  const emoParam = params.get('emo');
  const emoTh = emoParam === '0' ? 0 : emoParam ? +emoParam || 0.3 : 0.3;
  playerEmo = new Emotions({ fearful: emoTh, angry: emoTh, dogged: emoTh });
  playerEv = { hurt: false, parried: false, landed: false };
  player.emoMods = playerEmo.mods;
  player.skill.level = +settings.skill;
  player.skill.corr = CONFIG.SKILL.corr; // 플레이어 보정 = 새 보정 하나 (Skill 생성자도 같은 값을 읽는다. 설정·주소 스위치 없음, 디렉터 결정 10/1 22:05)
  player.skill.corrTip = CONFIG.SKILL.corrTip; // 끝점 겨눔 ② 끔 (같은 결정)
  player.skill.autoGuard = true; // 베고 나면 기본 자세로 돌아간다 (AI는 스스로 자세를 고른다)
  player.canShove = true; // 근접 밀치기: 플레이어는 스틱으로 (CLOSE.on 이 통째로 끄고 켠다)
  combat = new Combat(colliderInfo, { onWound, onClash });
  // 몸 소리(발소리·쓰러짐·무기 부러짐·죽음 목소리): 캐릭터마다 목소리가 다르다
  const foeVoice = voiceOf(currentFoe);
  bodySounds = [new BodySounds(sound, player, 'player', true), new BodySounds(sound, enemy, foeVoice)];
  sound.resetRound();
  sound.roundStart(); // 대성당: 판이 시작될 때 파이프 오르간이 한 번 울린다
  roundOver = false;
  roundOverTime = 0;
  resetCamera(); // 따라가기를 새 판 몸 자리에 바로 맞춘다 (지난 판 자리에서 미끄러져 오지 않게 — 판 시작 자리는 planOpening 이 정한다)
  hitStop = 0;
  // 시간이 흐르기 전에도(무기 뽑기 동안) 선 자세 그대로 보이게 겉모습을 몸에 맞춰 둔다
  player.syncMeshes();
  enemy.syncMeshes();
  warmRoundFx(fxWarm); // 판 도중 처음 나오는 효과(자국·잔상·입자·칼 조각)의 셰이더 (판의 난수를 다 쓴 뒤 — 그리기 전과 같은 순서)
}

// ── 타격감 ──
let hitStop = 0; // 큰 타격 때 아주 잠깐 멈칫하는 연출
let playerEmo = null; // 플레이어 감정 판정 (emotions.js)
let playerEv = { hurt: false, parried: false, landed: false }; // 이번 프레임에 플레이어에게 일어난 사건
const playerTremor = { x: 0, y: 0, ax: 0, ay: 0, t: 0 }; // 공포 손 떨림 (지금 얹혀 있는 값·시계)
let clashCooldown = 0;
let clashStopCooldown = 0; // 칼끼리 부딪혀 멈칫한 뒤 다시 멈칫하기까지 (초)
let slowMo = 0; // 결정타 슬로모션 남은 시간
// 플레이어 비기 (10/9 23:5x — docs/strike/player_secret_2026-10-09.md): 창(PlayerSecretWatch — 판마다 새로) · 결정타 연출 시계 · 본 터뜨림 수 · 본 창 수
let playerSecret = null;
// 플레이어 막기 버튼 (10/11 — src/parry_button.js · docs/strike/player_parry_button_2026-10-11.md): 판마다 새로. 누름 = 폰 '막기' 단추(오른쪽 아래) 또는 PC 키 F
let playerGuard = null;
// 플레이어 고유 동작 강화 (10/13 이어 주기 → 10/14 강화 — src/unique_assist.js): 판마다 새로 (열린 동작이 없으면 검술 층에 붙지 않는다 = 전과 같음) · 본 알림
let playerUnique = null;
let uniqueCueSeen = null;
const parryHold = { btn: null, key: false }; // btn = 단추를 누른 포인터 id
let secretSlow = 0;
let secretBurstsSeen = 0;
let secretOpenSeen = 0;
// 비기 화면 연출 (10/10 발도 섬광 · 이베리아 카메라): 본 잔상 수 · 카메라 돌림 { t, sign }
const secretArcSeen = [0, 0];
const camSwing = { t: -1, sign: 1 };
const flashEl = document.createElement('div');
flashEl.id = 'secretFlash';
flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:5;transition:opacity .12s ease-out';
document.body.appendChild(flashEl);
/** 비기 화면 연출: 새 발도 잔상이면 아주 짧게 화면 번쩍, 새 이베리아 휩쓸기면 카메라를 사이드스텝 쪽으로 (둘 다 늘 켬 — 설정 줄은 10/10 에 지웠다) */
function watchSecretFx() {
  [player, enemy].forEach((f, i) => {
    const A = f?.instantArc;
    if (!A || A.id === secretArcSeen[i]) return;
    secretArcSeen[i] = A.id;
    if (A.kind === 'iai') {
      flashEl.style.transition = 'none';
      flashEl.style.opacity = '0.32';
      requestAnimationFrame(() => {
        flashEl.style.transition = 'opacity .12s ease-out';
        flashEl.style.opacity = '0';
      });
    }
    if (A.kind === 'sweep' && A.side) {
      // 사이드스텝 쪽 = 카메라 오른쪽(+) 또는 왼쪽(−)
      const right = { x: -camDir.z, z: camDir.x };
      camSwing.sign = A.side[0] * right.x + A.side[2] * right.z >= 0 ? 1 : -1;
      camSwing.t = 0;
    }
  });
}

// 디버그용 통계 (브라우저 콘솔에서 game.stats 로 확인)
const stats = { hits: [], clashes: 0, simTime: 0, passes: 0 };

/** combat.js가 상처를 만들 때마다 부른다: 피, 자국, 소리, 진동, 멈칫 */
function onWound(att, vic, r, point, pr) {
  if (vic === player) playerEv.hurt = true; // 감정 사건: 베였다
  if (att === player) playerEv.landed = true; // 감정 사건: 맞혔다
  const tag = `${att.name}->${r.zone}:${r.type}${r.pass ? '(관통)' : ''} ${r.energy.toFixed(0)}J 심각도${r.severity.toFixed(2)}`;
  stats.hits.push(tag);
  if (r.pass) stats.passes++;
  const e = r.energy;
  const opened = r.type !== 'blunt' && r.severity > 0;
  // 흙 몸(병마용 — fighter.physiology.body 'clay', 샛별 901b1f39): 피 대신 흙 알갱이 · 상처 자국 대신 무광 잔금 · 칼에 피 안 묻음 · 살 소리 대신 마른 타격음.
  //  사람(body 'human')은 아래 예전 길 그대로
  const clay = vic.physiology?.body === 'clay';
  // 피: 벤 방향으로 흩뿌림
  if (clay) { if (e > 5) particles.clayChips(point, r.dir, e); } // 5 J 넘는 타격마다 잠깐 흩어지는 흙 알갱이 (샛별 값 — 확인표 1420)
  else if (opened) particles.blood(point, r.dir, 6 + r.severity * 40, r.speed);
  // 흔적 (몸 표면에 붙어서 같이 움직인다)
  const mesh = vic.partMesh[pr.v.part];
  const group = vic.groups[pr.v.part];
  if (mesh && group) {
    // 몸 기준 좌표 → 겉면 메쉬 기준 좌표 (팔처럼 겉모습이 따로 돌려진 부위가 있다)
    group.updateMatrixWorld(true);
    const toMesh = new THREE.Matrix4().copy(mesh.matrixWorld).invert().multiply(group.matrixWorld);
    const local = r.local.clone().applyMatrix4(toMesh);
    const q = new THREE.Quaternion();
    const rr = pr.v.body.rotation();
    q.set(rr.x, rr.y, rr.z, rr.w).invert();
    const bladeLocal = r.bladeAxis.clone().applyQuaternion(q).transformDirection(toMesh);
    const clothed = r.zone !== 'head' && r.zone !== 'neck';
    const sev = r.severity;
    // 투구·판금: 긁힘, 세면 찌그러짐 (벗겨지거나 부서지면 조각과 함께 날아간다).
    //  조각 투구(마르그레테)는 사발 조각 메쉬에, 판금은 그 부위에서 맞은 곳에 가장 가까운 판금 메쉬에 붙인다
    const steel = r.helmet && vic.helmetGroup ? (vic.helmetGroup.userData.pieces?.bowl ?? vic.helmetGroup).children[0] : r.plate ? vic.plateMeshNear(pr.v.part, r.local) : null;
    if (clay) {
      if (e > 5) stickDecal(mesh, local, bladeLocal, 'clay', 0.035 + Math.min(0.035, e / 2200), Math.min(0.18, 0.04 + e / 900)); // 흙 몸: 베인 결을 따라 무광 잔금 (피 번짐 없음 — 샛별 값, 확인표 1421)
    } else if (steel?.geometry) {
      const p = r.local.clone().applyMatrix4(new THREE.Matrix4().copy(steel.matrixWorld).invert().multiply(group.matrixWorld));
      stickDecal(steel, p, bladeLocal, 'scratch', 0.03, Math.min(0.16, 0.04 + e / 1200));
      if (e > 60) stickDecal(steel, p, null, 'dent', 0.03 + Math.min(0.05, e / 4000), 0.03 + Math.min(0.05, e / 4000));
    } else if (!opened) {
      if (e > 15) stickDecal(mesh, local, null, 'bruise', 0.05 + Math.min(0.08, e / 1500), 0.05 + Math.min(0.08, e / 1500));
    } else {
      const len = Math.min(0.24, 0.06 + sev * 0.14);
      if (r.type === 'stab') stickDecal(mesh, local, null, 'stab', 0.05 + sev * 0.02, 0.05 + sev * 0.02);
      else stickDecal(mesh, local, bladeLocal, clothed ? 'tear' : 'cut', 0.035 + Math.min(0.03, sev * 0.02), len);
      // 피가 옷에 번진다 (상처에서 계속 흐르는 만큼)
      const wound = vic.wounds.findLast((w) => !w.stump); // 참수: 목 단면(stump)은 건너뛰고 목 상처에 번진다
      if (wound && wound.part === pr.v.part && !wound.soak) wound.soak = stickDecal(mesh, local, null, 'soak', 0.04, 0.04);
    }
  }
  if (opened && !clay) att.bloodyBlade(0.08 + r.severity * 0.15); // 흙 몸을 벤 칼에는 피가 묻지 않는다
  // 소리: 투구는 투구 소리. 판금은 전투 판정(r.plate — 아직 붙어 있는 판이 덮은 곳을 맞았다)을 따른다:
  //  날이 들지 못했으면 판금이 막는 소리(때린 무기 재질대로), 판을 뚫고 들어갔으면 강철 소리 한 번 (살 소리는 아래에서 따로)
  //  불꽃: 막혔으면 더 많고, 판을 뚫고 들어가도 강철을 긁은 불꽃이 조금 튄다 (ARMOR 를 켰을 때만 — 끄면 예전 그대로)
  const mat = att.weapon?.material || 'steel';
  if (r.helmet) sound.helmet(e);
  else if (r.plate) {
    if (opened) sound.impact({ a: mat, b: 'armor', energy: e * 0.8 });
    else sound.plateBlock(e, { material: mat });
  }
  if ((r.helmet || r.plate) && CONFIG.ARMOR.on && e > 30) particles.sparks(point, Math.min(10, e / 20) * (opened ? 0.5 : 1));
  // 이번 타격에 판금 부위나 투구가 완전히 부서졌으면(fighter.applyWound 가 표시한다) 깨지는 소리를 한 번
  if (vic.armorBroke) {
    vic.armorBroke = false;
    sound.plateBreak(e);
  }
  if (clay) sound.clay(e, point); // 흙 몸: 마른 타격음 하나 (살·뼈 소리 대신 — 샛별 값, 확인표 1422)
  else if (r.type === 'cut') sound.cut(e, r.pass);
  else if (r.type === 'stab' && opened) sound.stab(e); // 날이 들지 못한 내려찍기 즉사 찌르기(r.finish, 심각도 0)는 막힌 타격 소리
  else sound.blunt(e);
  if (!clay && e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg') && !r.helmet && !r.plate) sound.bone(e);
  // 멈칫: 재질에 따라. 살을 깨끗이 가르면 짧게, 박히거나 뼈·투구에 걸리면 길게 (최대 0.1초 — 조작이 늦게 느껴지지 않게)
  const bone = e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg');
  const stopT = r.pass ? Math.min(0.06, e / 2000) : r.stuck || bone || r.helmet || r.plate ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200);
  hitStop = Math.max(hitStop, stopT);
  // 손맛: 칼의 타격 중심(스위트 스팟, 코등이에서 약 58cm)에 맞으면 손이 울리지 않고, 칼끝·칼 밑동에 맞으면 손이 찌릿하다
  //  (손을 축으로 도는 강체에서 한 점을 치면 축(손)이 받는 충격 = 1 − a·b/k²)
  const sting = att.swordSting(r.t);
  // 카메라가 칼이 지나간 방향으로 밀린다 (내가 맞으면 더 크게, 내가 칠 땐 손이 받은 충격만큼)
  kickCamera(r.dir, Math.min(1.6, e / 120) * (vic === player ? 1.4 : 0.4 + 0.4 * sting));
  if (vic === player) haptic(e / 120);
  else if (att === player) haptic((e / 120) * (0.4 + 0.6 * sting));
  if (!vic.alive) slowMo = 1.6;
  arena.excite(vic.alive ? Math.min(0.6, e / 250) : 1); // 떠다니던 먼지가 흩날린다
  sound.gust(vic.alive ? Math.min(0.6, e / 250) : 1); // 산사: 단풍잎 바스락 + 솔바람 + 풍경
}

function onClash(point, speed, touch) {
  if (touch?.fresh && touch.vn > 3 && player?.alive && player.tipVel.length() > 6) playerEv.parried = true; // 감정 사건: 내 베기가 막혔다
  // 소리: 새로 부딪힌 순간(또는 맞댄 채 다시 세게 친 순간)에만 "쨍". 맞댄 채 미끄러지는 동안은 긁히는 소리(updateBindSound)
  //  touch.vn = 부딪히기 직전 맞닿는 방향 속도(부딪히는 세기), touch.vt = 칼날을 따라 스치는 속도 (combat.js bladeClash)
  if (touch && (touch.fresh || touch.vn > 3)) {
    // 두 무기의 재질이 둘 다 강철이면 칼끼리 "쨍", 아니면 재질에 맞는 소리 (나뭇가지 "딱", 광검 "파직", 고무 닭 "삑", 언 참치 "텅")
    const ma = player?.weapon?.material || 'steel';
    const mb = enemy?.weapon?.material || 'steel';
    if (ma === 'steel' && mb === 'steel') sound.clash(touch.vn, touch.vt);
    else sound.impact({ a: ma, b: mb, energy: 12 * touch.vn });
  }
  // 연출의 세기는 "부딪히기 직전" 속도로 정한다 (부딪힌 뒤 속도엔 튕겨 나온 몫이 섞여 있다)
  const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
  if (clashCooldown > 0) return;
  if (impact < 2.5) {
    // 세게 부딪히진 않았지만 칼날을 따라 빠르게 긁으면 불꽃만 조금
    if (touch && touch.vt > 5) {
      clashCooldown = 0.12;
      particles.sparks(point, touch.vt * 0.4);
    }
    return;
  }
  clashCooldown = 0.09;
  stats.clashes++;
  particles.sparks(point, impact);
  // 세게 부딪힐 때만 잠깐 멈칫 (칼끼리 맞대고 밀 때마다 멈추면 끊겨 보인다)
  if (impact > 6 && clashStopCooldown <= 0) {
    hitStop = Math.max(hitStop, Math.min(0.08, impact / 200));
    clashStopCooldown = 0.5;
  }
  kickCamera(new THREE.Vector3((Math.random() - 0.5), 0.3, (Math.random() - 0.5)).normalize(), Math.min(0.6, impact / 25));
  haptic(Math.min(1, impact / 15));
}

// 칼을 휘두르면 바람 소리 (칼마다 하나씩 계속 돌면서 칼끝 속도를 따라간다)
const whooshState = new Map();
function updateWhoosh(f, dt) {
  // 판이 바뀌어도 같은 소리 고리를 다시 쓴다 (나/상대 한 개씩)
  let st = whooshState.get(f.index);
  if (!st) whooshState.set(f.index, (st = { loop: null }));
  // 판마다 무기가 바뀐다: 재질이 달라지면 고리를 새로 만든다 (광검은 늘 "웅" 소리가 함께 돈다)
  const mat = f.weapon?.material || 'steel';
  if (st.loop && st.mat !== mat) {
    st.loop.stop?.();
    st.loop = null;
  }
  if (!st.loop) {
    st.loop = sound.whooshLoop(mat);
    st.mat = mat;
  }
  st.loop?.set(f.armed ? f.tipVel.length() : 0);
}
/** 싸움 화면이 아닐 때(메뉴·일시정지)는 바람 소리·긁는 소리를 끈다 */
function muteWhoosh() {
  for (const st of whooshState.values()) st.loop?.set(0);
  sound.scrape(0, 0);
}
// 칼끼리 맞대고 밀며 미끄러지는 동안 계속 나는 "지이익" (바인드)
function updateBindSound() {
  const b = combat.bladeContact;
  const steel = (player?.weapon?.material || 'steel') === 'steel' && (enemy?.weapon?.material || 'steel') === 'steel';
  if (combat.binding && steel) sound.scrape(b.slide, b.press); // 쇠끼리 긁히는 "지이익"은 강철끼리만
  else sound.scrape(0, 0);
}

// 상처에서 떨어지는 핏방울
const _wp = new THREE.Vector3();
function updateDrips(f, dt) {
  if (f.physiology?.bleeds === false) return; // 피 없는 몸(병마용): 핏방울·번짐 없음 (출혈도 0)
  for (const w of f.wounds) {
    // 옷에 번지는 핏자국: 흘린 피만큼 커진다 (가끔씩 다시 투사)
    if (w.soak) {
      w.soaked = (w.soaked || 0) + w.bleed * dt;
      const size = Math.min(0.26, 0.04 + Math.sqrt(w.soaked) * 0.9);
      if (size > w.soak.userData.w * 1.12) rebuildDecal(w.soak, size, size * 1.3);
    }
    if (w.bleed < 0.001) continue;
    if (Math.random() < w.bleed * dt * 900) {
      const g = f.groups[w.part];
      if (g) particles.drip(g.localToWorld(_wp.copy(w.local)));
    }
  }
}

// ── UI ──
const $ = (id) => document.getElementById(id);
const menu = $('menu');
const topButtons = $('topButtons');
const toast = $('toast');
const hint = $('hint');
attachStick(input, $('moveStick'), $('moveKnob'));
let state = 'menu'; // menu | fight | paused
let roundOver = false;
let roundOverTime = 0;
let resultShown = false; // 판 끝 결과 글자("승리"/"패배")를 띄웠나 — 결정타 슬로모션(slowMo)이 끝난 뒤에 띄운다

$('howto').innerHTML = input.isTouchDevice
  ? '<li>화면을 손가락으로 끌면 칼이 따라 움직여요. 좌우로 끌면 가로베기, 위아래로 끌면 내려치기.</li><li>왼쪽 아래 조이스틱으로 걸어요. 화면을 톡 치면 찔러요.</li><li>오른쪽 아래 막기를 누르고 있으면 들어오는 칼을 유파 막기 자세로 받아요. 누른 채 휘두르면 바로 공격해요.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점이에요.</li>'
  : '<li>화면을 클릭하면 마우스가 잠기고, 마우스로 칼을 휘둘러요.</li><li>WASD 또는 방향키로 걸어요. F를 누르고 있으면 들어오는 칼을 유파 막기 자세로 받아요.</li><li>Esc로 마우스 잠금을 풀고, P로 일시정지해요.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점이에요.</li>';

// 설정 창: 남은 설정(화면 60 fps 제한)만 [data-setting] 줄이 있다 (상대 난이도 줄은 10/13 에 뺐다)
function refreshSettingsUI() {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    if (el.classList.contains('seg')) el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings[key]));
    else el.classList.toggle('on', !!settings[key]);
  });
  document.body.classList.toggle('touch', input.isTouchDevice);
  applyMoveMode();
}
document.querySelectorAll('[data-setting]').forEach((el) => {
  const key = el.dataset.setting;
  if (el.classList.contains('seg')) {
    el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        settings[key] = b.dataset.v;
        saveSettings();
        refreshSettingsUI();
      }),
    );
  } else {
    el.addEventListener('click', () => {
      settings[key] = !settings[key];
      saveSettings();
      refreshSettingsUI();
    });
  }
});
refreshSettingsUI();

// ── 화면 글자 시계 (10/10 글자 체계 — docs/ui/hud_type_system_2026-10-10.md §7): 판 알림·안내·소개·감정 줄을 게임 시간으로 센다 ──
//  예전엔 벽시계(setTimeout)라 일시정지해도 혼자 사라졌다. 게임 루프가 싸움·무기 뽑기 동안만 tickHudTimers(dt) 를 부른다 (일시정지·메뉴면 같이 멈춘다)
const hudTimers = new Map(); // 열쇠 → { t 남은 초, fn }
/** sec 초(게임 시간) 뒤에 fn. 같은 열쇠는 새것이 덮는다. fn 없이 부르면 지운다 */
function hudLater(key, sec, fn) {
  if (fn && sec > 0) hudTimers.set(key, { t: sec, fn });
  else hudTimers.delete(key);
}
function tickHudTimers(dt) {
  for (const [k, v] of hudTimers) {
    v.t -= dt;
    if (v.t <= 0) {
      hudTimers.delete(k);
      v.fn();
    }
  }
  tickEmoMsg(dt);
}

let lastFoeLine = ''; // 이번 판 끝에 상대가 한 말 (결과 화면에도 적는다)
/** 상대의 한마디 (승리 대사): 소개 칸을 다시 써서 이름 + 대사만 잠깐 보여 준다 */
function showFoeLine(ch, line) {
  lastFoeLine = line;
  if (!line) return;
  const el = $('foeIntro');
  el.querySelector('b').textContent = ch.name;
  el.querySelector('i').textContent = '';
  el.querySelector('span').textContent = `“${line}”`;
  el.querySelector('small').textContent = lineSourceOf(ch, line); // 대사 아래 줄 출처 (병마용의 고전 인용 『사기』·『설원』 — 사장님 10/14 '출처까지 다 나오게 해'. 없는 인물은 빈칸이라 줄이 숨는다)
  el.classList.add('show');
  hudLater('foeIntro', 3.4, () => el.classList.remove('show'));
}

// 이번 상대 소개 (이름 · 칭호 · 한마디) — 화면 가운데, 판 알림(toast) 바로 아래 (10/14 사장님 '사이즈 통일해서 예전처럼 시작 때 보이게 가운데로').
//  세 줄 글자 크기는 하나(보통 --fs-m — 10/14 글자 규칙), 색만 다르다: 이름 = 본문 색 · 칭호와 대사 = 보조 색 (index.html #foeIntro).
//  판이 시작되는 순간(beginFight)부터 발이 풀릴 때(ARENA.startHold)까지만 보인다 — 무기 카드를 고르는 동안에는 띄우지 않는다.
//  10/15 판 시작 카메라: 무대 훑기 판은 훑기 시작 CAMERA.open.introAt 초 뒤에 떠서 introSec 초(= 카메라가 내 어깨 자리에 닿을 때) 걷힌다 — 처음 1 초는 무대만 보이게.
//   다시 겨루기(내려앉기 1 s)는 판 시작에 떠서 introSec 초 (정지보다 1 초 길게 — 대사를 읽을 시간). `?openSweep=0` 은 예전처럼 ARENA.startHold 까지
//  무기 이름은 글로 적지 않는다 (대사와 겹쳐 읽기 어렵다는 오너 의견: 내 무기와 상대 무기는 카드 두 장이 보여 준다)
function showFoeIntro(ch) {
  const el = $('foeIntro');
  hudLater('foeIntro');
  if (!ch || !(ARENA.startHold > 0)) return el.classList.remove('show');
  el.querySelector('b').textContent = ch.name;
  el.querySelector('i').textContent = ch.epithet;
  { const line = randomLine(ch, ch.lines?.introStray && foeWeaponId !== ch.weapon ? 'introStray' : 'intro'); el.querySelector('span').textContent = line ? `“${line}”` : ''; el.querySelector('small').textContent = lineSourceOf(ch, line); } // 시작 대사 3종 중 하나 (대사가 없는 인물은 빈칸) · 출처는 대사 아래 줄 (병마용)
  el.classList.add('show');
  if (camOpen.mode === 'sweep') return; // 훑기 판: 카메라가 내 어깨 자리에 닿는 순간(발이 풀릴 때) watchOpening 이 걷는다 — 느린 기기에서 게임 시간이 늦게 흘러도 닿을 때까지
  hudLater('foeIntro', camOpen.mode === 'old' ? ARENA.startHold : CAMERA.open.introSec, () => el.classList.remove('show')); // 화면 글자 시계(일시정지·메뉴면 멈춘다)
}
function hideFoeIntro() {
  hudLater('foeIntro');
  $('foeIntro').classList.remove('show');
}

// ── 왼쪽 위 (10/14 사장님 '왼쪽 상단에는 스테이지 번호와 스테이지 이름'): docs/ui/hud_intro_2026-10-14.md · hud_type_system_2026-10-10.md §15 ──
//  첫 줄 = '스테이지 N · 무대 이름'(stages.js stageLabel — 순서표 밖 무대는 이름만).
//  무기 카드를 고르는 동안만 그 아래에 카드 안내 '무기 카드를 한 장 고르세요'(PC '(1 · 2)') — 10/14 03:3x 사장님 '이전처럼 복구'(00:4x 에 뺐던 줄).
//   예전 자리(왼쪽 위 칸의 마지막 줄, 위 6px)·꼴(--fw-label · --ls-label · 강조 색) 그대로, 크기는 칸 전체 작게 --fs-s (10/14 글자 규칙) (index.html #stageInfo em). 카드를 고르면 숨는다 — 자리는 두어
//   화면이 바뀌어 카드 자리를 다시 재도 들썩이지 않는다. 카드 줄은 이 칸 아래에서 시작한다 (layoutDraw)
//  10/14 03:3x 사장님 'AI 이름·기술명 표기는 아예 없앤다': 둘째 줄 'AI 이름 · 자세 / 기술'(foeLine · startFoeLine · paintFoeLine · updateFoeLine · foeTechPut)은 걷어냈다.
//   상대 기술 알림은 화면 어디에도 띄우지 않는다 (판 시작 가운데 소개 #foeIntro 는 그대로)
const stageInfo = $('stageInfo');
const drawGuide = stageInfo.querySelector('em'); // 카드 안내 줄
/** 판을 열 때(startFight): 무대 줄을 쓴다 */
function showStageInfo() {
  stageInfo.querySelector('.stg').textContent = stageLabel(stages.id);
  stageInfo.classList.add('show');
}
/** 카드 안내 줄: 'on' = 고르는 동안 보임 · 'off' = 카드를 고른 뒤 숨김(자리는 둔다) · null = 비움(뽑기가 끝남 — 자리도 없앤다) */
function setDrawGuide(mode) {
  drawGuide.textContent = mode ? (input.isTouchDevice ? '무기 카드를 한 장 고르세요' : '무기 카드를 한 장 고르세요 (1 · 2)') : '';
  drawGuide.classList.toggle('off', mode === 'off');
}

// ── 무기 뽑기: 판이 열리면 엎어 둔 카드 세 장. 왼쪽 두 장이 내 카드, 맨 오른쪽은 상대 무기 칸(회색, 고를 수 없다) ──
//  내 카드 하나를 누르면(PC는 1·2 키도) 뒤집혀 이번 판 내 무기가 나오고(0.45초), 0.35초 뒤 남은 내 카드가 어둡게 뒤집혀
//  무엇을 놓쳤는지 보여 준다. 0.8초에 상대 카드가 뒤집혀 제 색으로 상대 무기를 보여 준다 (prepareRound 가 정한 무기).
//  두 무기를 읽을 만큼 잠깐 더 보여 주고(상대 카드가 뒤집힌 뒤에 누르면 바로) 카드가 사라지면 무기가 손에 나타나고 판 시작 알림(FIGHT_START_TEXT).
//  고른 때부터 싸움까지 약 2.4초.
//  고르는 동안 싸움은 멈춰 있다: 판은 임시 무기(롱소드)로 세워 두기만 하고(물리·AI 없음, 무기는 감춤),
//  카드를 고르면 그 무기로 판을 새로 세운다. 순서는 게임 루프의 시간으로 재서 일시정지하면 함께 멈춘다.
//  카드 뒤집기·사라지기는 CSS 변환(transform)으로만 움직인다 (매 프레임 JS 로 그리지 않는다).
// 등급과 별개로 따로 대접하는 무기 카드 (금빛 일렁임·센 떨림). 오너 결정: "엑스칼리버를 등급과 별개로 우대할 필요는 없어" → 비워 둔다
const GRAND_WEAPONS = new Set();
const TIER_KO = TIER_LABEL; // 카드의 등급 글자 (??? 등급 포함, weapons.js)
const FOE_CARD = 2; // 맨 오른쪽 카드 = 상대 무기 칸
// 초 (고른 때부터). others: 남은 내 카드가 뒤집힘, foe: 상대 카드가 뒤집힘 (+0.45초면 다 뒤집힌다),
//  build: 고른 무기로 판을 새로 세움 (상대 카드가 다 뒤집힌 뒤, 아무것도 움직이지 않을 때), look: 사라지기 시작, fly: 사라지는 시간.
//  tapGuard 전의 누름은 버린다 (카드를 두 번·세 번 톡 친 손가락이 상대 카드가 뒤집히기도 전에 결과를 건너뛰지 않게).
//  그 뒤에 누르면(스페이스·엔터도) 남은 보여 주기를 건너뛰지만, 상대 무기가 잠깐은 보이도록 skip 전에는 사라지지 않는다
const DRAW_T = { ready: 0.45, others: 0.35, foe: 0.8, tapGuard: 0.95, build: 1.3, skip: 1.6, look: 2.3, fly: 0.45 }; // look 2.3: 상대 무기를 약 1초 읽게
const drawEl = $('draw');
const cardEls = [...drawEl.querySelectorAll('.wcard')];
// ── 카드 뒷면 ──
//  오너 결정: 픽셀 아트 뒷면(외형 PM v3, docs/design_language.md). 판마다 그 판 배경의 문양이다 — 포세이돈 신전·성 안뜰·산사·대성당.
//  조각(tile·frame·center·plaque, public/ui/cardbacks/px_<테마>_*.png)을 한 칸 = --px(게임 픽셀)로 정수 배 확대해 붙인다(index.html).
//  상대 칸은 회색 조각(_foe, tools/cardbacks/grey_foe.py)이다. 테마가 없는 배경(어두운 홀)은 classic(가죽 빛 바탕 + 마름모 칼 문장).
//  주소 ?back=<테마|classic> 으로 고정해 볼 수 있다
const PX_BACKS = { poseidon: '#1d3037', clearing: '#1a1816', castle: '#1e2433', temple: '#1a352b', poseidon_night: '#0c1220', cathedral: '#2b171a', loggia: '#302326', corsair: '#19383e', sacred_grove: '#1c3025', frozen_bay: '#18293a', qinglan: '#16332f', sluice: '#182a22', dayr: '#2a1d1b', dunhuang: '#2d2418', etna: '#1d1b21' }; // 테마 → 바탕색 (뒤 아홉은 샛별 저장소의 무대 — 얼어붙은 만·청람잔도는 10/11, 잠든 습지·소금 사막·철불 절벽·화산섬은 10/14 우리가 그림, tools/cardbacks/gen_pixel_cardbacks.py)
const BACK_PARTS = ['tile', 'frame', 'center', 'plaque'];
const BACK_PIN = params.get('back') in PX_BACKS || params.get('back') === 'classic' ? params.get('back') : null;
let cardBack = 'classic';
// 조각을 미리 받아 둔다(모두 합쳐 몇 KB): 카드가 뜰 때 뒷면이 비었다가 그려지지 않게
for (const t in PX_BACKS) for (const p of BACK_PARTS) for (const f of ['', '_foe']) new Image().src = `ui/cardbacks/px_${t}_${p}${f}.png`;
// 상대 칸 바탕색: CSS grayscale(1) brightness(.55) 와 같은 회색
const greyOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const v = Math.round((0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) * 0.55);
  return `rgb(${v},${v},${v})`;
};
const CARD_BACK_SVG =
  '<svg viewBox="0 0 60 100" aria-hidden="true"><path d="M30 3 L57 50 L30 97 L3 50 Z" fill="none" stroke="#d9a441" stroke-opacity=".75" stroke-width="2"/>' +
  '<path d="M30 11 L52 50 L30 89 L8 50 Z" fill="none" stroke="#d9a441" stroke-opacity=".35" stroke-width="1"/>' +
  '<path d="M30 18 L32.6 24 L32.6 60 L27.4 60 L27.4 24 Z" fill="#e8d3a0"/><rect x="19" y="60" width="22" height="3.6" rx="1.8" fill="#d9a441"/>' +
  '<rect x="28.3" y="63.6" width="3.4" height="12" fill="#8a5a2b"/><circle cx="30" cy="79" r="3.6" fill="#d9a441"/></svg>';
// 상대 칸의 칼 문장은 회색으로 (filter 를 쓰지 않는다: 뒤집히는 카드의 뒷면 숨기기가 사파리에서 풀릴 수 있다)
const CARD_BACK_SVG_FOE = CARD_BACK_SVG.replaceAll('#d9a441', '#86817a').replaceAll('#e8d3a0', '#a9a49c').replaceAll('#8a5a2b', '#55514c');
/** 판을 열 때: 그 판 배경의 뒷면으로 바꾼다 (카드마다 조각 그림을 --b-* 변수로 넣는다) */
function setCardBack(stageId) {
  cardBack = BACK_PIN || (stageId in PX_BACKS ? stageId : 'classic');
  drawEl.dataset.back = cardBack === 'classic' ? 'classic' : 'px';
  cardEls.forEach((el, i) => {
    const foe = i === FOE_CARD;
    const wb = el.querySelector('.wback');
    if (cardBack !== 'classic') {
      for (const p of BACK_PARTS) wb.style.setProperty(`--b-${p}`, `url("ui/cardbacks/px_${cardBack}_${p}${foe ? '_foe' : ''}.png")`);
      wb.style.setProperty('--b-bg', foe ? greyOf(PX_BACKS[cardBack]) : PX_BACKS[cardBack]);
    }
    // 뒷면 배지: 내 카드는 (PC) 누를 키 번호, 상대 칸은 "상대" (폰에서도 보인다)
    const emblem = cardBack === 'classic' ? (foe ? CARD_BACK_SVG_FOE : CARD_BACK_SVG) : '';
    wb.innerHTML = emblem + (foe ? '<span class="wkey wfoe">상대</span>' : `<span class="wkey">${i + 1}</span>`);
  });
}
const draw = { stage: null, t: 0, ids: [], pick: -1, others: false, foe: false, built: false, skip: false, hold: false }; // stage: choose → reveal → fly
setCardBack(stages.id);
cardEls.forEach((el, i) => el.addEventListener('click', () => pickCard(i)));
// 결과를 보는 동안 아무 데나 누르면 바로 싸움으로 (상대 카드가 뒤집히기 전의 누름은 치지 않고, 상대 무기가 잠깐 보인 뒤에 사라진다)
function skipReveal() {
  if (draw.stage === 'reveal' && draw.t >= DRAW_T.tapGuard) draw.skip = true;
}
/** 상대 칸을 눌렀다: 고를 수 없다는 뜻으로 살짝 흔들기만 한다 (고르는 동안만) */
function nudgeFoeCard() {
  if (state !== 'draw' || draw.stage !== 'choose') return;
  const el = cardEls[FOE_CARD];
  el.classList.remove('nope');
  void el.offsetWidth; // 흔들기 애니메이션을 처음부터 다시
  el.classList.add('nope');
}
cardEls[FOE_CARD].addEventListener('animationend', (e) => e.animationName === 'nope' && cardEls[FOE_CARD].classList.remove('nope'));
drawEl.addEventListener('pointerdown', skipReveal);
window.addEventListener('resize', () => layoutDraw()); // 폰을 돌리거나 전체화면이 되면 카드 크기를 다시 맞춘다
if (window.ResizeObserver) new ResizeObserver(() => layoutDraw()).observe(drawEl); // resize 이벤트 없이(늦게) 화면 상자만 바뀌어도 (홈 화면 앱)
document.fonts?.addEventListener?.('loadingdone', () => layoutDraw()); // 화면 글꼴(10/14 프리텐다드 + Cinzel)이 늦게 도착하면 글 넘침을 그 글꼴로 다시 잰다 (font-display: swap — 먼저 그린 시스템 글꼴로 잰 값을 버린다)

/**
 * 두 사람의 무기를 감추거나 보인다 (카드를 고르기 전에는 손에 칼이 보이면 안 된다).
 *  메쉬만 끄고 켠다: 원래 숨겨 둔 물리 전용 부품은 그대로 두고, 무기에 달린 빛(진짜 엑스칼리버의 aura.js)은 켜 둔다 —
 *  빛 개수가 바뀌면 모든 재질의 셰이더를 다시 만들어, 카드가 사라지는 순간 화면이 멈칫한다.
 */
function setWeaponsVisible(v) {
  for (const f of [player, enemy])
    for (const m of f?.meshes || [])
      if (m.kind === 'weapon')
        m.group.traverse((o) => {
          if (!o.isMesh) return;
          if (!v && o.visible) {
            o.visible = false;
            o.userData.drawHidden = true;
          } else if (v && o.userData.drawHidden) {
            o.visible = true;
            o.userData.drawHidden = false;
          }
        });
}

/** 카드 세 장을 새로 채워 엎어 놓는다: 내 카드 두 장 + 상대 무기 (prepareRound 가 정한 무기) */
function openDraw(savedCards = null) {
  const foeId = getWeapon(foeWeaponId).id; // 짧은 별칭(chicken 등)도 상대가 실제로 드는 무기 id 로
  Object.assign(draw, { stage: 'choose', t: 0, ids: [...(savedCards || drawCardIds()), foeId], pick: -1, others: false, foe: false, built: false, skip: false });
  saveJourneyRound(null, draw.ids.slice(0, 2));
  setCardBack(stages.id); // 이번 판 배경의 뒷면
  cardEls.forEach((el, i) => {
    const w = getWeapon(draw.ids[i]);
    el.className = i === FOE_CARD ? 'wcard foe' : 'wcard';
    el.dataset.tier = w.tier || 'common';
    el.classList.toggle('grand', GRAND_WEAPONS.has(w.id));
    el.setAttribute('aria-label', i === FOE_CARD ? '상대 무기 카드 (고를 수 없어요)' : `${i + 1}번 카드`); // 뒤집히면 무기 이름·등급·설명으로 바뀐다 (revealLabel)
    const [, main, sub] = w.nameKo.match(/^(.*?)\s*\((.*)\)\s*$/) || [null, w.nameKo, ''];
    el.querySelector('.wthumb').style.backgroundImage = `url("ui/weapons/${w.id}.webp"), radial-gradient(closest-side, var(--tg), transparent)`;
    el.querySelector('.wname').textContent = main;
    el.querySelector('.wsub').textContent = sub;
    el.querySelector('.wtier').textContent = TIER_KO[w.tier] || TIER_KO.common;
    // 에픽 특수 능력은 설명 끝의 "(별칭: 효과)" 를 따로 한 줄로, 등급 색으로 (weapons.js 가 desc 끝에 붙여 준다)
    const abil = w.ability ? ` (${w.ability})` : '';
    const desc = w.desc || '';
    el.querySelector('.wdesc').textContent = abil && desc.endsWith(abil) ? desc.slice(0, -abil.length) : desc;
    el.querySelector('.wabil').textContent = w.ability ? `(${w.ability})` : '';
  });
  drawEl.className = 'show choose';
  layoutDraw();
}

/**
 * 카드 크기와 자리 (판이 열릴 때 · 화면 상자가 바뀔 때): 카드 줄 칸(.drawRow) = 왼쪽 위 칸(무대 줄 · 카드 안내 줄)·멈춤 단추 아래부터 아래 안내 줄 위까지.
 *  가로 화면은 카드 높이를 화면 높이의 DRAW_CARD_H 까지만 (사장님 10/14 '카드도 너무 커' — 확인 전 수) — 칸 안에서 화면 가운데에 가깝게 놓는다.
 *  카드의 왼쪽·위는 정수 px 에 놓는다 (가운데 맞춤이 반 px 에 떨어지면 픽셀 뒷면이 흐려진다)
 */
const DRAW_CARD_H = 0.6;
const DRAW_CARD_MIN_W = 150;
function layoutDraw() {
  if (!draw.stage) return;
  const H = drawEl.clientHeight || window.innerHeight;
  if (!H) return; // 아직 보이지 않음 (ResizeObserver 가 보일 때 다시 부른다)
  // 왼쪽 위 칸(무대 줄 + 카드 안내 줄 — 10/14 03:3x 되살림): 칸 아래부터. 안내 줄은 카드를 고른 뒤에도 뽑기가 끝날 때까지 자리를 지킨다(setDrawGuide 'off')
  //  — 그 사이 화면이 바뀌어 다시 재도 카드가 안내 줄 자리로 올라가지 않는다 (예전 AI 둘째 줄 자리를 미리 비우던 것은 그 줄과 함께 걷어냈다)
  let introBottom = topButtons.getBoundingClientRect().bottom;
  if (stageInfo.classList.contains('show')) introBottom = Math.max(introBottom, stageInfo.getBoundingClientRect().bottom);
  // 아래 안내 줄(#hint) 자리: 카드가 사라진 뒤에 뜨지만, 카드도 그 위에서 끝나게
  const hcs = getComputedStyle(hint);
  const hintTop = H - parseFloat(hcs.bottom) - (parseFloat(hcs.lineHeight) || 17) - 12;
  drawEl.style.setProperty('--top', `${Math.round(introBottom + 10)}px`);
  drawEl.style.setProperty('--padT', '0px');
  drawEl.style.setProperty('--padL', '0px');
  drawEl.style.removeProperty('--thumbMin'); // 그림 칸 최소 높이는 기본(36 · 낮은 자리 28)부터 — 아래 끝에서 넘칠 때만 줄인다
  const box = drawEl.querySelector('.drawRow').getBoundingClientRect();
  const row = { left: box.left, top: box.top, width: box.width, height: Math.max(0, Math.min(box.bottom, hintTop - 6) - box.top) };
  // 세로로 든 폰(좁고 높은 자리): 카드가 좁고 길어진다. 좁아도 낮은 자리(작은 가로 폰 568×320 등)는 가로 배치가 글이 더 잘 들어간다
  const narrow = row.width < 560 && row.height > row.width * 0.8;
  // 아주 낮은 자리(568×320 같은 작은 가로 폰, 소개가 두 줄일 때): 카드를 옆으로 넓혀(높이보다 넓게) 설명 줄 수를 줄이고,
  //  여백·그림·글자를 최소로 줄인다 (#draw.low)
  const low = !narrow && row.height < 180;
  const gap = narrow || low ? 10 : 14;
  let cw = Math.floor(Math.min(230, (row.width - 2 * gap) / 3, low ? row.height * 1.3 : row.height / (narrow ? 1.6 : 1.15)));
  // 가로: 높이 상한 → 폭 (모양 2:3). 다만 폭은 DRAW_CARD_MIN_W 아래로 줄이지 않는다 (낮은 화면에서 앞면 설명 글이 넘치지 않게 — 카드가 조금 통통해진다)
  if (!narrow && !low) cw = Math.min(cw, Math.max(DRAW_CARD_MIN_W, Math.floor((H * DRAW_CARD_H) / 1.5)));
  let ch = Math.floor(Math.min(cw * (narrow ? 2.1 : 1.5), row.height, narrow || low ? Infinity : H * DRAW_CARD_H));
  // 픽셀 뒷면의 한 칸 = 게임 픽셀(픽셀 모드와 같은 크기, 큰 화면은 4까지). 카드 크기를 두 칸의 배수로 맞춰 가운데 정렬이 반 칸 어긋나지 않게
  const px = cw < 130 ? 2 : Math.min(4, Math.max(3, Math.round(H / 180)));
  if (cardBack !== 'classic') {
    cw = Math.floor(cw / (2 * px)) * 2 * px;
    ch = Math.floor(ch / (2 * px)) * 2 * px;
  }
  // 자리: 가로는 칸 안 가운데, 세로는 화면 가운데에 가깝게(칸을 벗어나지 않게). 둘 다 정수 px
  const padL = Math.max(0, Math.floor((row.width - 3 * cw - 2 * gap) / 2));
  const padT = Math.max(0, Math.min(Math.round((H - ch) / 2 - row.top), Math.floor(row.height - ch)));
  drawEl.style.setProperty('--padT', `${padT}px`);
  drawEl.style.setProperty('--padL', `${padL}px`);
  drawEl.style.setProperty('--px', `${px}px`);
  drawEl.style.setProperty('--gap', `${gap}px`);
  drawEl.style.setProperty('--cw', `${cw}px`);
  drawEl.style.setProperty('--ch', `${ch}px`);
  // 번호 배지(높이 22px)의 가운데: 픽셀 뒷면은 아래 원판(아래에서 3칸 띄운 10칸 원판)의 가운데, classic 은 아래에서 10px
  drawEl.style.setProperty('--kb', cardBack === 'classic' ? '10px' : `${Math.max(4, 8 * px - 11)}px`);
  // 글자 크기는 CSS 글자 규칙의 세 단계 (10/14 — docs/ui/hud_type_system_2026-10-10.md §16): 카드 이름 보통 --fs-m · 부제·등급·설명·특수 능력 작게 --fs-s.
  //  큰 카드(폭 205 · 높이 260 이상 — PC 1280×720 의 224×344 등)는 이름·설명만 한 단계 위(크게 · 보통)와 등급 알약 여백 (#draw.wide — CSS 가 정한다, 여기서는 px 를 쓰지 않는다).
  //  설명을 줄이지는 않는다(예전 fitCardText 의 6 % 씩 줄이기는 바닥 = 작은 카드의 시작 크기가 되어 걷어냈다)
  const big = cw >= 205 && ch >= 260;
  drawEl.classList.toggle('wide', big);
  drawEl.classList.toggle('low', low);
  // 설명이 넘치면(낮은 가로 화면의 긴 설명) 높이는 두고 폭만 두 칸씩 넓힌다
  const step = cardBack !== 'classic' ? 2 * px : 2;
  const cwMax = Math.floor(Math.min(230, (row.width - 2 * gap) / 3));
  while (!narrow && cw + step <= cwMax && cardTextOverflows()) {
    cw += step;
    drawEl.style.setProperty('--cw', `${cw}px`);
    drawEl.style.setProperty('--padL', `${Math.max(0, Math.floor((row.width - 3 * cw - 2 * gap) / 2))}px`);
  }
  // 폭을 끝까지 넓혀도 넘치면(568×320 같은 아주 작은 가로 화면) 그림 칸 최소 높이를 줄여 글자에 자리를 준다
  for (const m of [24, 16]) {
    if (narrow || !cardTextOverflows()) break;
    drawEl.style.setProperty('--thumbMin', `${m}px`);
  }
}
/** 앞면 글이 정말 넘치는가: 그림 칸이 가장 작게(min-height) 줄었는데도 마지막 글줄이 아래 여백에 닿는다 (그림 칸이 남은 높이를 채우므로 그림이 줄어들 수 있으면 넘침이 아니다) */
function cardTextOverflows() {
  return cardEls.some((el) => {
    const face = el.querySelector('.wface');
    const thumb = el.querySelector('.wthumb');
    const abil = el.querySelector('.wabil');
    const last = abil.textContent ? abil : el.querySelector('.wdesc');
    if (thumb.offsetHeight > parseFloat(getComputedStyle(thumb).minHeight) + 0.5) return false;
    return last.offsetTop + last.offsetHeight > face.clientHeight - parseFloat(getComputedStyle(face).paddingBottom);
  });
}


/** i번째 카드를 고른다 (누르기 · 1/2 키). 상대 칸(맨 오른쪽)은 고를 수 없다: 누르면 살짝 흔들릴 뿐 */
function pickCard(i) {
  if (i === FOE_CARD) return nudgeFoeCard();
  if (state !== 'draw' || draw.stage !== 'choose' || draw.t < DRAW_T.ready) return; // 막 뜬 카드는 시작 단추를 두 번 누른 손가락에 안 뽑히게
  Object.assign(draw, { stage: 'reveal', t: 0, pick: i });
  const grand = GRAND_WEAPONS.has(draw.ids[i]);
  cardEls[i].classList.add('picked', 'flipped');
  revealLabel(i);
  drawEl.classList.replace('choose', 'reveal');
  sound.cardFlip({ pick: true, tier: getWeapon(draw.ids[i]).tier, grand }); // 두꺼운 카드 "촥" → 앞면이 드러나며 낮은 "둥" (레전드·에픽은 작은 반짝임)
  haptic(grand ? 1 : 0.35);
  setDrawGuide('off'); // "무기 카드를 한 장 고르세요"는 고르는 동안만 (예전처럼)
}

/** 뒤집힌 카드를 화면 읽기 프로그램이 무기 이름으로 읽게 한다 */
function revealLabel(i) {
  const w = getWeapon(draw.ids[i]);
  const who = i === FOE_CARD ? '상대 무기: ' : i === draw.pick ? '내 무기: ' : '';
  cardEls[i].setAttribute('aria-label', `${who}${w.nameKo} · ${TIER_KO[w.tier] || TIER_KO.common} · ${(w.desc || '').replace(/\n/g, ' ')}`);
}

/** 고른 무기로 판을 새로 세운다 (카드가 가리고 있을 때, 아무것도 움직이지 않는 순간에) */
function buildPicked() {
  draw.built = true;
  lastPlayerWeapon = draw.ids[draw.pick];
  newRound(lastPlayerWeapon);
  saveJourneyRound(lastPlayerWeapon);
  setWeaponsVisible(false);
}

/** 게임 루프가 state 'draw' 일 때 부른다: 내 카드 뒤집기 → 남은 내 카드 → 상대 카드 → 결과 보여 주기 → 사라지기 → 싸움 시작 */
function updateDraw(dt) {
  if (!draw.stage || draw.hold) return; // hold: 스크린샷용으로 순서를 잠깐 세운다 (game.draw.hold)
  draw.t += dt;
  if (draw.stage === 'reveal') {
    if (!draw.others && draw.t >= DRAW_T.others) {
      draw.others = true;
      const other = 1 - draw.pick; // 남은 내 카드
      cardEls[other].classList.add('flipped', 'missed');
      revealLabel(other);
      sound.cardFlip({ pick: false }); // 남은 카드가 "촥"
    }
    if (!draw.foe && draw.t >= DRAW_T.foe) {
      // 상대 카드가 뒤집혀 제 색으로 상대 무기를 보여 준다 (소리는 고른 카드처럼: 등급 반짝임, 진짜 엑스칼리버면 맑은 울림)
      draw.foe = true;
      const w = getWeapon(draw.ids[FOE_CARD]);
      const grand = GRAND_WEAPONS.has(w.id);
      cardEls[FOE_CARD].classList.add('flipped');
      revealLabel(FOE_CARD);
      sound.cardFlip({ pick: true, tier: w.tier || 'common', grand });
      haptic(grand ? 1 : 0.25);
    }
    if (!draw.built && draw.t >= DRAW_T.build) buildPicked();
    if (draw.t >= DRAW_T.look || (draw.skip && draw.t >= DRAW_T.skip)) {
      if (!draw.built) buildPicked();
      Object.assign(draw, { stage: 'fly', t: 0 });
      drawEl.classList.add('fly');
      setWeaponsVisible(true); // 카드가 사라지는 동안 칼이 손에 나타난다
    }
  } else if (draw.stage === 'fly' && draw.t >= DRAW_T.fly) {
    closeDraw();
    beginFight();
  }
}

/** 카드를 치운다 (다 끝났을 때, 또는 뽑기 도중에 "처음부터 다시") */
function closeDraw() {
  draw.stage = null;
  drawEl.className = '';
  setDrawGuide(null);
}

// 판 알림 (가운데 — 판 시작 · 승리 · 패배만). 판 시작 글은 이 상수 하나 (10/10 19:2x 사장님 'Battle 을 한국어로 · 적막에 어울리는 걸로').
//  사장님 결정 '대면' (10/10 19:4x — 후보 결투·겨룸·일합·승부·마주섬·대면). 바꾸려면 이 값만
const FIGHT_START_TEXT = '대면';
function showToast(text, ms = 1200) {
  toast.textContent = text;
  toast.classList.add('show');
  hudLater('toast', ms / 1000, ms ? () => toast.classList.remove('show') : null);
}

// 터치 이동 조이스틱: 싸움 중에만 보인다 (무기 뽑기 동안에는 걸을 수 없으니 감춘다 — 카드 자리도 넓어진다)
function applyMoveMode() {
  $('moveStick').classList.toggle('show', input.isTouchDevice && state !== 'menu' && state !== 'draw');
  $('btnParry').classList.toggle('show', input.isTouchDevice && state !== 'menu' && state !== 'draw'); // 막기 단추: 조이스틱과 같은 때 (오른쪽 아래)
}

function showHint(text, ms = 3500) {
  hint.textContent = text;
  hint.classList.add('show');
  hudLater('hint', ms / 1000, () => hint.classList.remove('show'));
}

async function startFight() {
  const savedRound = pendingJourney;
  pendingJourney = null;
  sound.unlock();
  sound.ambience(); // 배경의 고요 (포세이돈: 파도·바람, 산사: 산바람·풍경·산새). 아주 작게, 처음 한 번만 켜진다
  // 폰이면 전체화면 + 가로 고정 시도 (지원 안 하면 조용히 넘어감)
  if (input.isTouchDevice) {
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.('landscape');
    } catch {
      /* 무시 */
    }
  }
  $('rotate').classList.add('enabled');
  menu.classList.remove('show');
  screenTint.visible = true;
  topButtons.classList.add('show');
  closeDraw(); // 뽑기 도중에 "처음부터 다시"를 눌렀으면 그 카드는 치운다
  toast.classList.remove('show');
  nextRoundStage(); // 배경: 첫 판은 메뉴 뒤 그대로, 그 다음 판부터는 정해진 순서로 다음 배경 (짓는 멈칫은 메뉴가 아직 떠 있는 동안)
  planOpening(); // 우화 첫 전투 무대 훑기 + 포크 이어하기의 상대/무기 복원
  if (savedRound?.foe) {
    currentFoe = CHARACTERS_BY_ID[savedRound.foe];
    foeWeaponId = savedRound.foeWeapon;
    sound.prepareVoices(['player', voiceOf(currentFoe)]);
  } else prepareRound(); // 이번 상대 · 상대 무기
  hideFoeIntro(); // 가운데 소개는 싸움이 시작될 때 (beginFight) — 카드를 고르는 동안에는 띄우지 않는다
  showStageInfo(); // 왼쪽 위 무대 줄
  techClear(); // 새 판이 열렸다: 오른쪽 위 ② 마지막 기술 · ① 자세 칸을 비운다 (10/14 03:1x·03:3x — 둘 다 시간으로는 사라지지 않는다)
  guardClear();
  if (savedRound?.weapon) {
    lastPlayerWeapon = savedRound.weapon;
    newRound(savedRound.weapon);
    beginFight();
    return;
  }
  if (FIXED_WEAPON) {
    // 테스트용 ?weapon= : 뽑기 없이 그 무기로 바로 싸움 시작
    newRound(FIXED_WEAPON);
    beginFight();
    return;
  }
  // 무기 뽑기: 판은 임시 무기로 세워 두기만 하고(시간은 멈춤, 무기는 감춤) 카드 세 장(내 카드 둘 + 상대 칸)을 띄운다
  newRound('longsword');
  setWeaponsVisible(false);
  state = 'draw';
  input.enabled = false;
  applyMoveMode();
  setDrawGuide('on'); // 왼쪽 위 무대 줄 아래 "무기 카드를 한 장 고르세요" (10/14 03:3x 되살림 — 카드 자리를 재기 전에)
  openDraw(savedRound?.cards);
}

function saveJourneyRound(weapon, cards = null) {
  if (JOURNEY_SAVE_ENABLED) writeJourney({ stage: stages.id, foe: currentFoe?.id ?? null, foeWeapon: getWeapon(foeWeaponId).id, weapon, cards, lastWeapon: lastPlayerWeapon });
}

function validJourney() {
  const saved = readJourney();
  const weapons = new Set(WEAPON_LIST.map(w => w.id));
  if (!saved || !STAGE_IDS.includes(saved.stage)
    || (saved.foe && !CHARACTERS_BY_ID[saved.foe])
    || [saved.weapon, saved.foeWeapon, saved.lastWeapon, ...(saved.cards || [])].some(id => id && !weapons.has(id))) return null;
  return saved;
}
export const canContinueJourney = () => !!validJourney();
export const getLobbyPlayer = () => player;
export const getLobbySettings = () => ({ fpsCap: settings.fpsCap });
export function setLobbyFps(enabled) { settings.fpsCap = !!enabled; saveSettings(); refreshSettingsUI(); }

// 대기실의 출발 버튼에서만 판을 시작한다.
export async function launchJourney(choice) {
  const saved = choice === 'continue' ? validJourney() : null;
  if (choice === 'continue' && !saved) return false;
  pendingJourney = saved;
  stageFought = false; lastRoundWon = false; lastPlayerWeapon = saved?.lastWeapon || null;
  if (useStage(saved?.stage || nextStage())) stages.warm(renderer, camera);
  sound.setStage(stages.id);
  await startFight();
  return true;
}

/** 무기를 받았다: 싸움 시작 (판 시작 알림, 조이스틱, 조작 안내) */
function beginFight() {
  input.resetTransient();
  state = 'fight';
  input.enabled = true;
  emoSeen.player = emoSeen.enemy = null; // 감정 알림은 판마다 새로 (시작 감정도 알린다 — 브란은 분노로 시작한다)
  mudNoticeShown = false; // 진흙 알림도 판마다 한 번
  clearEmoMsg();
  techClear();
  guardClear(); // 무기를 받아 판을 새로 세웠으니 자세 이름도 처음부터 다시 읽는다
  applyMoveMode();
  // 판 시작 카메라 (10/15): 무대 훑기 판은 처음 CAMERA.open.introAt 초 동안 무대만 보이고 그 뒤에 알림·소개·안내 (watchOpening). 내려앉기·예전 판은 지금 바로
  if (camOpen.mode === 'sweep') {
    camOpen.swept = stages.id; // 이 무대는 훑었다 — 같은 무대 다음 판은 내려앉기
    camOpen.cue = true;
  } else showFightCues();
}
/** 판 시작 글: 가운데 소개(지금부터 발이 풀릴 때까지 — showFoeIntro) · 판 알림 '대면' · 아래 조작 안내 */
let introShownFor = null; // 지난 판에 소개를 띄운 상대·무대 (다시 겨루기면 소개를 빼려고 — 사장님 10/15 '다시 겨루기에서는 상대 소개 빼' · 확인표 1637)
function showFightCues() {
  const introKey = `${currentFoe?.id ?? currentFoe?.name ?? ''}@${stages.id}`;
  if (introKey !== introShownFor) showFoeIntro(currentFoe); // 같은 무대에서 같은 상대와 다시 = 다시 겨루기 — 소개 없음(판 알림 '대면'·조작 안내는 그대로)
  else showFoeIntro(null);
  introShownFor = introKey;
  showToast(FIGHT_START_TEXT, 900);
  showHint(input.isTouchDevice ? '조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기' : '클릭해서 마우스 잠그기 · WASD로 걷기 · 클릭으로 찌르기');
}

let pausedFrom = 'fight'; // 싸움 중에 멈췄나, 무기 뽑기 중에 멈췄나 (계속하기가 돌아갈 곳)
let pauseOpen = false; // pause() 로 연 메뉴인가 (판 끝 결과 메뉴와 구별)
function pause() {
  if (state !== 'fight' && state !== 'draw') return;
  pausedFrom = state;
  state = 'paused';
  pauseOpen = true;
  input.enabled = false;
  input.resetTransient();
  document.exitPointerLock?.();
  $('menuTitle').textContent = '일시정지';
  $('menuSub').textContent = '설정을 바꾸거나 계속할 수 있어요.';
  $('btnStart').textContent = '처음부터 다시';
  $('btnResume').style.display = '';
  showMenu();
}

function showMenu() {
  document.activeElement?.blur?.();
  menu.classList.add('show');
  menu.querySelector('.card').scrollTop = 0;
}

function resume() {
  pauseOpen = false;
  input.resetTransient();
  sound.unlock(); // 폰이 전화·잠금 등으로 소리를 멈췄으면 다시 켠다
  menu.classList.remove('show');
  state = pausedFrom;
  input.enabled = state === 'fight';
  applyMoveMode();
  last = performance.now();
}

$('btnStart').addEventListener('click', startFight);
testRoute.mount(document, getWeapon(FIXED_WEAPON || 'longsword').nameKo); // test=1: 메뉴에 '테스트 고르기로'
$('btnResume').addEventListener('click', resume);
$('btnPause').addEventListener('click', pause);
// 두 번째 손가락은 click 을 믿을 수 없다(첫 손가락이 칼·조이스틱을 쥔 채) → 터치의 pointerdown 으로도 멈춘다 (10/8 입력 수명주기)
$('btnPause').addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  event.preventDefault();
  pause();
});
window.addEventListener('keydown', (e) => {
  if (document.documentElement.hasAttribute('data-start-open')) return;
  if (state === 'draw') {
    // 무기 뽑기: 1·2 로 카드 고르기 (3 번째는 상대 칸이라 키가 없다), 결과를 보는 동안 스페이스·엔터로 바로 싸움
    const k = { Digit1: 0, Digit2: 1, Numpad1: 0, Numpad2: 1 }[e.code];
    if (k != null) pickCard(k);
    else if (e.code === 'Space' || e.code === 'Enter') skipReveal();
  }
  if (e.code === 'KeyF') parryHold.key = true; // 막기 (누르는 동안 — keyup 이 놓음)
  if (e.code !== 'KeyP') return;
  if (state === 'fight' || state === 'draw') pause();
  else if (state === 'paused' && (!roundOver || pauseOpen)) resume(); // 자동 일시정지(화면 이탈)가 판 끝 느린 화면과 겹쳐도 P 로 돌아온다 (10/8 검토 11)
});
// 싸우는 도중 전화·잠금·다른 앱 때문에 소리가 멈췄으면(아이폰은 'interrupted'), 다음에 화면을 만질 때 다시 켠다.
// (일시정지 → 계속하기를 누르지 않아도 되게. 시작 버튼을 누르기 전에는 소리 장치를 만들지 않는다: sound.ctx 가 있을 때만)
for (const ev of ['touchend', 'pointerup', 'keydown']) {
  window.addEventListener(ev, () => sound.ctx && sound.unlock(), { passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause(); // 화면을 떠나면(전화·앱 전환) 멈춘다 — 돌아와서 첫 손가락이 지난 획을 잇지 않게 (10/8)
  if (!document.hidden && sound.ctx) sound.unlock(); // (손을 대지 않아도 되는 브라우저는 여기서 바로 다시 켜진다)
});
window.addEventListener('blur', pause);
// 막기 단추·키 (누르는 동안): 단추는 포인터를 붙잡아 손가락이 밖으로 미끄러져도 뗄 때까지 누름 — 칼 끌기(캔버스)와 따로
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyF') parryHold.key = false;
});
window.addEventListener('blur', () => {
  parryHold.key = false;
  parryHold.btn = null;
});
{
  const b = $('btnParry');
  const up = (e) => {
    if (e.pointerId !== parryHold.btn) return;
    parryHold.btn = null;
    b.classList.remove('on');
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (parryHold.btn != null) return;
    parryHold.btn = e.pointerId;
    b.classList.add('on');
    try {
      b.setPointerCapture(e.pointerId);
    } catch {
      /* 생략 */
    }
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ── 감정이 켜지는 순간 한 줄 알림 (아래 가운데 감정 줄 #emoMsg) ──
//  10/10 20:3x 사장님 '상태 3종은 전처럼 화면 중앙에 뜨게 · 감정 문장 가운데로 복귀' (docs/ui/hud_type_system_2026-10-10.md §14) — v2 의 오른쪽 위 ③ 경직·상태 묶음은 없앴다.
//  상대: "오소리 브란이 공포에 잠식된다" / 주인공: 주어 없이 "공포에 잠식된다" (10/10 문구 정리: 다른 감정 줄과 같은 현재형) (집념은 주어 없이: 상대 "집념을 보인다", 주인공 "집념이 생긴다")
//  색은 상태 3종 한 색(사장님 19:2x '상태 3종은 모두 같은 색으로 통일' — 10/14 글자 색 넷의 '상태·상대' --c-alert)
const EMO_TEXT = {
  fear: (who) => (who ? `${who}${josa(who, '이', '가')} ` : '') + '공포에 잠식된다',
  obsession: (who) => (who ? '집념을 보인다' : '집념이 생긴다'), // 사장님 결정: 주어 없이 — 상대는 "집념을 보인다", 주인공은 "집념이 생긴다"
  anger: (who) => (who ? `${who}의 ` : '') + '분노가 폭발한다',
};
/** 받침이 있으면 a(이), 없으면 b(가) */
function josa(word, a, b) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return a;
  return (c - 0xac00) % 28 ? a : b;
}
const emoSeen = { player: null, enemy: null };
function watchEmotions() {
  const pairs = [
    ['player', playerEmo?.emotion ?? null, null],
    ['enemy', ai?.emotion ?? null, currentFoe?.name || '상대'],
  ];
  for (const [k, emo, who] of pairs) {
    if (emo !== emoSeen[k]) {
      emoSeen[k] = emo;
      if (emo && EMO_TEXT[emo] && state === 'fight' && !roundOver) showEmoMsg(EMO_TEXT[emo](who), emo);
    }
  }
}
//  감정 줄 (E, 아래 가운데 — 감정 문장 · 부활 알림): 줄 세우기 — 앞 것이 EMO_MIN 초는 보인 뒤에 다음 것으로 (최대 2 개 기다림, 넘치면 오래된 것을 버린다). 시계는 게임 시간
const EMO_MIN = 1.2;
const emoQueue = [];
let emoCur = null; // { text, emo, sec, age }
function showEmoMsg(text, emo, ms = 2000) {
  const m = { text, emo, sec: ms / 1000, age: 0 };
  if (emoCur && emoCur.age < EMO_MIN) {
    emoQueue.push(m);
    if (emoQueue.length > 2) emoQueue.shift();
    return;
  }
  playEmoMsg(m);
}
function playEmoMsg(m) {
  const el = $('emoMsg');
  if (!el) return;
  emoCur = m;
  el.textContent = m.text;
  el.dataset.emotion = m.emo;
  el.classList.add('show');
}
function tickEmoMsg(dt) {
  if (!emoCur) return;
  emoCur.age += dt;
  if (emoQueue.length && emoCur.age >= EMO_MIN) return playEmoMsg(emoQueue.shift());
  if (emoCur.age >= emoCur.sec) {
    emoCur = null;
    $('emoMsg')?.classList.remove('show');
  }
}
// 잠든 습지 진흙 웅덩이 알림 (샛별 저장소 325a5c38 의 '진흙 · 발이 느려집니다' 를 옮겨 고침): 그쪽은 아래 가운데 새 칸에 밟는 동안 내내 띄웠지만,
//  우리는 아래 가운데에 안내·알림 줄이 이미 있어(docs/ui/hud_type_system_2026-10-10.md) 알림 줄(E)로 판마다 처음 밟을 때 한 번만 (확인표 1116)
let mudNoticeShown = false;
function watchMudNotice() {
  if (mudNoticeShown || !player?.alive || !((player.surfaceSpeedScale ?? 1) < 0.98)) return;
  mudNoticeShown = true;
  showEmoMsg('진흙 · 발이 느려집니다', 'mud', 2000);
}
/** 감정 줄을 비운다 (새 판) */
function clearEmoMsg() {
  emoQueue.length = 0;
  emoCur = null;
  $('emoMsg')?.classList.remove('show');
}

// ── 부활 (이졸데, src/revive.js · revive_fx.js): 연출이 알리는 때에 소리·알림 ──
//  fall: 처음 쓰러짐 — 죽음 목소리 대신 신음 (쓰러뜨린 한 방에 몸 소리가 방금 신음을 냈으면 겹치지 않게)
//  light: 하늘에서 빛이 내려오기 시작 — 성스러운 울림 (소리 담당이 sound.revive 를 만든다. 없으면 조용히 넘어간다)
//  notice: 빛이 다 내려왔다 — "○○가 투지로 다시 일어선다" (감정 알림 자리), 캐릭터 시트에 lines.revive 가 있으면 대사 한 줄도
reviveFx.onCue = (cue, f) => {
  const ch = f === enemy ? currentFoe : null;
  const voice = f === enemy ? voiceOf(currentFoe) : 'player';
  if (cue === 'fall') {
    const bs = bodySounds[f === enemy ? 1 : 0];
    if (!bs || bs.t - bs.lastHurt > 0.5) {
      sound.hurt(voice, 1.2, { me: f === player });
      if (bs) bs.lastHurt = bs.t;
    }
  } else if (cue === 'light') sound.revive?.(voice);
  else if (cue === 'notice' && state === 'fight' && !roundOver) {
    const who = ch?.name || '상대';
    showEmoMsg(`${who}${josa(who, '이', '가')} 투지로 다시 일어선다`, 'revive', 2600);
    if (ch?.lines?.revive?.length) showFoeLine(ch, randomLine(ch, 'revive'));
  }
};

/** 플레이어 감정: 이번 프레임의 사건을 모아 판정하고, 배율표를 파이터에 얹고, 공포면 손을 떨고, 화면 가장자리에 색을 입힌다 */
function updatePlayerEmotion(dt) {
  if (!playerEmo || !player || !enemy) return;
  const ev = playerEv;
  ev.bleeding = player.bleed > 0.01;
  ev.foeBleeding = enemy.bleed > 0.01;
  ev.winning = enemy.blood < player.blood;
  ev.weaponBroken = player.weaponBroken;
  ev.disarmed = !player.armed;
  ev.foeBroke = enemy.weaponBroken;
  // 상대 칼이 코앞: 상대가 베는 중이고 붙어 있다 / 상대가 진품 엑스칼리버를 들고 사정거리 근처
  const d = ai?.d ?? 3;
  ev.nearMiss = ai?.mode === 'attack' && ai.phase === 'strike' && d < 1.65;
  ev.foeLegendNear = enemy.armed && enemy.weapon?.tier === 'legend' && d < 2.5;
  if (player.alive) playerEmo.update(dt, ev);
  ev.hurt = ev.parried = ev.landed = false;
  player.emoMods = playerEmo.mods;
  // 공포 손 떨림: AI 와 같은 방식 — 0.06~0.1초마다 새 방향, 크기는 배율표의 tremor. 지금 얹혀 있는 값과의 차이만 더한다
  const T = playerTremor;
  const amp = player.emoMods.tremor;
  if (amp > 0 && player.alive) {
    T.t -= dt;
    if (T.t <= 0) {
      T.t = 0.06 + Math.random() * 0.04;
      const a = Math.random() * Math.PI * 2;
      const r = amp * (0.5 + Math.random() * 0.5);
      T.x = Math.cos(a) * r;
      T.y = Math.sin(a) * r;
    }
  } else T.x = T.y = 0;
  player.handOffset.x += T.x - T.ax;
  player.handOffset.y += T.y - T.ay;
  T.ax = T.x;
  T.ay = T.y;
  // 화면: 감정별 색이 세기만큼 (공포 푸른 회색·분노 붉음·집념 금빛)
  screenTint.setEmotion(playerEmo.emotion, playerEmo.emotion && EMO_ABILITY.enabled ? 0.25 + 0.5 * playerEmo.intensity : playerEmo.emotion ? 0.15 : 0);
}

// 체력 게이지 대신: 피를 흘리거나 아프면 화면 가장자리가 붉게 물든다 (하프 소드처럼 숫자 없음)
function updateHud() {
  const lost = THREE.MathUtils.clamp((1 - player.blood) / 0.5, 0, 1);
  const pulse = player.bleed > 0.002 ? 0.15 * (0.5 + 0.5 * Math.sin(performance.now() / 180)) : 0;
  const v = Math.min(1, lost * 0.85 + Math.min(1, player.pain) * 0.35 + pulse);
  screenTint.setBlood(v);
}

/** 판 끝 결과 글자: 결정타 슬로모션(slowMo)이 끝난 뒤에 한 번. 슬로모션 동안 참수·쓰러지는 장면을 글자가 가리지 않게 */
function showRoundResult() {
  if (resultShown || slowMo > 0) return;
  resultShown = true;
  showToast(lastRoundWon ? '승리' : '패배', 0);
}

function checkRoundEnd(dt) {
  if (!roundOver) {
    if (!enemy.alive || !player.alive) {
      roundOver = true;
      resultShown = false;
      const win = !enemy.alive;
      if (JOURNEY_SAVE_ENABLED) recordDuel(win);
      lastRoundWon = win; // 다음 판을 열 때 다음 무대로 넘어갈지 (nextRoundStage)
      // 고유 동작 해금 (사장님 결정 10/13 22:3x): 여정(무대마다 그곳 검객 — 이기면 다음 무대로 넘어간다: nextRoundStage 의 advance)에서 이긴 판 = 무대 하나 깸.
      //  깬 수가 10 의 배수가 되면 인장 하나 → 아래 가운데 안내 줄(#hint)에 한 줄 (도장 연출·모음 화면은 다음 작업)
      if (win && foeParam === 'stage' && !STAGE_PIN && !testRoute.active) {
        const cl = addJourneyClear();
        if (cl.seal) showHint(sealNotice(cl.seal), 3400);
        // 승리 직후 다음 무대를 저장해 재접속으로 같은 승리/인장을 중복 받지 않는다.
        if (JOURNEY_SAVE_ENABLED) writeJourney({ stage: nextStage(stages.id), lastWeapon: player.weapon.id });
      }
      showRoundResult();
      if (!win && currentFoe) showFoeLine(currentFoe, randomLine(currentFoe, 'win')); // 상대의 승리 대사 (죽은 쪽은 말이 없다)
      else lastFoeLine = '';
    }
    return;
  }
  showRoundResult();
  roundOverTime += dt;
  if (roundOverTime > 3.5 && state === 'fight') {
    state = 'paused';
    input.enabled = false;
    input.resetTransient();
    document.exitPointerLock?.();
    toast.classList.remove('show');
    const win = !enemy.alive;
    const loser = win ? enemy : player;
    // 한 줄로 짧게: 이겼으면 내가 한 일(베었다), 졌으면 내가 당한 일(베였다)
    const cause = win
      ? { 목: '목을 베었다', 머리: '머리를 쳤다', 출혈: '출혈로 쓰러뜨렸다', 기절: '기절시켰다', 내려찍기: '내려찍었다' }[loser.causeOfDeath] || '쓰러뜨렸다'
      : { 목: '목을 베였다', 머리: '머리를 맞았다', 출혈: '피를 너무 흘렸다', 기절: '기절했다', 내려찍기: '내려찍혔다' }[loser.causeOfDeath] || '쓰러졌다';
    $('menuTitle').textContent = win ? '승리' : '패배';
    // 졌으면 상대의 승리 대사를 한 줄 덧붙인다 (사장님 확정)
    $('menuSub').textContent = !win && lastFoeLine ? `${cause} · ${currentFoe.name}: “${lastFoeLine}”` : cause;
    { const src = !win && lastFoeLine ? lineSourceOf(currentFoe, lastFoeLine) : ''; if (src) { const s = document.createElement('small'); s.textContent = src; $('menuSub').append(s); } } // 대사 아래 줄에 출처 (병마용 — index.html #menuSub small)
    // 여정(무대마다 그곳 검객): 이기면 다음 상대, 지면 같은 상대와 다시 (주소로 상대·배경을 고정했으면 그냥 다시 싸우기)
    $('btnStart').textContent = win && foeParam === 'stage' && !STAGE_PIN ? '다음 여정' : '다시 겨루기'; // 사장님 10/14 11:1x '다음 여정. 다시 겨루기.' (전 '다음 상대' · '다시 싸우기')
    $('btnResume').style.display = 'none';
    testRoute.resultLabel($('btnStart'));
    reviveFx.reset(); // 결과 화면: 부활 연출이 남아 있으면 치운다 (상대가 일어서는 동안 내가 죽었을 때)
    hideFoeIntro(); // 화면 글자 시계는 게임 시간이라 결과 창 뒤에 남지 않게 여기서 걷는다 (대사는 결과 창 부제에 있다)
    clearEmoMsg();
    showMenu();
  }
}

// ── 카메라: 내 캐릭터 오른쪽 어깨 너머에서 상대를 바라본다 ──
//  흔들림은 "스프링에 매단 카메라"로 계산한다: 충격이 오면 그 방향으로 밀렸다가 부드럽게 제자리로.
//  (예전처럼 매 프레임 무작위로 떨지 않는다)
const camShake = { o: new THREE.Vector3(), v: new THREE.Vector3() };
function kickCamera(dir, strength) {
  camShake.v.addScaledVector(dir, strength);
}
const camTarget = new THREE.Vector3(); // 평소 자리 (어깨 너머)
const camFollow = new THREE.Vector3(); // 따라가는 점 (걸러진 내 무게중심)
const camLook = new THREE.Vector3();
const camDir = new THREE.Vector3(1, 0, 0);
const _cd = new THREE.Vector3();
const _co = new THREE.Vector3();
const _cl = new THREE.Vector3();
// 따라가기 (10/15 — src/camera_rig.js 머리말 · config CAMERA.followTau): f = 따라가는 점(camFollow) · prev·vel = 지난 화면 몸 자리와 빠르기(게임 m/s) · lift = 물러날 때 올린 몫 0~1
const camRig = followState(camFollow);
let camSteps = 0; // 이번 화면에 돈 물리 스텝 수 (게임 루프가 적는다)

// ── 판 시작 카메라 (10/15 사장님 '첫 전투 시작 시 스테이지 전체를 빠르게 슥 훑고 기본 카메라 화면으로 다가가게 해. 3초 정도? … 카메라가 캐릭터에 따라 붙으면 바로 전투 시작') ──
//  mode 'sweep' = 그 무대의 첫 판(메뉴에서 시작 · '다음 여정'으로 새 무대 · 테스트 경로 새 무대 · ?stage= 고정 무대의 첫 판): 무대 훑기 CAMERA.open.sweepSec 초
//       'settle' = 같은 무대를 다시('다시 겨루기' · 처음부터 다시): 짧은 내려앉기 settleSec 초 · 'old' = `?openSweep=0` (9/30 판 시작, 정지 2 s)
//  정지(발 묶임 fighter.feetHeld · AI 판 시작 몸짓)는 이 브라우저에서만 판 시작 카메라 길이와 같다: ARENA.startHold 를 판마다 바꾼다(게임 시간 = 실제 초 × 템포).
//   시뮬 도구는 이 파일을 읽지 않아 config 값(SIM_HOLD 2.0)을 그대로 쓴다 — 관문 그대로
const SIM_HOLD = ARENA.startHold;
const camOpen = { mode: 'old', params: null, centre: { x: 0, z: 0 }, swept: null, cue: false, introUp: false, u: null, endPos: new THREE.Vector3(), endLook: new THREE.Vector3() }; // u: 스크린샷용으로 판 시작 자리를 그 u 에 세운다 (game.camOpen.u — null 이면 시계대로) · endPos/endLook: 지금 평소 자리
/** 판을 열 때(startFight · 처음 메뉴 뒤 판): 판 시작 카메라와 정지 길이를 정한다 */
function planOpening() {
  if (!OPEN_SWEEP) {
    camOpen.mode = 'old';
    ARENA.startHold = SIM_HOLD;
  } else {
    camOpen.mode = stages.id !== camOpen.swept ? 'sweep' : 'settle';
    ARENA.startHold = (camOpen.mode === 'sweep' ? CAMERA.open.sweepSec : CAMERA.open.settleSec) * TEMPO;
  }
  camOpen.params = sweepParams(stages.id);
  camOpen.centre = { x: 0, z: stageStartZ(stages.id) }; // 두 사람 시작 자리의 가운데 (잠든 습지는 +z 로 비켜 선다)
  camOpen.cue = camOpen.introUp = false;
}
/** 판 시작 카메라의 자리 0~1 (1 = 끝 — 발이 풀린다) */
function openProgress() {
  if (camOpen.u != null) return camOpen.u;
  return ARENA.startHold > 0 ? Math.min(1, player.fightT / (ARENA.startHold - 1e-6)) : 1; // fighter.feetHeld 와 같은 끝(− 1e-6): 카메라가 닿는 화면 = 발이 풀리는 화면
}
/** 게임 루프(싸움 중): 무대 훑기 판의 알림·소개·안내를 훑기 시작 introAt 초 뒤에 */
function watchOpening() {
  if (camOpen.cue && player.fightT >= CAMERA.open.introAt * TEMPO) {
    camOpen.cue = false;
    camOpen.introUp = true;
    showFightCues();
  }
  if (camOpen.introUp && !player.feetHeld) {
    camOpen.introUp = false; // 카메라가 닿았다 = 싸움 시작: 소개를 걷는다
    hideFoeIntro();
  }
}
/** 새 판(newRound): 따라가기를 새 몸 자리에 바로 맞춘다 */
function resetCamera() {
  followReset(camRig, player.pelvisPos);
  camSteps = 0;
  const e = enemy.pelvisPos;
  _cd.set(e.x - camFollow.x, 0, e.z - camFollow.z);
  if (_cd.length() > 0.3) camDir.copy(_cd.normalize()); // 지난 판 끝 방향에서 돌아오지 않게 (판 시작 자리가 이 방향으로 정해진다)
}
function updateCamera(dt) {
  if (!player || window.game?.freeCam) return; // freeCam: 디버그용으로 카메라를 직접 조종
  // 흔들리는 골반 대신 몸 전체 무게중심을 따라간다 (참수된 몸은 무게중심에 날아가는 머리가 섞이니 골반을 따른다)
  const src = (!player.decapitated && player.com) || player.pelvisPos;
  const standing = player.state === 'stand';
  // 따라가는 점: 지금 몸 자리를 물리 스텝 사이 남은 시간(acc)만큼 지난 빠르기로 앞으로 민 자리를 CAMERA.followTau 로 한 번만 거른다 (서 있지 않으면 followTauDown) — camera_rig.followStep
  const a = CAM_OLD ? camFollow.lerp(src, 1 - Math.exp(-dt * CAMERA.follow)) : followStep(camRig, src, camSteps, acc, dt, standing, CAMERA, PHYSICS.timestep);
  const b = (!enemy.decapitated && enemy.com) || enemy.pelvisPos;
  // 나 → 상대 방향 (너무 붙어 있으면 이전 방향 유지) — 도는 것은 지금처럼 부드럽게(3/s)
  _cd.set(b.x - a.x, 0, b.z - a.z);
  if (_cd.length() > 0.3) camDir.lerp(_cd.normalize(), 1 - Math.exp(-dt * 3)).normalize();
  const right = _cd.set(-camDir.z, 0, camDir.x);
  // 물러나는 동안 카메라를 조금 올린다 (CAMERA.retreatLift — 가까이 따라붙은 상대를 내 몸이 덜 가리게): 지난 화면 몸 빠르기의 카메라 방향 반대 몫으로 — camera_rig.retreatStep
  const lift = CAM_OLD ? 0 : retreatStep(camRig, camDir.x, camDir.z, dt, standing, CAMERA);
  // 지형 무대(화산섬): 카메라 높이·바라보는 높이·해와 그림자 과녁을 내 무게중심 밑 땅 높이만큼 올린다 (평지 무대는 0 — 그대로)
  const terrainY = player.terrain ? player.terrain.heightAt(a.x, a.z) : 0;
  const camH = CAMERA.height + CAMERA.retreatLift * lift + terrainY;
  basePose(a, camDir.x, camDir.z, lift, terrainY, CAMERA, camTarget); // 어깨 너머: a 에서 뒤로 back · 오른쪽 shoulder · 높이 camH
  // 비기 카메라 연출 (10/10 이베리아 사이드스텝 사선 베기): 내 쪽 무게중심을 축으로 SECRET.camSwing ° 를 camSwingIn 초에 돌렸다가 camSwingOut 초에 되돌림 (부드럽게)
  if (camSwing.t >= 0) {
    camSwing.t += dt;
    const S = CONFIG.SECRET;
    const ti = S.camSwingIn;
    const to = S.camSwingOut;
    const w = camSwing.t < ti ? THREE.MathUtils.smoothstep(camSwing.t, 0, ti) : 1 - THREE.MathUtils.smoothstep(camSwing.t, ti, ti + to);
    if (camSwing.t > ti + to) camSwing.t = -1;
    else {
      const ang = camSwing.sign * S.camSwing * (Math.PI / 180) * w;
      const ox = camTarget.x - a.x;
      const oz = camTarget.z - a.z;
      camTarget.x = a.x + ox * Math.cos(ang) - oz * Math.sin(ang);
      camTarget.z = a.z + ox * Math.sin(ang) + oz * Math.cos(ang);
    }
  }
  // 최소 거리 (CAMERA.minDist): 몸이 카메라 쪽으로 밀려 와도 카메라가 그 자리에서 바로 물러난다 — 지금 몸 자리(거르기 전) 기준, 수평 (camera_rig.keepDistance)
  if (!CAM_OLD) keepDistance(camTarget, src, CAMERA.minDist);
  // 경기장 바깥 돌벽을 뚫고 나가지 않게
  const r = Math.hypot(camTarget.x, camTarget.z);
  if (r > 10.5) camTarget.multiplyScalar(10.5 / r).setY(camH);
  clampStageCamera(a, camTarget, arenaStone?.navigation); // 잠든 습지: 카메라가 석상을 가로지르거나 안으로 들어가지 않게 (석상 없으면 그대로)
  const look = _cl.copy(a).addScaledVector(camDir, CAMERA.lookAhead).setY(1.1 + terrainY);
  camOpen.endPos.copy(camTarget);
  camOpen.endLook.copy(look);
  // 판 시작: 무대 훑기(그 무대 첫 판) · 내려앉기(다시 겨루기 · `?openSweep=0`) — 끝(u = 1)에서 평소 자리와 같아 이어 붙는 곳에서 튀지 않는다 (src/camera_rig.js)
  const u = openProgress();
  if (u < 1) {
    if (camOpen.mode === 'sweep') sweepPose(u, camTarget, look, camOpen.centre, player.terrain ? player.terrain.heightAt(camOpen.centre.x, camOpen.centre.z) : 0, camOpen.params, _co, look);
    else settlePose(u, camTarget, look, camDir.x, camDir.z, CAMERA.openBack, CAMERA.openUp, _co, look);
    camera.position.copy(_co);
    camLook.copy(look);
  } else if (CAM_OLD) {
    const k = 1 - Math.exp(-dt * 6); // 예전: 자리·바라보는 점을 한 번 더 거른다 (자리 6)
    camera.position.lerp(camTarget, k);
    clampStageCamera(a, camera.position, arenaStone?.navigation);
    camLook.lerp(look, k);
  } else {
    camera.position.copy(camTarget);
    camLook.copy(look);
  }
  if (player.terrain) camera.position.y = Math.max(camera.position.y, player.terrain.heightAt(camera.position.x, camera.position.z) + 0.45); // 비탈 위쪽으로 돈 카메라가 땅에 묻히지 않게 (샛별 값 0.45 m)
  // 발걸음: 디딜 때 살짝 내려앉음
  if (player.footstep > 0) {
    camShake.v.y -= CAMERA.stepBob * 12 * player.footstep;
    player.footstep = 0;
  }
  // 스프링 흔들림 적분 (단단함 170, 감쇠 13)
  const h = Math.min(dt, 1 / 30);
  camShake.v.addScaledVector(camShake.o, -170 * h).multiplyScalar(Math.max(0, 1 - 13 * h));
  camShake.o.addScaledVector(camShake.v, h);
  camera.position.add(camShake.o);
  camera.lookAt(camLook);
  camera.position.sub(camShake.o); // 다음 프레임 따라가기는 흔들림 없는 위치 기준
  sun.position.set(a.x + SUN_OFF.x, SUN_OFF.y + terrainY, a.z + SUN_OFF.z);
  sun.target.position.set(a.x, terrainY, a.z);
  stages.snapSun(); // 그림자 화소 맞춤 — 무대가 켠 때만(소금 사막의 긴 그림자가 기어다니며 깜빡이지 않게, stages.js). 다른 무대는 그대로
}

// ── 지금 검술 자세 이름 ① (10/14 03:3x 사장님 '자세 칸도 계속 보이게': 싸움 중에는 지금 자세 이름이 늘 보이고, 자세가 바뀌면 그 자리에서 바꿔 끼운다) ──
//  예전 '바뀌면 1.6 s 보이고 사라짐'은 없앴다. 휘두르는 동안처럼 자세가 잡히지 않은 때는 마지막으로 잡힌 자세 이름을 그대로 둔다 (guardLast).
//  막기 버튼을 누르는 동안은 막기 자세 이름 — 그대로. 놓으면 마지막 보통 자세 이름으로 돌아온다.
//  보이는 때 = 싸움 화면(state 'fight')에서 내가 살아 있을 때 (guardVisible — 매 프레임): 카드 고르기·메뉴(처음 · 일시정지 · 결과)에서는 지금처럼 숨고,
//  쓰러지면 자세가 없으니 내린다. 새 판이 열리면 비운다 (guardClear — startFight · beginFight). docs/ui/hud_type_system_2026-10-10.md §15
const guardName = $('guardName');
let guardShown = -1; // 칸에 그린 것: 자세 번호 · 'gun' · 'parry:…' (-1 = 비었음)
let guardLast = -1; // 마지막으로 잡힌 보통 자세 (휘두르는 동안 · 막기를 놓은 뒤 이 이름을 둔다)
/** 두 줄 (10/10 글자 체계 · 문구 규칙 §4-5): 첫 줄 = 한국어 이름(괄호 앞), 둘째 줄 = 원어(괄호 안) · 설명 — 넘치면 … (CSS) */
function paintGuard(key, name, tail) {
  guardShown = key;
  const [main, sub] = splitName(name);
  const b = document.createElement('b');
  b.textContent = main;
  const d = document.createElement('small');
  d.textContent = [sub, tail].filter(Boolean).join(' · ');
  guardName.replaceChildren(b, d);
}
function updateGuardName() {
  if (player?.alive && player.stamina.exhausted) {
    if (guardShown !== 'exhausted') paintGuard('exhausted', '탈진', '숨 고르기 · 이동·공격·막기 불가');
    return;
  }
  // 막기 버튼을 누르는 동안: ① 자세 칸에 지금 잡은 막기 자세 이름 (첫 줄 유파 이름 · 둘째 줄 원어 · 막기 / 막기 기다림). 자리가 바뀔 때마다 바꿔 끼운다
  if (playerGuard?.active && player.alive) {
    const key = `parry:${playerGuard.mode}:${playerGuard.line}`;
    if (key !== guardShown) {
      const info = playerGuard.nameOf(playerGuard.line);
      if (info) paintGuard(key, info.name, playerGuard.mode === 'defend' ? '막기' : '막기 기다림');
    }
    return;
  }
  const gun = player.weapon?.gun; // 권총: 칼 자세 대신 '사격 자세' 하나만 (gun.js GUN_STANCE)
  // 보정 v2 (s > 0): 날것 자세라 휘두르지도(quiet > 0) 되돌아오지도 않을 때만 이름을 바꾼다 (여쭘 20, 기존 깃발만)
  const sk = player.skill;
  const rest = !(sk.corr === 'v2' && sk.level > 0) || (sk.quiet > 0 && !sk.recovering);
  const g = (gun || (player.guardWeight() > 0.5 && rest)) && player.alive ? (gun ? 'gun' : player.guardPose.nearest) : -1;
  if (g === 'gun' || g >= 0) guardLast = g;
  if (guardLast === guardShown) return; // 막기를 놓은 뒤(guardShown 'parry:…')에도 여기서 마지막 보통 자세로 돌아온다
  if (guardLast === -1) {
    // 막기를 놓았는데 아직 잡힌 보통 자세가 없다 (판 시작 바로 뒤) — 막기 이름이 남지 않게 비운다
    guardShown = -1;
    guardName.replaceChildren();
    return;
  }
  // 자세 이름: 검술 풀이(sword_art.js resolveSwordArt)의 names — 무기별·라이브러리 자세표가 있으면 그 이름(상단·팔상·3번 자세…), 마무리 자세(g ≥ 14)는 늘 GUARDS
  const info = guardLast === 'gun' ? GUN_STANCE : player.swordArt.names[guardLast];
  if (info) paintGuard(guardLast, info.name, info.desc);
}
/** 매 프레임: ① 은 싸움 화면에서 내가 살아 있고 그릴 이름이 있을 때만 보인다 */
function guardVisible() {
  guardName.classList.toggle('show', state === 'fight' && !!player?.alive && guardShown !== -1);
}
/** 새 판: ① 을 비운다 */
function guardClear() {
  guardShown = guardLast = -1;
  guardName.replaceChildren();
  guardName.classList.remove('show');
}

// ── 유파 기술 알림 ② (10/9 사장님 '패시브가 발동될 때 알아차릴 수 있게 상태 메시지처럼 화면 중앙에 기술명 출력해' → 10/10 오른쪽 위 → 10/14) ──
//  10/10 20:3x 사장님 답 (docs/ui/hud_type_system_2026-10-10.md §14): 오른쪽 위는 두 묶음 — ① 자세(#guardName) ② 패시브·비기(#techSlot), 둘 다 줄 하나.
//   ② = 내 비기 · 내 고유 동작 + 내 비기 창 · 고노센(길목 지키기) 준비. 첫 줄 한국어 이름(괄호 앞), 둘째 줄 원어 · 꼬리표 `내 유파 · 종류` (문구 규칙 §4-4·4-5)
//  10/14 03:1x 사장님 '내 기술창엔 마지막 기술이 계속 표시되게 해. 자동으로 사라지는 거 이상해' (§15):
//   기술(비기 · 고유 동작)은 시간으로 사라지지 않는다 — 다음 기술이 오면 그 자리에서 바꿔 끼우고, 새 판이 열리면 비운다 (techLine.last · techClear).
//   잠깐짜리 상태 알림(비기 창 열림 secretReady · 고노센/길목 준비 secretArm)만 그 일이 이어지는 동안 마지막 기술을 덮었다가(techLine.over) 끝나면 마지막 기술로
//   돌아온다 — 준비 글이 남지 않게. 시간 TECH_CUE_TIME 은 이 둘에만 쓴다. 준비 글은 다른 상태 알림(비기 창)을 덮지 않고, 새 기술이 오면 덮던 상태 알림도 내린다(새 것이 이긴다).
//  10/14 03:3x 사장님 'AI 이름·기술명 표기는 아예 없앤다': 상대 기술 알림(ai.js 가 적는 enemy.techCue · techAll)은 화면 어디에도 띄우지 않는다 (② 로도 되돌리지 않는다)
//  보이는 때 = 싸움 화면(state 'fight') — 카드 고르기·메뉴에서는 숨는다(내용은 두고, 새 판에서 비운다). ① 과 같다
//  v2 의 ③ 경직·상태 묶음(#stateCue)은 없앴다 ('경직과 상태는 그냥 빼버리자'): 감정 3종은 아래 가운데 감정 줄로 돌아갔고(watchEmotions), 경직 글은 STIFF_TEXT 스위치(기본 끔)
const techCueEl = $('techCue'); // ② 를 담는 겉 칸 (예전 도구가 숨기거나 dataset.kind 를 읽는다 — 지금 그린 알림의 kind·who 를 적어 둔다)
const TECH_CUE_KIND = { passive: '패시브', unique: '고유 동작', secret: '비기', secretReady: '비기', secretArm: '비기' };
// 잠깐짜리 상태 알림의 최소 시간 (초, 게임 시간) — 그 일이 이어지는 동안은 hold 가 늘린다(비기 창은 열린 동안 · 준비는 준비된 동안). 기술(비기 · 고유 동작)은 시간이 없다
const TECH_CUE_TIME = { secretReady: 0.5, secretArm: 0.3 };
// 경직 글 스위치 (10/10 20:3x 사장님 '경직과 상태는 그냥 빼버리자' — 경직 기능(물리·AI)은 그대로, 화면 글만 끔).
//  true 로 바꾸면 경직이 시작될 때 아래 가운데 감정 줄에 '경직'(나) / '상대 경직'을 상태 색으로 한 번 띄운다 (디렉터가 사장님께 '가운데로 되살릴지' 여쭙는 중)
const STIFF_TEXT = false;
let stiffSeen = { me: false, foe: false };
/** '한국어 (원어)' → [한국어, 원어]. 괄호 뒤 말은 '· …' 이면 둘째 줄로, 아니면 첫 줄 뒤에 (예: '자→격 (刺→擊) 고리' → ['자→격 고리', '刺→擊']) */
function splitName(s) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*(.*)$/.exec(s ?? '');
  if (!m || !m[1]) return [s ?? '', ''];
  const rest = m[3].replace(/^·\s*/, '');
  if (!rest || m[3].startsWith('·')) return [m[1], [m[2], rest].filter(Boolean).join(' · ')];
  return [`${m[1]} ${rest}`, m[2]];
}
/** 꼬리표 `[내|상대] 유파 · 종류` (문구 규칙 §4-4) */
const cueTag = (c) => `${c.who === 'me' ? '내' : '상대'}${c.schoolKo ? ` ${c.schoolKo}` : ''} · ${TECH_CUE_KIND[c.kind] ?? ''}`;
const techLine = { el: $('techSlot').querySelector('.slot'), it: null, last: null, over: null }; // ② 줄 하나: it = 지금 그린 것 · last = 마지막 기술 · over = 덮고 있는 상태 알림
/** 줄 그리기: 첫 줄 b, 둘째 줄 small = (원어 .o · ) 꼬리표 .t — 좁으면 원어 쪽만 … 으로 줄고 꼬리표는 늘 다 보인다 (CSS) */
function paintLine(L, it) {
  const b = document.createElement('b');
  b.textContent = it.b;
  const small = document.createElement('small');
  const t = document.createElement('span');
  t.className = 't';
  t.textContent = it.o ? `\u00a0· ${it.tag}` : it.tag; // 앞 칸은 붙지 않는 빈칸 (flex 칸 첫 빈칸은 사라진다)
  if (it.o) {
    const o = document.createElement('span');
    o.className = 'o';
    o.textContent = it.o;
    small.append(o);
  }
  small.append(t);
  L.el.replaceChildren(b, small);
  L.el.dataset.kind = it.kind;
  L.el.dataset.who = it.who;
  L.el.classList.add('show');
  L.it = it;
  techCueEl.dataset.kind = it.kind;
  techCueEl.dataset.who = it.who;
}
/** ② 에 그릴 것: 덮고 있는 상태 알림, 없으면 마지막 기술, 둘 다 없으면 빈 칸 */
function techShow() {
  const it = techLine.over ?? techLine.last;
  if (it === techLine.it) return;
  if (it) return paintLine(techLine, it);
  techLine.it = null;
  techLine.el.classList.remove('show');
}
/** ② 에 알림 하나: 기술(t 없음)은 마지막 기술로 바꿔 끼우고 덮던 상태 알림도 내린다. 상태 알림은 그 위를 덮는다 (준비 글 ambient 는 다른 상태 알림을 덮지 않는다) */
function techPut(it) {
  if (it.t == null) {
    techLine.last = it;
    techLine.over = null;
  } else {
    if (it.ambient && techLine.over) return;
    techLine.over = it;
  }
  techShow();
}
/** 매 프레임: 덮고 있는 상태 알림의 시간을 센다 — 끝나면(또는 싸움이 끝나면) 마지막 기술로 돌아온다. 기술은 세지 않는다 */
function techTick(dt, live) {
  const it = techLine.over;
  if (!it) return;
  const h = it.hold?.(); // true = 그 일이 이어진다(시간을 늘린다) · 'end' = 끝났다(바로 내린다)
  if (h === true) it.t = Math.max(it.t, 0.15);
  else if (h === 'end') it.t = 0;
  it.t -= dt;
  if (it.t > 0 && live) return;
  techLine.over = null;
  techShow();
}
/** ② 를 비운다 (새 판이 열림 — startFight · beginFight) */
function techClear() {
  techLine.last = techLine.over = null;
  techShow();
}
/** ② 에 알림 하나 (c = { text, kind, who?, schoolKo }) — kind 가 TECH_CUE_TIME 에 있으면 상태 알림(hold 로 늘림), 아니면 기술 */
function showTechCue(c, hold) {
  const status = c.kind in TECH_CUE_TIME;
  const [main, sub] = splitName(c.text);
  techPut({
    t: status ? TECH_CUE_TIME[c.kind] : null,
    ambient: c.kind === 'secretArm', // 고노센·길목 준비는 다른 상태 알림(비기 창)을 덮지 않는다
    kind: c.kind,
    who: c.who === 'me' ? 'me' : 'foe',
    b: main,
    o: sub,
    tag: cueTag(c),
    hold: status ? hold : null,
  });
}
/** 플레이어 비기 알림: kind 'secretReady'(창 열림 — 상태 알림, 열린 동안만) | 'secret'(실행 — 기술, 다음 기술·새 판까지 남는다). 싸움 중이면 늘 — 비기 창은 조작이다 */
function showPlayerCue(S, kind) {
  if (state !== 'fight' || !S) return;
  const T = TRADITIONS[player?.swordArt?.tradition];
  let hold = kind === 'secretReady' ? () => (playerSecret?.open ? true : 'end') : null;
  // 독일 감아 들기 (10/11 — 붙어 있는 동안 창): 붙은 시간 어드밴티지(secret.js bindGain)가 차오르는 것을 첫 줄 뒤 다섯 칸으로 (가볍게)
  if (kind === 'secretReady' && S.cond?.window === 'bind') {
    const base = hold;
    const name = splitName(S.nameKo ?? S.name)[0];
    hold = () => {
      const o = playerSecret?.open;
      const b = techLine.el.querySelector('b');
      if (o?.ctx?.ev === 'parry' && b) {
        const k = (bindGain(o.ctx.held ?? 0) - 1) / Math.max(1e-6, CONFIG.SECRET.deBindGain - 1);
        const n = Math.round(5 * Math.min(1, Math.max(0, k)));
        b.textContent = `${name} ${'▮'.repeat(n)}${'▯'.repeat(5 - n)}`;
      }
      return base();
    };
  }
  showTechCue({ text: S.nameKo ?? S.name, kind, who: 'me', schoolKo: T?.nameKo ?? '' }, hold);
}
function updateTechCue(dt) {
  // 플레이어 비기 창이 새로 열림
  if (playerSecret && playerSecret.opened !== secretOpenSeen) {
    secretOpenSeen = playerSecret.opened;
    if (playerSecret.open) {
      showPlayerCue(playerSecret.S, 'secretReady');
      try {
        navigator.vibrate?.(CONFIG.SECRET.playerVibrate); // 짧은 진동 (지원 안 하면 생략)
      } catch {
        /* 생략 */
      }
    }
  }
  const live = state === 'fight' && !!enemy?.alive && !roundOver;
  const liveMine = state === 'fight' && !roundOver;
  const pPhase = player?.skill?.secretPhase ?? null;
  // 고노센 준비 (10/10 02:4x): 상대 간격 밖 iaiArmTime 초가 차면 ② 에 흐린 '고노센 준비' — 준비된 동안 마지막 기술을 덮는다 (다른 상태 알림이 없을 때만)
  //  10/11 이베리아 길목 지키기(v6): 내 칼끝 거리 밖 gilmokArmTime 초가 차면 같은 자리·꼴로 '길목 지키기 준비' (secret.js PlayerSecretWatch.gilArm)
  const arm = CONFIG.SECRET.iai && playerSecret?.S?.do?.instant ? playerSecret.iaiArm : playerSecret?.S?.do?.gilmok ? playerSecret.gilArm : null;
  const pArmed = !!arm?.armed;
  if (liveMine && pArmed && !pPhase && !playerSecret.open && !techLine.over) {
    const armHold = () => (arm.armed && !player?.skill?.secretPhase && !playerSecret.open ? true : 'end');
    showTechCue({ text: arm === playerSecret.gilArm ? '길목 지키기 준비' : '고노센 준비', kind: 'secretArm', who: 'me', schoolKo: TRADITIONS[player?.swordArt?.tradition]?.nameKo ?? '' }, armHold);
  }
  // 경직 글 (STIFF_TEXT, 기본 끔): 켜면 경직이 시작될 때 감정 줄에 한 번
  const myStiff = liveMine && pPhase === 'stiff';
  const foeStiff = live && ai?.secretRun?.stage === 'stiff';
  if (STIFF_TEXT && myStiff && !stiffSeen.me) showEmoMsg('경직', 'stiff', 1200);
  if (STIFF_TEXT && foeStiff && !stiffSeen.foe) showEmoMsg('상대 경직', 'stiff', 1200);
  stiffSeen = { me: myStiff, foe: foeStiff };
  // 내 고유 동작 (10/13 — 고유 동작이 발동한 순간 unique_assist.js 가 player.uniqueCue 에 적는다): 기술 — 다음 기술·새 판까지 남는다, 꼬리표 '내'
  const uc = player?.uniqueCue ?? null;
  if (uc && uc !== uniqueCueSeen) {
    uniqueCueSeen = uc;
    if (liveMine) showTechCue(uc);
  }
  // 상대 기술 알림(enemy.techCue · techAll)은 읽지 않는다 — 10/14 03:3x 상대 기술 표기 없앰
  if (!(state === 'paused' && pauseOpen)) techTick(dt, liveMine); // 일시정지 창이 덮은 동안은 멈춘다 (창을 닫으면 이어서)
  const on = state === 'fight' && !!techLine.it; // 싸움 화면에서만 보인다 (카드 고르기·메뉴에서 숨김 — ① 과 같다)
  techLine.el.classList.toggle('show', on);
  techCueEl.classList.toggle('show', on);
}

// ── 게임 루프 ──
// 성능 측정 표시: 주소에 ?fps=1 을 붙이면 왼쪽 위에 초당 프레임·물리·그리기 시간·게임 속도가 나온다
const perf = params.get('fps') ? new PerfMeter(renderer, () => `배경 ${stages.id}  짓기 ${stages.buildMs.toFixed(0)}ms${stages.warmMs ? ` + GPU 준비 ${stages.warmMs.toFixed(0)}ms` : ''}`) : null;
let last = performance.now();
let acc = 0;
// 화면 갱신 상한 (CONFIG.RENDER.fpsCap, 사장님 9/30): 90/120 Hz 화면에서 그리기만 60 fps 로 거른다.
//  물리 스텝·입력·소리·카메라 따라가기는 rAF 마다 예전 그대로. 거르는 건 renderer.render 와 그 직전의 겉모습 갱신뿐
const renderCap = createRenderCap();

function frame(now) {
  requestAnimationFrame(frame);
  // 시작 화면이 앞에 있는 동안에는 뒤의 3D 렌더·물리 시간을 멈춘다.
  if (document.documentElement.hasAttribute('data-start-open')) { last = now; acc = 0; return; }
  sound.setPaused(state !== 'fight' && state !== 'draw'); // 샛별 저장소 무대 셋의 배경음·세부음만 메뉴·일시정지 동안 줄인다 (stage_detail_sound.js)
  const frameMs = now - last;
  let dt = Math.min(0.1, frameMs / 1000);
  last = now;
  let physMs = 0, physSteps = 0, capped = false, simWant = 0, simGot = 0; // 성능 측정 표시(?fps=1)용
  const paint = renderCap.tick(dt, settings.fpsCap ? CONFIG.RENDER.fpsCap : 0); // 이번 프레임을 그리나

  if (state === 'fight' && player) {
    // 손 목표 갱신 (입력 → 플레이어)
    const d = input.consumeHandDelta();
    const exhausted = player.stamina.exhausted;
    if (exhausted) { d.x = 0; d.y = 0; }
    // 멈칫하는 동안엔 손가락 움직임도 느리게 반영한다 (멈칫이 끝나는 순간 손이 휙 튀지 않게)
    const inScale = hitStop > 0 ? 0.25 : 1;
    // 칼 쪽 화면을 톡 치면(마우스는 끌지 않고 클릭) 찌른다 (skill.js thrust). 권총은 손가락이 닿는 순간 쏜다 (쏘는 타이밍이 실력이라 뗄 때까지 늦추지 않는다)
    input.tapOnDown = !!player.weapon?.gun;
    let taps = input.consumeTaps();
    if (exhausted) taps = 0;
    // 플레이어 비기 (10/9 23:5x): 창이 열려 있을 때 공격 입력(톡 = 찌르기, 휘두르기만큼 빠른 끌기 = 베기)이 오면 그 입력 대신 비기 완벽 실행.
    //  실행·경직 동안은 칼 입력(끌기·톡)을 무시한다 — 발(스틱)은 실행 동안 내 것, 경직 동안은 안 듣는다 (사장님 10/10 20:5x '잠깐 아예 못 움직이게' — 칼은 skill.js holdStiff 가 멈춰 둔다)
    const swipe = Math.hypot(d.x, d.y) / Math.max(dt, 1e-3) >= CONFIG.SKILL.swingSpeed;
    let secBusy = exhausted || !!player.skill.secretPhase;
    // 이베리아 길목 (사장님 결정 10/11 13:2x): 준비(armed)가 켜져 있으면 창을 기다리지 않고 공격 입력 하나가 곧 길목 한 칼 (secret.js fireArmed — 플레이어만)
    const gilReady = !!playerSecret?.S?.do?.gilmok && !!playerSecret.gilArm?.armed;
    if ((playerSecret?.open || gilReady) && !secBusy && player.alive && (taps > 0 || swipe)) {
      const o = playerSecret.open ? playerSecret.fire() : playerSecret.fireArmed();
      if (o) o.dir = [d.x, d.y]; // 비기를 낸 끌기의 방향 — 이베리아 흐름(10/11)이 이 칼의 흐름을 이어받는다 (톡이면 0 → 걸러진 손 목표 속도)
      if (player.skill.secret(o)) {
        secBusy = true;
        showPlayerCue(o.S, 'secret');
      }
    }
    // 중국 막기 연환 미리 받기 (10/12 — SECRET.cnBuffer, secret.js canBuffer): 정한 자세로 막아 칼이 맞닿은 동안 온 공격 입력을 받아 두고(칼이 떨어지는 스텝에 곧장 연환),
    //  받아 둔 동안은 칼 입력(끌기·톡)을 삼킨다 — 보통 공격·막기 풀림으로 새지 않게 (한 번 끈 손가락의 남은 움직임까지)
    if (!secBusy && player.alive && (taps > 0 || swipe) && playerSecret?.canBuffer()) playerSecret.buffer([d.x, d.y]);
    const bufHold = !secBusy && !!playerSecret?.bufferHold;
    if (secBusy || bufHold) taps = 0;
    // 막기 버튼 (10/11): 누르는 동안 손은 막기가 쥔다 (느린 끌기는 버림). 누른 채 휘두르거나(swipe — 비기 입력과 같은 문턱) 톡 치면 그 공격이 끝날 때까지 놓는다 —
    //  공격이 끝남 = 검술 층의 휘두르기·찌르기가 꺼짐 (지난 스텝 값). 막기 연환 창이 열려 있었으면 위에서 이미 비기로 나갔다
    let guardHold = false;
    if (playerGuard) {
      const G = playerGuard;
      G.held = (parryHold.btn != null || parryHold.key) && !roundOver;
      if (G.broken && (!G.held || (!player.skill.swinging && !player.skill.tap && !swipe && taps === 0))) G.broken = false;
      if (G.held && !bufHold && (swipe || taps > 0)) G.broken = true;
      guardHold = G.held && !G.broken && !secBusy;
    }
    // 고유 동작 강화 (10/14 — 10/13 이어 주기를 다시 만듦): 손가락 움직임을 알린다(긋기 읽기 · 다른 동작이 손을 쥐는지). 손 목표는 쥐지 않는다 — 손가락은 늘 그대로 더한다
    //  (사장님 결정 10/14 01:5x '궤적은 끝까지 내 손가락, 고유 동작은 손가락으로는 못 하는 몫만 더한다')
    player.skill.uniq?.feed(d.x, d.y, dt, guardHold || bufHold || !!playerGuard?.held);
    // 권총: 자동 조준이라 끌기는 손을 움직이지 않는다 (빠른 끌기가 내딛기·자세 복귀를 부르지 않게)
    if (player.alive && !player.weapon?.gun && !secBusy && !guardHold && !bufHold) {
      player.handOffset.x += d.x * inScale;
      player.handOffset.y += d.y * inScale;
    }
    // 검술 층의 "자세로 돌아가기"가 알아야 할 것: 손가락이 화면에 닿아 있는지, 지금 움직였는지
    player.handHeld = input.activeTouch !== null;
    player.inputActive = !secBusy && !bufHold && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    if (taps > 0 && player.alive && !(pommelTap && player.foeDistance() <= CONFIG.CLOSE.pommelDist && player.skill.pommel())) player.skill.thrust();
    updatePlayerEmotion(dt);
    watchEmotions();
    watchMudNotice(); // 잠든 습지: 진흙을 처음 밟으면 알림 줄 한 번 (다른 무대는 배율 1 이라 안 뜬다)
    const m = input.move;
    const emv = player.emoMods?.move ?? 1; // 감정 고유 능력: 집념이면 발이 묶이고 공포면 빨라진다
    const feet = player.alive && !exhausted && player.skill.secretPhase !== 'stiff'; // 비기 경직: 스틱이 안 듣는다 (걸음·근접 밀치기 없음 — 몸은 물리대로)
    player.move.set(feet ? m.x * emv : 0, feet ? m.y * emv : 0);
    player.stickX = feet ? m.x : 0; // 스틱 원값 (감정 배수 전): 근접 밀치기 걸쇠가 읽는다 (fighter.closeStep)
    player.stickY = feet ? m.y : 0;
    updateGuardName();
    // 마우스로 조작할 땐 손가락 흔적 대신 오른쪽 아래 원판에 손 위치의 흔적을 그린다
    const mouseMode = !input.isTouchDevice;
    if (mouseMode && player.alive) trail.addPad(player.skill.aim.x, player.skill.aim.y, now / 1000);

    // 타격 순간 살짝 멈칫 + 판이 끝나면 슬로모션
    let scale = 1;
    if (hitStop > 0) {
      hitStop -= dt;
      scale = 0.12;
    }
    // 결정타 연출 (10/9 23:5x — CONFIG.SECRET.slowMo): AI·플레이어 비기가 터뜨려진 순간(터뜨림 수가 바뀜) 화면 시간을 잠깐 늦춘다 — 물리 스텝 dt 는 그대로, 스텝 수만 준다
    const bursts = (ai?.secretBursts ?? 0) + player.skill.secretBursts;
    if (bursts !== secretBurstsSeen) {
      secretBurstsSeen = bursts;
      if (SECRET_SLOWMO) secretSlow = CONFIG.SECRET.slowMo.dur;
    }
    if (secretSlow > 0) {
      secretSlow -= dt;
      scale = Math.min(scale, CONFIG.SECRET.slowMo.scale);
    }
    if (slowMo > 0) {
      slowMo -= dt;
      scale = Math.min(scale, 0.25); // 결정타 슬로모션
    } else if (roundOver) scale = Math.min(scale, 0.5);
    acc += dt * scale * TEMPO; // 전체 빠르기 (?tempo, 기본 1.1)
    simWant = (frameMs / 1000) * scale;
    const physT0 = perf ? performance.now() : 0;
    let steps = 0;
    while (acc >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame) {
      player.foe = enemy;
      enemy.foe = player;
      player.faceTarget = enemy.bodies.pelvis.translation();
      enemy.faceTarget = player.bodies.pelvis.translation();
      ai.update(PHYSICS.timestep);
      playerSecret?.update(PHYSICS.timestep, !!player.skill.sec); // 플레이어 비기 창: 조건(AI 와 같은 함수)이 차면 창을 연다
      if (playerSecret?.queued && !player.skill.sec && player.alive) {
        // 미리 받은 입력 (중국 막기 연환 — 10/12): 칼이 떨어져 창이 열린 이 스텝에 곧장 (위 프레임 입력 길과 같은 함수)
        const o = playerSecret.fire();
        if (o && player.skill.secret(o)) showPlayerCue(o.S, 'secret');
      }
      playerGuard?.step(PHYSICS.timestep); // 막기 버튼: 누르는 동안 AI 막기와 같은 판단·빠르기로 손 목표를 유파 막기 자리로
      player.step(PHYSICS.timestep);
      enemy.step(PHYSICS.timestep);
      tickDebris(PHYSICS.timestep); // 흩어지는 칼·방어구 조각 (겉모습만, 게임 시간 — 멈칫·슬로모션을 따른다)
      player.cacheState();
      enemy.cacheState();
      world.step(eventQueue, combat.physicsHooks);
      combat.afterStep(world, eventQueue);
      if (arenaGround) applyTerrainHazards(arenaGround, colliderInfo, PHYSICS.timestep); // 화산섬 용암 화상: 물리 스텝마다 닿은 몸 부위만 (평지 무대는 부르지 않는다)
      swordTrails.sample(PHYSICS.timestep); // 칼 잔상 띠: 이 스텝의 칼 자세를 기록 (읽기만)
      clashCooldown -= PHYSICS.timestep;
      clashStopCooldown -= PHYSICS.timestep;
      stats.simTime += PHYSICS.timestep;
      acc -= PHYSICS.timestep;
      steps++;
    }
    if (steps === PHYSICS.maxStepsPerFrame) acc = 0;
    camSteps = steps; // 카메라 따라가기: 이번 화면에 몸이 나아간 게임 시간 (빠르기 = 옮긴 거리 ÷ 스텝 시간)
    watchOpening(); // 무대 훑기 판: 훑기 시작 introAt 초 뒤 알림·소개·안내
    if (perf) {
      physMs = performance.now() - physT0;
      physSteps = steps;
      capped = steps === PHYSICS.maxStepsPerFrame;
      simGot = steps * PHYSICS.timestep;
    }
    player.syncMeshes();
    enemy.syncMeshes();
    for (const f of [player, enemy]) {
      updateWhoosh(f, dt * scale);
      updateDrips(f, dt * scale);
    }
    decapFx.update([player, enemy], dt * scale); // 참수: 목 단면·피 분출
    limbFx.update([player, enemy], dt * scale); // 팔·다리 절단: 단면·피
    updateBindSound();
    for (const b of bodySounds) b.update(dt * scale);
    reviveFx.update(enemy, dt * scale);
    particles.update(dt * scale);
    if (paint) {
      // 겉모습만 (시계로 도는 빛·안광, 칼 잔상 꼭짓점): 그리는 프레임에만
      for (const a of auras) a.update(now / 1000);
      swordTrails.update(); // 칼 잔상 띠
    }
    arena.update(dt);
    updateHud();
    checkRoundEnd(dt);
  } else {
    muteWhoosh();
    camSteps = 0;
    // 무기 뽑기: 싸움(물리·AI)은 멈춘 채 카드 순서만 흐른다. 바다·먼지는 그대로 움직인다
    if (state === 'draw') {
      updateDraw(dt);
      arena.update(dt);
    }
    // 판이 끝나 메뉴가 뜬 뒤에도 흩어지던 칼·투구·판금 조각은 마저 날아 사라진다 (판 끝 슬로모션 0.5배 그대로. 싸움 중 일시정지면 멈춘 채)
    if (roundOver) tickDebris(dt * 0.5);
  }
  updateCamera(dt); // 거르는 프레임에도: 흔들림 스프링·발걸음(player.footstep 소비)·소리 자리(sound.listener)가 여기 달려 있다
  staminaHud.update([player, enemy], camera, state === 'fight' && !roundOver);
  screenTint.update(dt);
  let renderMs = 0;
  if (paint) {
    fighterLight.update(fighterMeshes);
    const renderT0 = perf ? performance.now() : 0;
    renderer.render(scene, camera);
    screenTint.render(renderer);
    renderMs = perf ? performance.now() - renderT0 : 0;
  } else camera.updateMatrixWorld(); // 그리기가 해 주던 카메라 행렬 갱신 — 소리 좌우(sound._where)가 읽는다
  if (perf) perf.frame(now, frameMs, physMs, renderMs, physSteps, capped, simWant, simGot, paint);
  trail.enabled = state === 'fight';
  if (paint) trail.draw(now / 1000, !input.isTouchDevice);
  watchSecretFx(); // 비기 화면 연출 (발도 번쩍임 · 이베리아 카메라)
  updateTechCue(dt); // 유파 기술 알림 — 싸움이 아닐 때(메뉴·일시정지)도 불러 숨긴다
  guardVisible(); // ① 자세 칸도 같다 — 싸움 화면에서만 보인다 (카드 고르기·메뉴에서 숨김)
  if (state === 'fight' || state === 'draw') tickHudTimers(dt); // 화면 글자 시계 (일시정지·메뉴면 멈춘다)
}

// 메뉴 뒤 배경으로 보일 첫 판을 미리 만들어 둔다 (메뉴 뒤 카메라 = 그 판 시작 자리 — 첫 판은 무대 훑기의 시작 자리)
planOpening();
prepareRound();
newRound(FIXED_WEAPON || 'longsword');
requestAnimationFrame(frame);

// 디버그/튜닝용: 브라우저 콘솔에서 game.player.blood, game.config.GAIT.kneeBase = 0.2 처럼 만져볼 수 있다
//  (WEAPON 값은 판을 만들 때 싸움꾼마다 weaponCfg 로 복사된다: 바꾸면 다음 판부터)
window.game = {
  get player() {
    return player;
  },
  get enemy() {
    return enemy;
  },
  get world() {
    return world;
  },
  get ai() {
    return ai;
  },
  tempo: TEMPO, // 전체 빠르기 손잡이 (?tempo)
  get playerGuard() {
    return playerGuard; // 막기 버튼 (held · active · mode · line · stats) — 브라우저 탐침(tools/browser/parry_button_probe.mjs)이 읽는다
  },
  get playerUnique() {
    return playerUnique; // 고유 동작 강화 (stage · list · stats · running) — 탐침 tools/browser/unique_assist_shots.mjs 가 읽는다
  },
  get playerSecret() {
    return playerSecret; // 플레이어 비기 창 (open · opened · S) — 브라우저 스모크(tools/browser/player_secret_shots.mjs)가 읽는다
  },
  get combat() {
    return combat;
  },
  // 와신상담 (월왕구천검 특수 능력, combat.js woundRageMult): 두 싸움꾼의 다친 정도 d 와 지금 공격력 배율 — 그 능력이 없는 칼은 늘 1
  get woundRage() {
    return [player, enemy].map((f) => f && { name: f.name, weapon: f.weapon?.id, d: +woundDegree(f).toFixed(3), mult: +woundRageMult(f).toFixed(3) });
  },
  // 흩어지는 조각 수 (칼·방어구, debris.js): game.debris.count() 전부, game.debris.count('armor') 방어구만
  debris: { count: debrisCount },
  draw, // 무기 뽑기 상태 (stage, ids = [내 카드, 내 카드, 상대 무기], pick). 스크린샷용으로 game.draw.hold = true 면 순서가 멈춘다
  // 판 시작 카메라 (10/15): mode 'sweep'|'settle'|'old' · params(무대 길 — 바꾸면 그 판부터) · swept(훑은 무대) · u(스크린샷용 고정 자리, null = 시계대로) · endPos/endLook(지금 평소 자리)
  camOpen,
  get camRig() {
    return { follow: camFollow.clone(), vel: { ...camRig.vel }, lift: camRig.lift, look: camLook.clone(), dir: camDir.clone() }; // 따라가기 상태 (tools/browser/cam_follow_browser.mjs 가 잰다)
  },
  /** 무대 훑기 길을 n 등분해 [{ pos, look }] (지금 평소 자리 기준, 무대 길 덮어쓰기 over) — 무대 소품 뚫음 검사용 (tools/browser/cam_open_shots.mjs) */
  camOpenPath(n = 60, over = null) {
    const P = { ...camOpen.params, ...(over ?? {}) };
    const g = player?.terrain ? player.terrain.heightAt(camOpen.centre.x, camOpen.centre.z) : 0;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const pos = new THREE.Vector3();
      const look = new THREE.Vector3();
      sweepPose(i / n, camOpen.endPos, camOpen.endLook, camOpen.centre, g, P, pos, look);
      out.push({ u: i / n, pos, look });
    }
    return out;
  },
  get state() {
    return state;
  },
  trail,
  stats,
  config: CONFIG,
  THREE,
  camera,
  scene, // 무대 소품 뚫음 검사(tools/browser/cam_open_shots.mjs)가 무대 메쉬를 훑는다
  get fighterMeshes() {
    return fighterMeshes; // 이번 판 두 검객(몸·칼·빛) — 같은 검사에서 무대와 따로 센다
  },
  freeCam: false,
  renderInfo: () => ({ frame: renderer.info.render.frame, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory, programs: renderer.info.programs?.length }),
  renderCap, // 화면 갱신 상한: game.renderCap.interval = 잰 화면 간격(초). 끄기는 설정 '화면 60 fps 제한' (game.settings.fpsCap)
  screenTint,
  // 배경: game.stage 로 지금 배경·짓는 시간 확인, game.setStage('castle') 로 바로 바꿔 보기 (싸우는 중이면 잠깐 멈칫한다)
  get stage() {
    return { id: stages.id, pinned: STAGE_PIN, buildMs: stages.buildMs, clearMs: stages.clearMs, warmMs: stages.warmMs };
  },
  // 지형 무대의 땅 계약·용암 (화산섬 — 시험 도구가 읽는다. 평지 무대는 null)
  get terrain() {
    return arenaGround?.terrain ?? null;
  },
  get arenaGround() {
    return arenaGround;
  },
  // 무대 고정 장애물 (잠든 습지 석상): 충돌체 수 · 돌아가기 반지름 — 시험 도구가 읽는다
  get arenaObstacle() {
    return arenaStone ? { colliderCount: arenaStone.handles.size, navigation: arenaStone.navigation } : null;
  },
  setStage(id) {
    const terrainChanges = terrainForStage(id) !== terrainForStage(stages.id); // 지형 무대 ↔ 평지 무대: 물리 바닥이 달라진다
    if (useStage(id)) {
      clearFlying();
      stages.warm(renderer, camera);
    }
    sound.setStage(stages.id);
    if (state === 'menu') planOpening(); // 메뉴 뒤에서 바꾸면 판 시작 카메라도 새 무대 길로 (싸움 도중이면 그 판 정지 길이는 그대로 — 다음 판부터)
    // 바닥이 바뀌면 판을 새로 세운다 — 옛 바닥 충돌체·걸음 높이 기억을 다른 그림 밑에 남기지 않게 (샛별 0116047c 와 같게)
    if (world && terrainChanges) {
      newRound(player.weapon.id);
      return;
    }
    // 판 도중에 무대를 바꾸면 석상 충돌체·진흙도 지금 세계에 맞춘다 (시작 자리는 다음 판부터)
    if (world) arenaStone = configureStageObstacle(RAPIER, world, stages.id, GROUND_GROUPS, arenaStone);
    for (const f of [player, enemy]) {
      if (!f) continue;
      configureWetlandMovement(f, stages.id);
      f.arenaObstacle = arenaStone?.navigation ?? null;
    }
    arena?.watchFighters?.([player, enemy]);
  },
  AI,
  settings,
  sound, // 예: game.sound.clash(8) 로 소리 확인, game.sound.stats
  particles, // 피·흙 알갱이 입자 (예: game.particles.bloodOn = false 로 '피 표현 끔' 갈래 — 단면 색 점검 tools/browser/chanda_terra_shots.mjs clay)
  fighterLight, // 예: game.fighterLight.enabled = false 로 캐릭터 조명을 끄고 비교
  reviveFx, // 부활 연출 (예: game.reviveFx.active, game.reviveFx.group)
};
