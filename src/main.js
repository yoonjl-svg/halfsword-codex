// ─────────────────────────────────────────────────────────────
//  게임 본체: 화면 준비 → 물리 세계 → 매 프레임 반복(게임 루프)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as CONFIG from './config.js';
import { PHYSICS, ARENA, CAMERA, AI_PROFICIENCY } from './config.js';
import { setWhipPreset } from './druid_whip.js'; // 드루이드의 채찍 덩굴 값 판 (`?whip=src` = 샛별 값 — 10/23)
import { FINISH as FINISH_SWITCH } from './finish.js'; // 마무리 스위치 entry·mode·vital·plateNeck (주소 ?finishEntry · ?finishMode · ?vital · ?plateNeck)
import { VITAL as VITAL_SWITCH } from './vital_target.js'; // 약한 자세 겨눔 갈래 스위치 (10/12)
import { FLOW_REDESIGN } from './nagashi_redesign.js'; // 일본 흘림 판정 개편 · 기력 청구 스위치 (10/18 — ?flowJudge · ?flowCost)
import { FLOW_RECOVERY } from './nagashi_recovery.js'; // 흘림당한 뒤 팔 늦춤 스위치 (10/18 — ?flowArm)
import { skipIberianTable, useIberianTableV2, iberianTableV2 } from './guards.js'; // 이베리아 자세표 칸 걷기 시험 (10/22 — ?ibTableSkip) · 자세표 v2 (?ibTable=v2 | v2p) — 기본 끔
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { createStaminaHud } from './stamina_hud.js';
import { applyAweStart } from './stamina.js'; // 티소나 '위세' 판 시작 깎임 (10/24)
import { createScreenTint } from './screen_tint.js';
import { createStrikeCue } from './strike_cue.js'; // 칠 때 알림 — 이어 긋기 · 비기 · 인데스 창 동안 상대 머리 위 '!' (10/21 · ?strikeCue=mark|edge|both|0)
import { readJourney, writeJourney, addJourneyClear, journeyClears } from './journey_save.js'; // 여정 이어하기 지점 · 깬 무대 수(통계) (첫 화면 '이어하기' — 샛별 저장소 215d7b7e 를 우리 여정에 맞춤, docs/import/lobby_port_2026-10-16.md §5)
import { readProfile, recordDuel } from './player_profile.js'; // 대기실 이름 · 대면 결과 (샛별 저장소 817db21c)
import { readLobbyEquipment, readLobbyArmor, readLobbyNeck, LOBBY_ARMOR, HERO_TEAR } from './lobby_equipment.js'; // 대기실 장착을 싸움에 (사장님 10/16 03:5x '장착하면 실제 전투에 가져나가게 해' — docs/import/lobby_fix_2026-10-16.md §3 · 용사의 눈물 hero_tear_2026-10-17.md)
import { journeyCoins, awardHead, readProgress, rand01, recordCampaignStage, migrateCampaignStages, ensureWanderRun, saveWanderLoadout, resetWanderLoadout, markWanderFighting, settleAbandonedWander, awardWanderHead, settleWander, wanderNoticeDue, markWanderNotice, markWanderEncounter } from './lobby_progress.js'; // 여정 판 끝 금화 · 상대의 목을 베면 머리 1 (사장님 10/16 04:3x) · 방랑 저장 (10/23) · 방랑 전용 상대 알림 창 본 기록 (10/24)
import { showTitleNotice } from './title_notice.js'; // 결과 창 위 호칭 알림 창 (10/24)
import { titleTierDraw, saveWanderResume } from './lobby_progress.js'; // saveWanderResume = 방랑 몸 상태 이어받기 (10/30 — WANDER.resumeState)
import { snapshotFighter, applyFighterSnapshot } from './fight_snapshot.js'; // 방랑 몸 상태 사본 (10/30 01:1x — 감독 안 (b)) // 호칭 하나마다 레전드 확률 (10/24 — drawCardIds)
import { TIER_DRAW } from './weapons.js';
import { COIN_ICON, POUCH_ICON } from './wallet_icons.js'; // 결과 창 금화 줄 = 대기실 금화 · 천 주머니 그림 (사장님 10/16 14:0x)
import { HORN_ICON } from './wallet_icons.js'; // 결과 창 뿔피리 (10/30 상점 · 10/31 금화 · 머리와 같은 줄)
import { SHOP } from './config.js'; // 상점 — 왕을 이긴 판의 뿔피리 (10/30 · SHOP.enabled 일 때만 — 본판은 끔)
import { awardKingHorn } from './lobby_progress.js';
import { HORN_REWARD_LABEL } from './shop_text.js';
import { readLearned, playerKit, stageParam, skillNodesParam, migrateSkillBooks, migrateItalianSlots, playerLetters } from './skill_tree_store.js'; // 대기실 스킬트리 = 플레이어 유파 몫 — 모든 판 (사장님 10/21 칸마다 몫 하나 · 옛 스킬북 옮기기, docs/strike/school_kit_map.md §2 · §3)
import { letterMul } from './skill_tree_data.js'; // 편지 — 카드 뽑기 유파 무게 (10/21)
import { convertSeals } from './seal_coins.js'; // 이미 받은 인장 → 금화 한 번 — 판을 처음 연 때 어느 길이든 (아래 testRoute 다음 · 10/16 08:1x 인장 없앰)
import { InputTrail } from './trail.js';
import { Input, attachStick } from './input.js';
import { LOOKS, getLook } from './looks.js';
import { AI } from './ai.js';
import { CHARACTERS_BY_ID, randomCharacter, pickCharacterWeapon, savedFoeWeapon, randomLine, lineSourceOf, aiAtProficiency } from './characters.js';
import { Emotions, EMO_ABILITY } from './emotions.js';
import { WEAPON_LIST, getWeapon, drawWeaponCards, TIER_LABEL, setGripTorque, RETIRED_WEAPONS } from './weapons.js';
import { attachAura, AURA_VIEW } from './aura.js';
import { Particles, haptic, stickDecal, rebuildDecal, disposeDecals, decalWarmMesh } from './effects.js';
import { bloodPalette } from './blood_palette.js'; // 피 색 (10/27 — 광기의 병마용은 흰 피 · 그 밖은 붉은 피 그대로)
import { Sound, BodySounds } from './sound.js';
import { woundImpact, clashImpact, stopGrant, stopTick, shakeWall } from './impact_fx.js'; // 타격감 셈 (10/25 — config IMPACT_FX: 맞는 순간의 무게로 멈칫 · 카메라 밀림 · 무게 소리 — 아래 onWound · onClash · 멈칫 묶음 addHitStop)
import { whipTipStep, whipHitMode } from './whip_sound.js'; // 드루이드의 채찍 휙 · 딱 걸쇠 (10/24 — 아래 whipWhoosh 에서 옮김) · 맞음 소리 주소 스위치
import { SecretSfxWatch, secretSfxMode } from './secret_sfx.js'; // 비기 소리 (10/25 — 샛별 저장소 2fa0b2ae): 낸 전투자 · 유파 소리 한 번 · 주소 스위치
import { Combat, woundDegree, woundRageMult, COMBAT_HOOKS } from './combat.js';
import { Stages, nextStage, STAGE_IDS, STAGE_ORDER, STAGE_FOE, STAGE_FOE_EXTRA, stageFoeId, stageLabel, STAGE_NAME_KO } from './stages.js';
import { WANDER, WANDER_NAME, WANDER_EXCLUSIVE, WANDER_HEAD, WANDER_BONUS_LABEL, WANDER_NOTICE_TEXT, chooseWanderEncounter } from './wander_rules.js'; // 방랑 (10/23 — 대기실 '방랑' 단추, docs/import/wander_heroes_import_2026-10-23.md)
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
import { updateCapeSway } from './cape_sway.js'; // 긴 망토 흔들림 (10/24 — 롤랑 · 베르나르도 · 아르토리아, 겉모습만)
import { tickDebris, clearDebris, debrisCount, DEBRIS } from './debris.js';
import { ReviveFx } from './revive_fx.js';
import { PlayerSecretWatch, bindGain } from './secret.js'; // 플레이어 비기 창 (10/9 23:5x — AI 와 같은 조건 함수)
import { IAI_READY_STANCE, iaiReadyShown } from './secret_instant.js'; // 고노센 발도 대기 자세 이름 (① 자세 칸 — 10/31 13:xx)
import { PlayerParryGuard } from './parry_button.js'; // 플레이어 막기 버튼 (10/11 — AI 막기와 같은 판단으로 유파 막기 자리로)
import { PlayerUniqueAssist } from './unique_assist.js'; // 플레이어 고유 동작 강화 (10/13 이어 주기 → 10/14 강화 — docs/strike/unique_player_2026-10-13.md)
import { TRADITIONS, setChineseGait, setItalianBackCap, setItalianRhythm, setItalianStride, setItalianWalk, setJapaneseGait, traditionOf } from './schools.js';
import { createTestRoute } from './test_route.js'; // 테스트 전용 경로 (test.html → ?test=1&weapon=&hero=&foe=random&stage=random, docs/test_route_2026-10-10.md)
import { portraitIdOf, portraitSrc, portraitMode, portraitGrid } from './portraits.js'; // 캐릭터 프로필 그림 (대기실 프로필 칸 · 패배 창 — docs/design/portrait_ui_2026-10-17.md)
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
if (params.has('stamina')) CONFIG.STAMINA.on = params.get('stamina') !== '0'; // 기력(10/15 — 샛별 저장소 구현, docs/strike/stamina_import_2026-10-15.md): 기본 켬, `?stamina=0` = 기력 없음(막대·비용·지침·탈진 모두 없음 — 지금 본판 그대로)
CONFIG.SOUND.secretSfx = secretSfxMode(params, CONFIG.SOUND.secretSfx); // 비기 소리 (10/25 사장님 '샛별이 비기 소리 보낸 거 입혀'): 기본 켬 · `?secretSfx=0` = 끔 (녹음도 안 받음)
CONFIG.SOUND.whipHit = whipHitMode(params, CONFIG.SOUND.whipHit); // 드루이드의 채찍 살 · 옷 맞음 소리(10/24): 기본 C2 채찍 녹음 · `?whipHit=old` = 10/23 판(Thwack — 겹침 막기도 없음)
// 레전드 기운 보기 손잡이 (재기 · 견줌 사진용 — 그림만, aura.js AURA_VIEW): `?aura=0` = 기운 끔 · `?auraTune={"durandal":{"gain":1}}` = 판을 세울 때 프로필 일부를 덮어씀 (docs/strike/legend_glow_2026-10-24.md)
if (params.get('aura') === '0') AURA_VIEW.on = false;
if (params.has('auraTune')) { try { AURA_VIEW.tune = JSON.parse(params.get('auraTune')); } catch { AURA_VIEW.tune = null; } }
const staminaHud = createStaminaHud(document.getElementById('staminaHud')); // 두 검객 머리 위 기력 막대 (src/stamina_hud.js)
const screenTint = createScreenTint(); // 출혈·감정 화면 물들임을 게임 캔버스에 합성 (샛별 저장소 2f593ba6 — 전엔 #vignette · #emotion CSS 층. 기력 스위치와 상관없이 늘 이 길)
// 주인공은 판마다 무기 카드 세 장 중 하나를 골라 받는다 (아래 "무기 뽑기"). 주소에 ?weapon=을 적으면 뽑기 없이 그 무기로 고정.
//  진짜 엑스칼리버는 주인공만 받을 수 있고, 복제품은 하인리히 몫이라 뽑기에서 뺀다
const PLAYER_WEAPON_POOL = WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // 빼 둔 무기(에스톡·세이버·팔쉬온 — 사장님 10/13 23:2x · 간장·막야 — 적소검이 대신함, 사장님 10/27)는 카드에 안 나온다
const FIXED_WEAPON = params.get('weapon');
const testRoute = createTestRoute(params); // 인자가 없으면 아무것도 바꾸지 않는다
// 이미 받은 인장 → 금화 (사장님 10/16 04:2x · 08:1x '인장 제도 없애' — seal_coins.js): 이 판을 처음 연 때 한 번, 첫 화면 · 옛 메뉴 · 주소 판 어느 길이든(테스트 경로만 빼고).
//  대기실을 기다리면 인장을 없앤 뒤 옛 메뉴·주소 판에서 깬 무대까지 옛 셈으로 금화가 된다 — 그래서 여기서 (확인표 1928). 알림은 다음 대기실이 한 번 (lobby.js)
if (!testRoute.active) convertSeals();
// 옛 스킬북 → 스킬트리 옮기기 (사장님 10/21 — skill_tree_store.js): 이 판을 처음 연 때 한 번(모든 플레이어 · 새 플레이어도 · 어느 길이든 · 테스트 경로만 빼고) — 산 책을 거두고 쓴 금화를 돌려준 뒤 금화 500.
//  두 번 일하지 않는다(진행 저장 안의 기록 · 짝 열쇠). 알림은 다음 대기실이 한 번 (lobby.js takeTreeNotice)
if (!testRoute.active) migrateSkillBooks();
if (!testRoute.active) migrateItalianSlots(); // 10/31 이탈리아 왼 줄 자리 옮기기 (옛 d 2 자리 I2 만 익힌 저장 → I7 — skill_tree_store.js)
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
// 독일 죽음의 일격 (10/22 — 사람 독일 비기, src/mordschlag.js · docs/strike/german_mordschlag_2026-10-22.md): `?deMord=0` = 옛 판(deSecret) · `?mordPress=0.6` 누르기 시간 비교 ·
//  `?mordGrip=hilt` 쥠 그대로 폼멜 판 · `?mordOver=1` 넘어 들어감 규칙 (사장님 확인 전)
if (params.has('deMord')) CONFIG.SECRET.deMord = +params.get('deMord') ? 1 : 0;
if (['close', 'press'].includes(params.get('mordRule'))) CONFIG.SECRET.mordRule = params.get('mordRule'); // 사람 모르트슐라크 조건 (10/29 20:0x — close 붙은 거리 2 s · press 밀치기 누르기 옛 판)
if (params.get('mordClose') === 'reach') CONFIG.SECRET.mordCloseN = null; else if (+params.get('mordClose') > 0) CONFIG.SECRET.mordCloseN = +params.get('mordClose'); // 붙은 거리 n (m — 기본 0.8 사장님 10/30 00:4x · 'reach' = 옛 판 CLOSE.reach(내 무기))
if (+params.get('mordPress') > 0) CONFIG.SECRET.mordPress = CONFIG.realS(+params.get('mordPress')); // 주소 값 = 실제 초 (표준 시간 10/25 — 아래 시간 · 빠르기 주소 인자도 같음)
if (params.has('mordGrace') && +params.get('mordGrace') >= 0) CONFIG.SECRET.mordGrace = CONFIG.realS(+params.get('mordGrace')); // 모르트슐라크 누르기 끊김 너그러움 (10/25 23:1x 사장님 · 10/27 21:4x 0.4 s — 기본 0.4 s · 주소 값 = 실제 초 · `?mordGrace=0` = 끊기면 셈 0)
if (params.has('armAtFight')) CONFIG.SECRET.armAtFight = +params.get('armAtFight') ? 1 : 0; // 비기 무장 시계를 공격이 풀린 때부터 (10/27 23:0x 사장님 결정 — 기본 1 · `?armAtFight=0` = 판 시작부터)
if (params.has('mordStepPause')) CONFIG.SECRET.mordStepPause = +params.get('mordStepPause') ? 1 : 0; // 다시 붙는 밀치기 첫 걸음 동안 너그러움 시계 멈춤 (10/27 23:0x 사장님 결정 — 기본 1 · `?mordStepPause=0`)
if (params.has('closeLatch')) CONFIG.CLOSE.latch = +params.get('closeLatch') ? 1 : 0; // 밀치기 걸쇠 (10/25 23:3x 사장님 '이 걸쇠 없애' — 기본 0 · `?closeLatch=1` = 놓았다 다시 밀어야)
if (params.has('closeLatchAI')) CONFIG.CLOSE.latchAI = +params.get('closeLatchAI') ? 1 : 0; // AI 밀치기 걸쇠 (기본 = config CLOSE.latchAI)
if (params.has('mordNear')) CONFIG.SECRET.mordNear = +params.get('mordNear') ? 1 : 0; // AI 몸 붙이기 자연스럽게 가까울 때만 (10/24 14:2x 사장님 · 0 = 멀리서 붙이러 걸어가는 옛 판)
if (params.has('mordWalkStrike')) CONFIG.SECRET.mordWalkStrike = +params.get('mordWalkStrike') ? 1 : 0; // AI 몸 붙이기 걸어가며 치기 (10/24 13:3x 사장님 · 0 = 걸어가는 동안 안 침 옛 판)
if (['reverse', 'hilt'].includes(params.get('mordGrip'))) CONFIG.SECRET.mord.grip = params.get('mordGrip');
if (params.has('mordOver')) CONFIG.SECRET.mordOver = +params.get('mordOver') ? 1 : 0;
if (params.has('mordTrack')) CONFIG.SECRET.mord.track = +params.get('mordTrack') ? 1 : 0; // 죽음의 일격 머리 따라 겨눔 (10/30 08:2x 사장님 기본 켬 — secret_instant.js mordTrack · `?mordTrack=0` = 옛 겨눔)
if (params.has('secretStaminaMin') && Number.isFinite(+params.get('secretStaminaMin'))) CONFIG.SECRET.secretStaminaMin = +params.get('secretStaminaMin'); // 이 기력 이하면 비기 못 씀 (10/30 18:3x 사장님 0)
if (params.has('secretStamina')) CONFIG.SECRET.secretStamina = +params.get('secretStamina') ? 1 : 0; // 기력이 비기 값보다 적으면 비기 못 씀 (10/30 08:2x 사장님 — 사람 · AI · 기본 1 · `?secretStamina=0` = 전 판)
if (params.has('mordCommit') && +params.get('mordCommit') >= 0) CONFIG.SECRET.mord.trackCommit = CONFIG.realS(+params.get('mordCommit')); // 따라 겨눔을 멈추는 때 = 겨눈 자리에 닿기 이 실제 초 전
if (['aim', 'cut'].includes(params.get('mordTrackUntil'))) CONFIG.SECRET.mord.trackUntil = params.get('mordTrackUntil');
// 죽음의 일격 내 머리 뚫음 막기 (10/31 시제품 — 사장님 확인 전 · 기본 끔 · secret_instant.js mordClipSolve): `?mordNoClip=1` · 손이 머리 앞으로 둘 거리 `?mordClipX=0.16` (m) · 뒤로 반걸음 끝 `?mordClipStep=0.3` (m · 0 = 걸음 없음)
if (params.has('mordNoClip')) CONFIG.SECRET.mord.noSelfClip = +params.get('mordNoClip') ? 1 : 0;
if (params.has('mordClipX') && Number.isFinite(+params.get('mordClipX'))) CONFIG.SECRET.mord.clipX = +params.get('mordClipX');
if (params.has('mordClipStep') && +params.get('mordClipStep') >= 0) CONFIG.SECRET.mord.clipStep = +params.get('mordClipStep');
// 죽음의 일격 자연스러운 쥠 바꿈 · 강제 뒤 박차기 · 폼멜 찍기 (10/31 08:xx 시제품 — 사장님 확인 전 · 기본 끔): `?mordRegrip=0.4` (실제 초) · `?mordBurst=1` · `?mordBurstFree=1` · `?mordPommel=1`
if (params.has('mordRegrip') && +params.get('mordRegrip') >= 0) CONFIG.SECRET.mord.regrip = CONFIG.realS(+params.get('mordRegrip'));
if (params.has('mordBurst')) CONFIG.SECRET.mord.burstBack = +params.get('mordBurst') ? 1 : 0;
if (params.has('mordBurstFree')) CONFIG.SECRET.mord.burstFree = +params.get('mordBurstFree') ? 1 : 0;
if (params.has('mordPommel')) CONFIG.SECRET.mord.pommel = +params.get('mordPommel') ? 1 : 0;
//  가볍고 느림을 고칠 안 (10/22 밤 — 스위치 · 기본 끔 · 사장님 확인 전): `?mordKin=0.6` 운동학 길(칼자루 끝 = 고노센 칼끝 빠르기 몫) · `?mordAt=0.5` 쥔 자리 · `?mordAim=pull` 머리 겨눔 · `?mordPow=finish` 판정 × FINISH.power
if (params.has('mordKin')) CONFIG.SECRET.mord.kin = Math.max(0, +params.get('mordKin') || 0);
if (+params.get('mordAt') > 0) CONFIG.SECRET.mord.at = +params.get('mordAt');
if (['pad', 'pull'].includes(params.get('mordAim'))) CONFIG.SECRET.mord.aim = params.get('mordAim');
if (params.has('mordPow')) CONFIG.SECRET.mord.power = params.get('mordPow') === 'finish' || params.get('mordPow') === 'hit' ? params.get('mordPow') : +params.get('mordPow') || 'hit';
if (params.has('parryAssist')) CONFIG.SKILL.parryAssist = Math.max(0, Math.min(3, +params.get('parryAssist') || 0)); // 플레이어 막기 버튼 거듦 단계(10/12 — parry_button.js, 확인표 990): `?parryAssist=0` = 끔(10/11 판) · 1 무게 보정 · 2 + 일찍 읽기 · 3 + 자리 덧힘
if (params.has('kron')) CONFIG.SKILL.deKron = +params.get('kron') ? 1 : 0; // 독일 왕관 막기 자리(10/11 22:2x 사장님 기본): `?kron=0` = 전 자리(머리 위 = 긴 자세)
if (params.has('gyeoksal')) CONFIG.SECRET.gyeoksal.on = +params.get('gyeoksal') ? 1 : 0; // 동방 막아 죽이기 (10/22 — 사람 동방 비기): `?gyeoksal=0` = 옛 판(막기 연환)
if (params.has('talhoApproach')) CONFIG.SKILL.talhoApproach = +params.get('talhoApproach') ? 1 : 0; // 나선 걸음 베기 '먼저 비껴 딛고 벤다'(AI — 10/29 18:4x 사장님): `?talhoApproach=0` = 전처럼 베며 딛음 (비교용)
if (params.get('jpGait') === 'old') setJapaneseGait('old'); // 일본 걸음 (10/29 21:0x 사장님 '설계대로'): `?jpGait=old` = 전 판 (비교용)
if (params.has('jpWalk')) setJapaneseGait(+params.get('jpWalk')); // 일본 걸음 빠르기 시험: `?jpWalk=0.81` 처럼 speedMul (가려는 빠르기 ×) · 판 값 0.70(10/31 사장님 '일본 바로잡아') · `?jpWalk=0.67` = 10/30 판
if (params.get('cnGait') === 'old') setChineseGait('old'); // 동방 박자 (10/29 21:0x 사장님 '동방 박자도 바꾸고'): `?cnGait=old` = 전 판 strideK 0.9 (비교용)
if (params.has('passAsRung')) CONFIG.GAIT.passAsRung = +params.get('passAsRung') ? 1 : 0; // follow 안 pass → lunge + 끌어붙임 걸음 길이: 1 = 사다리 한 칸 아래(10/29 18:5x 사장님) · `?passAsRung=0` = 옛 × 0.85 (비교용)
if (params.get('gyeoksalPow') === 'hit' || +params.get('gyeoksalPow') > 0) CONFIG.SECRET.gyeoksal.power = params.get('gyeoksalPow') === 'hit' ? 'hit' : +params.get('gyeoksalPow'); // 격살 판정 시험 (기본 'finish' = FINISH.power 2.5 · 'hit' = 다른 비기와 같은 hitMul 1.3)
if (params.get('gyeoksalTrail') === '1') CONFIG.SECRET.gyeoksal.trailWidth = 1; // 격살 잔상 굵기도 빠르기 몫으로 (시험)
if (+params.get('gyeoksalShare') > 0) CONFIG.SECRET.gyeoksal.share = +params.get('gyeoksalShare'); // 격살 칼끝 빠르기 몫 시험 (기본 = cnFastShare 0.3 · 0.5 진 · 1 고노센 발도)
if (params.get('gyeoksalArm') === 'down') CONFIG.SECRET.gyeoksal.armPath = 'down'; // 격살 어거(팔) 길 시험: 위에서 내려 깎음
if (params.has('secretStreak')) CONFIG.SECRET.secretStreak = +params.get('secretStreak') ? 1 : 0; // 비기 잔상 마주 보는 띠 (10/23 — 사장님 확인 전): 기본 1, `?secretStreak=0` = 호만
if (params.has('secretArcMin')) CONFIG.SECRET.secretArcMin = Math.max(0, Math.min(1, +params.get('secretArcMin') || 0)); // 결정타 잔상 바닥 (10/23 — 사장님 확인 전): 기본 0.6, `?secretArcMin=0` = 빠르기 몫 그대로
for (const k of ['cnBongdu', 'cnBuffer', 'cnFast']) if (params.has(k)) CONFIG.SECRET[k] = +params.get(k) ? 1 : 0; // 중국 막기 연환 사람이 쓰게 (10/12 — docs/strike/cn_combo_play_2026-10-12.md): 봉두세 자리 · 미리 받기 · 빠른 연환. 기본 1, `?cnBongdu=0` · `?cnBuffer=0` · `?cnFast=0` = 전
if (+params.get('cnFastShare') > 0) CONFIG.SECRET.cnFastShare = +params.get('cnFastShare'); // 빠른 연환 비율(빠르기·잔상 같이 — 기본 0.5): 사장님이 한 값만 바꿔 보시게 `?cnFastShare=0.65`
if (params.get('cnCombo') === '2') CONFIG.SECRET.cnCombo = 2; // 연환 3 연격(10/12 08:2x): 기본 3, `?cnCombo=2` = 전 두 수
if (params.has('cnPath')) CONFIG.SECRET.cnPath = +params.get('cnPath') ? 1 : 0; // 연환 길 그때 계산(10/12 03:0x): 기본 1, `?cnPath=0` = 패드 길
if (['cutFirst', 'thrustFirst'].includes(params.get('cnGeojeongOrder'))) CONFIG.SECRET.cnGeojeongOrder = params.get('cnGeojeongOrder'); // 거정세 연환 순서: 기본 원문대로 벰 → 찌름
if (params.has('secretReach')) CONFIG.SECRET.secretReach = +params.get('secretReach') ? 1 : 0; // 비기 동안 팔 끝까지 펴짐(10/12 03:0x·03:1x): 기본 1, `?secretReach=0` = 평소 제한
if (params.has('iaiRise')) CONFIG.SECRET.iaiRise = +params.get('iaiRise') ? 1 : 0; // 고노센 올려베기·한 손(10/12 03:2x): 기본 1, `?iaiRise=0` = 가로 휩쓸기·두 손
if (params.has('kronH')) CONFIG.SKILL.deKronH = +params.get('kronH') ? 1 : 0; // 왕관 손·칼끝 자리(10/12 08:2x): 기본 1 = 쓸어 고른 자리, `?kronH=0` = 00:1x 값
if (['true', 'pad'].includes(params.get('kronShape'))) CONFIG.SKILL.deKronShape = params.get('kronShape'); // 왕관 꼴(10/12 00:1x 사장님): 기본 'true'(진짜 왕관 꼴 — 코등이 가로), `?kronShape=pad` = 10/11 패드 꼴 (docs/strike/kron_shape_2026-10-12.md)
if (params.get('itRetreat') === '1' || params.get('itRetreat') === '2') CONFIG.SKILL.itRetreat = +params.get('itRetreat'); // 이탈리아 물러서기 연구(10/17 — 판 값 끔, 사장님 확인 전): `?itRetreat=1` = 막기 단추가 약한 길에서 실제 디딤 두 번 물러섬 · `?itRetreat=2` = 막는 동안 스틱을 뒤로 당긴 두 디딤을 물러서는 한 짝으로 셈(스틱은 플레이어 것) (docs/strike/italian_retreat_2026-10-17.md)
if (params.get('itOpposition') === '0') CONFIG.SKILL.itOpposition = 0;
if (params.get('itParryBeat') === '1') CONFIG.SKILL.itParryBeat = 1; // 막기를 짧은 박자로 셈(10/17 연구 — 사장님 승인 전 제안, 판 값 끔): `?itParryBeat=1`
if (+params.get('cnParrySpeed') > 0) CONFIG.SKILL.cnParrySpeedK = +params.get('cnParrySpeed'); // 동방 막기 단추 손 빠르기 배율(10/17 — 판 값 1 = 끔, 사장님 확인 전): `?cnParrySpeed=1.3` = 동방 막기 책 플레이어의 막기 단추 손 옮김 4.5 → 5.85 m/s (docs/strike/chinese_parry_speed_2026-10-17.md)
if (+params.get('cnBrace') > 0) CONFIG.SKILL.cnBraceK = +params.get('cnBrace'); // 동방 버티는 힘(10/17 연구 — 판 값 0 = 끔, 사장님 확인 전): `?cnBrace=0.5` = 동방 막기 책 플레이어가 막기 단추로 막는 중 서보 힘 × 1.5 (docs/strike/chinese_parry_brace_2026-10-17.md)
if (params.has('cnParryCut') && +params.get('cnParryCut') >= 0 && +params.get('cnParryCut') <= 1) CONFIG.SKILL.cnParryDmgCut = +params.get('cnParryCut'); // 동방 막는 동안 피해 감소(10/17 — 판 값 0.5, 사장님 22:1x 결정): `?cnParryCut=0` = 끔 · `?cnParryCut=0.25` = 막는 중 입는 칼날 상처 심각도 × 0.75 (몫이라 0~1 만 읽음)
// 일본 흘림 묶음 (사장님 10/18 22:1x — docs/strike/japanese_flow_adopt_2026-10-18.md): 판정 개편 · 팔 늦춤 0.36 s · 흘림당한 쪽 기력 40(10/31 09:xx 사장님 결정 60 — config FLOW_REDESIGN.penalty) · 자연 회복 탈진 · 일본/이베리아 막는 동안 피해 20 % 감소 — 모두 기본 켬
if (params.has('flowJudge')) FLOW_REDESIGN.on = params.get('flowJudge') !== '0'; // `?flowJudge=0` = 옛 흘림 판정(내려 베기 · 칼 지붕 · 새로 부딪힌 순간만)
if (params.has('flowDmgCut') && +params.get('flowDmgCut') >= 0 && +params.get('flowDmgCut') <= 1) FLOW_REDESIGN.flowDmgCut = +params.get('flowDmgCut'); // 흘린 공격의 피해 감소(판 값 0.8) — `?flowDmgCut=0` = 끔
if (params.get('flowEnd') === 'timer') FLOW_REDESIGN.threatEnd = false; // `?flowEnd=timer` = 공격 끝을 공격 번호 시간으로(샛별 연구 그대로 — 판 값은 실제 칼 기하)
if (params.has('flowArm') && +params.get('flowArm') >= 0 && +params.get('flowArm') <= 2) FLOW_RECOVERY.seconds = CONFIG.realS(+params.get('flowArm')); // `?flowArm=0` = 팔 늦춤 끔 · `?flowArm=0.18` = 0.18 s
if (params.has('ibBeat') && +params.get('ibBeat') >= 0 && +params.get('ibBeat') <= 3) Object.assign(CONFIG.IB_PARRY_BEAT, { on: +params.get('ibBeat') > 0, k: +params.get('ibBeat') || CONFIG.IB_PARRY_BEAT.k }); // 이베리아 탈류 · 레베스 쳐내기 튕김 세기 k (판 값 1.6 — 사장님 10/20) · `?ibBeat=0` = 끔
if (params.has('swingTurn') && +params.get('swingTurn') >= 0 && +params.get('swingTurn') <= 180) Object.assign(CONFIG.SWING_TURN, { on: +params.get('swingTurn') > 0, rate: +params.get('swingTurn') || CONFIG.SWING_TURN.rate }); // 휘두르는 동안 몸 돌림 묶기 °/s (시험 — 기본 끔 · 10/21) · `?swingTurn=30`
if (params.has('burstWalkSide')) CONFIG.GAIT.burstWalkSide = params.get('burstWalkSide') === '0' ? 0 : 1; // 옆 누르면 첫 걸음에 늘 옆 박차기 (10/21 — 기본 켬) · `?burstWalkSide=0` = 전 판(서 있다 걷기 시작 때만)
if (params.has('burstFwdDeg') && +params.get('burstFwdDeg') >= 0 && +params.get('burstFwdDeg') <= 60) CONFIG.GAIT.burstFwdDeg = +params.get('burstFwdDeg'); // 비스듬히 앞으로 박차기 각(°, 판 값 30 · 0 = 곧장 옆)
if (params.has('aiReact') && +params.get('aiReact') >= 0 && +params.get('aiReact') <= 0.6) Object.assign(CONFIG.AI_REACT, { on: +params.get('aiReact') > 0, face: CONFIG.realS(+params.get('aiReact')) || CONFIG.AI_REACT.face }); // AI 반응 시간 s (판 값 0.2 · 0 = 끔)
if (['strike', 'approach', 'windup'].includes(params.get('swingTurnFrom'))) CONFIG.SWING_TURN.from = params.get('swingTurnFrom'); // 묶기 시작: windup(기본 — 칼 드는 때부터) · approach(들어오는 단계부터) · strike(긋기부터)
if (params.has('flowCost') && +params.get('flowCost') >= 0 && +params.get('flowCost') <= 100) FLOW_REDESIGN.penalty = +params.get('flowCost'); // `?flowCost=0` = 흘림당한 쪽 기력 청구 끔 · `?flowCost=20` = 20 · `?flowCost=40` = 10/31 전 판(판 값 60)
if (params.get('exhaust') === 'fixed') CONFIG.STAMINA.exhaustNatural = false; // `?exhaust=fixed` = 옛 탈진(2.5 s 숨 고르기 뒤 0)
if (params.get('thrustCost') === '7') CONFIG.STAMINA.thrustCost = 7; // `?thrustCost=7` = 옛 찌르기 기력 7 (10/24 사장님 결정 전)
if (params.has('jpParryCut') && +params.get('jpParryCut') >= 0 && +params.get('jpParryCut') <= 1) CONFIG.SKILL.jpParryDmgCut = +params.get('jpParryCut'); // 일본 막는 동안 피해 감소(판 값 0.2) — `?jpParryCut=0` = 끔
if (params.has('ibParryCut') && +params.get('ibParryCut') >= 0 && +params.get('ibParryCut') <= 1) CONFIG.SKILL.ibParryDmgCut = +params.get('ibParryCut'); // 이베리아 막는 동안 피해 감소(판 값 0.2) — `?ibParryCut=0` = 끔
if (['1', '2'].includes(params.get('itForte'))) CONFIG.SKILL.itForte = +params.get('itForte'); // 이탈리아 forte 막기 연구 후보 (가)(10/17 — 사장님 확인 전): 기본 0 = 끔, `?itForte=1`·`?itForte=2` = 후보 몸꼴 (docs/strike/italian_forte_parry_2026-10-17.md)
if (params.has('bind')) CONFIG.BIND.natural = +params.get('bind') ? 1 : 0; // 자연 바인드 (10/11 실험 — docs/strike/natural_bind_2026-10-11.md · 10/31 본판 — natural_bind_on_2026-10-31.md): 기본 1(사장님 10/31 19:xx), `?bind=0` = 전 물리(칼끼리 더 튕김 · AI 밀기 없음)
if (params.has('bindRest')) CONFIG.BIND.restitution = +params.get('bindRest'); // 칼끼리 닿는 면 반발 (기본 0.2 — 사장님 10/31 19:xx · 10/11 실험 0.1)
if (params.has('bindWill')) CONFIG.BIND.will.on = +params.get('bindWill') ? 1 : 0; // AI 미는 정도를 성향에 따라 (기본 1 · 0 = 모든 AI 10/11 실험 값 그대로 — 셈은 사장님 확인 전)
if (['v4', 'flow', 'gilmok', 'spin'].includes(params.get('ibSecret'))) CONFIG.SECRET.iberianSecret = params.get('ibSecret'); // 이베리아 비기 판(10/11 · 10/22): 기본 'spin'(휘감아 돌기 — docs/strike/iberian_spin_2026-10-22.md), `?ibSecret=gilmok` = v6 길목 지키기, `?ibSecret=flow` = v5 멈추지 않는 흐름, `?ibSecret=v4` = 10/10 비켜 서며 크게 가로베기
if (['stick', 'attack', 'attackCircle'].includes(params.get('ibInput'))) CONFIG.SECRET.ibSpin.input = params.get('ibInput'); // 싱지르 내는 조작: 기본 'attackCircle'(10/24 — 무장 동안 공격으로 원 한 바퀴) · `?ibInput=stick` = 10/23 판(이동 스틱 반 바퀴) · `?ibInput=attack` = 10/22 판(무장 동안 공격 입력 하나)
if ([0.6, 1.5].includes(+params.get('ibCircleTime'))) CONFIG.SECRET.ibSpin.circleTime = +params.get('ibCircleTime'); // 원 한 바퀴를 이 초 안에 (판 값 1.5 — 사다리 칸만) · 시험 `?ibCircleTime=0.6`
if (params.get('gyeoksalAuto') === '0') CONFIG.SECRET.gyeoksal.auto = 0; // 격살 저절로 끔 = 옛 판(창 안 공격 입력 — 10/24 사장님 결정 전)
if (params.get('ibShare') === '0') CONFIG.SECRET.ibSpin.share = 0; // 싱지르 빠르기를 고노센 몫으로 정하지 않음 (10/23 판 — 한 바퀴 time 0.6 s · 칼끝 자름 없음 · 판 값 0.7 — 사장님 10/24 10:5x)
if (params.get('ibUpright') === '0') CONFIG.SECRET.ibSpin.upright = 0; // 싱지르 몸 곧게 끔 (10/23 판 — 판 값 1)
if (params.get('ibHandRest') === '0') CONFIG.SECRET.ibSpin.handRest = 0; // 싱지르 낼 때 사람 손 목표를 쉼 자세로 옮기지 않음 (10/24 02:5x 판 — 판 값 1 · 사장님 10/24 10:4x '또 허공 위로 날아가는 싱지르')
if (params.get('ibLid') === '0') CONFIG.SECRET.ibSpin.lid = 0; // 싱지르 몸통 뚜껑 끔 (놓은 칼끝이 몸통 위 끝을 넘어 오를 수 있음 — 판 값 1 · 10/24 10:4x)
if (params.get('ibWindSide') === '0') CONFIG.SECRET.ibSpin.windSide = 0; // 싱지르 칼 든 쪽으로 감을 때 손을 배 앞 가운데(10/22 판 wind.hand 0.06)에 — 판 값 1 = 칼 든 어깨 앞 (사장님 10/24 14:0x 결정)
if (params.get('ibFloor') === '0') CONFIG.SECRET.ibSpin.floor = 0; // 싱지르 감는 동안 땅에 닿아도 막힘 (10/22 판 — 판 값 1 · 10/24 10:4x '작게 그으면 … 실패')
if (params.get('ibFeet') === '0') CONFIG.SECRET.ibSpin.feet = 0; // 싱지르 발디딤 고침 끔 (10/24 02:5x 판 — 도는 발이 축발 옆에 딛고 축발은 제자리 · 판 값 1 · 사장님 10/24 12:5x '두 다리가 딱 붙어서 곧게 편 채')
if ([90, 180, 270, 360].includes(+params.get('ibTurn'))) CONFIG.SECRET.ibSpin.stickTurn = +params.get('ibTurn'); // 스틱 돌림 각 ° (판 값 180 — 사장님 10/23 '반 바퀴 이상') · 시험 `?ibTurn=360`
if ([0.4, 0.6].includes(+params.get('ibTurnTime'))) CONFIG.SECRET.ibSpin.stickTime = +params.get('ibTurnTime'); // 그 각을 이 초 안에 (판 값 0.6 — 사다리 칸만) · 시험 `?ibTurnTime=0.4`
if (params.get('ibTurnPath') === '0') CONFIG.SECRET.ibSpin.stickPath = 0; // 표본 사이 데드존 건너뜀을 놓음으로 보지 않음 (판 값 1)
if (params.get('ibTurnRate') === '1') CONFIG.SECRET.ibSpin.stickRate = 1; // 시험: 느린 각 흐름은 안 셈 (판 값 0)
if (params.get('ibTurnFrom') === '1') CONFIG.SECRET.ibSpin.stickFrom = 1; // 시험: 스틱을 가운데에서 밀어 낸 때부터 0.6 s 안 (판 값 0)
if (params.get('ibTorso') === '0') CONFIG.SECRET.ibSpin.torso = 0; // 휘감아 돌기 칼 높이 몸통 안 끔 (10/22 판 — 판 값 1 · 사장님 10/23 01:0x)
if (params.get('ibReverse') === '0') CONFIG.SECRET.ibSpin.reverse = 0; // 스틱을 돌린 쪽으로 돌기 끔 (늘 칼 든 쪽 — 판 값 1)
if (params.get('ibSettle') === '0') CONFIG.SECRET.ibSpin.settle = 0; // 마무리 받기 끔 (곧장 놓음 — 판 값 1)
if (['all', 'cut', '0'].includes(params.get('ibTrail'))) CONFIG.SECRET.ibSpin.trail = params.get('ibTrail') === '0' ? 0 : params.get('ibTrail'); // 휘감아 돌기 비기 잔상: 판 값 'cut'(놓은 뒤 가로지르는 몫) · `?ibTrail=all` 내내 · `?ibTrail=0` 끔
if (['chest', 'head', 'headTop'].includes(params.get('gilAim'))) CONFIG.SECRET.gilmokAim = params.get('gilAim'); // 길목 한 칼 겨누는 자리 (사장님 결정 10/11 13:5x — 기본 config.js SECRET.gilmokAim) · 확인용 `?gilAim=head`
if (params.has('iai')) CONFIG.SECRET.iai = +params.get('iai') ? 1 : 0; // 고노센 = 발도(10/10 02:3x): 기본 1, `?iai=0` = 순간이동 고노센
if (params.has('gnsEnter')) CONFIG.SECRET.gnsEnter = +params.get('gnsEnter') ? 1 : 0; // 고노센 들어옴 사건(10/25 01:3x — 발도 대기인 채 상대가 내 발도가 닿는 거리를 넘어 들면 창): 기본 1, `?gnsEnter=0` = 옛 판
if (params.has('gnsEnterAI')) CONFIG.SECRET.gnsEnterAI = +params.get('gnsEnterAI') ? 1 : 0; // AI 고노센도 들어옴 사건 (10/25 08:0x 사장님 결정 — 기본 1, `?gnsEnterAI=0` = 01:3x 판)
if (params.has('gnsLong')) CONFIG.SECRET.gnsLong = +params.get('gnsLong') ? 1 : 0; // 고노센 긴 칼 상대 규칙 (10/25 08:0x 사장님 결정 — 기본 1, `?gnsLong=0` = 끔: 상대 칼 거리 ≥ 내 발도가 닿는 거리면 준비가 그 사이에서 안 풀림)
if (params.has('gnsWary')) CONFIG.SECRET.gnsWary = +params.get('gnsWary') ? 1 : 0; // AI 고노센 경계 (10/25 08:0x 사장님 '⑤' — 기본 1, `?gnsWary=0` = 01:3x 판 AI 걸음)
if (params.has('gnsEnterWindow')) CONFIG.SECRET.gnsEnterWindow = CONFIG.realS(Math.max(0, +params.get('gnsEnterWindow') || 0)); // 여쭘 A: 들어옴 창 길이 (기본 0 = playerWindow 그대로 · `?gnsEnterWindow=0.4`)
if (params.has('gnsEnterBlock')) CONFIG.SECRET.gnsEnterBlock = [0, 1, 2].includes(+params.get('gnsEnterBlock')) ? +params.get('gnsEnterBlock') : 2; // B: 천천히 걸어 든 들어옴 창 발도는 상대 칼에 막힐 수 있음 (10/25 16:0x 사장님 결정 — 기본 1 · `?gnsEnterBlock=0` 끔 · `=2` 칼끝 겨눔도 막음 — 시험)
if (params.has('foeChargeAvg')) CONFIG.SECRET.foeChargeAvg = +params.get('foeChargeAvg') ? 1 : 0; // 달려듦 빠르기를 최근 0.6 s 평균으로 (10/25 16:0x — 기본 1 · `?foeChargeAvg=0` = 한 스텝)
if (params.has('foeChargeSpeed') && +params.get('foeChargeSpeed') > 0) CONFIG.SECRET.foeChargeSpeed = CONFIG.realV(+params.get('foeChargeSpeed')); // 실제 m/s // 비기 '달려듦' 빠르기 (10/25 16:1x 사장님 결정 — 기본 1.2 · `?foeChargeSpeed=0.9` 옛 판)
if (params.has('gnsEnterOpen')) CONFIG.SECRET.gnsEnterOpen = +params.get('gnsEnterOpen') ? 1 : 0; // 여쭘 C: 들어옴 창은 상대 칼끝이 나를 겨누지 않을 때만 (기본 0 · `?gnsEnterOpen=1`)
if (['idle', 'dist'].includes(params.get('gnsReady'))) CONFIG.SECRET.gnsReady = params.get('gnsReady'); // 고노센 준비 (10/25 22:3x · 22:5x 사장님 — 기본 'idle' = 거리와 상관없이 아무 행동 없이 2 s · 준비된 뒤엔 걸어도 유지 · `?gnsReady=dist` = 상대 칼 거리 밖 옛 판)
if (params.has('gnsCrouch')) CONFIG.SECRET.gnsCrouch = +params.get('gnsCrouch') ? 1 : 0; // 사람 고노센 준비 웅크림 (10/25 23:0x 사장님 결정 1 → 10/31 01:0x '플레이어만 웅크리기 꺼' — 기본 0 · `?gnsCrouch=1` = 웅크림)
if (params.has('gnsStickWalk')) CONFIG.SECRET.gnsStickWalk = +params.get('gnsStickWalk') ? 1 : 0; // 고노센 준비의 걸음 뜻 = 스틱이 몸을 걷게 할 때만 (10/31 13:xx — 기본 1 · `?gnsStickWalk=0` = 0 이 아니면 걸음 · 사장님 확인 전)
if (params.has('gnsRaiseLatch')) CONFIG.SECRET.gnsRaiseLatch = +params.get('gnsRaiseLatch') ? 1 : 0; // 고노센 든 칼 이어 봄 — 선 밖에서 든 칼이 선 안에 들면 창 (10/31 — 기본 1 · `?gnsRaiseLatch=0` = 10/31 01:0x 판 · 사장님 확인 전)
if (params.has('gnsReadyHip')) CONFIG.SECRET.gnsReadyHip = +params.get('gnsReadyHip') ? 1 : 0; // 사람 허리 대기 — 웅크림 없이 칼만 왼 허리 (10/31 08:xx — 기본 1 · `?gnsReadyHip=0` = 10/31 01:0x 판 '고노센 준비' 글만 · 사장님 확인 전)
if (params.has('gnsCrouchOut') && +params.get('gnsCrouchOut') > 0) CONFIG.SECRET.gnsCrouchOut = +params.get('gnsCrouchOut'); // 웅크림 풀림 시간 (s — 기본 0.2 · 사장님 확인 전)
if (params.has('gnsCrouchAim')) CONFIG.SECRET.gnsCrouchAim = +params.get('gnsCrouchAim') ? 1 : 0; // AI 가 웅크린 사람을 칠 때 길을 낮춤 (10/27 21:4x 사장님 결정 — 기본 1 · `?gnsCrouchAim=0` = 7b02877 판)
if (params.has('gnsAiSettle')) CONFIG.SECRET.gnsAiSettle = +params.get('gnsAiSettle') ? 1 : 0; // 고노센 AI 가 준비 전이면 간 보기 동안 제자리에 섬 (10/25 22:5x 규칙의 AI 쪽 — 기본 1 · `?gnsAiSettle=0` · 사장님 확인 전)
if (params.has('gnsWalkIn')) CONFIG.SECRET.gnsWalkIn = +params.get('gnsWalkIn') ? 1 : 0; // 고노센 들어옴 창 (기본 0 = 천천히 걸어 듦은 창 없음 — 사장님 10/25 22:3x 입력 글 · 22:5x 끈 채로 · `?gnsWalkIn=1` = 01:3x 판)
if (params.get('ibFlow') === '0') CONFIG.IB_FLOW.a = false; // 이베리아 이어 긋기 흐름 A 끔 (10/21 — 기본 켬 · test.html '이베리아 시험')
if (params.get('ibFlowDetect') === 'old') CONFIG.IB_FLOW.detect = 'old'; // 흐르는 긋기 10/21 판 읽기 (10/28 — 기본 'a' 진짜 이어 그을 때만 · 확인표 2722)
if (params.has('ibFlowBrake')) CONFIG.IB_FLOW.brake = +params.get('ibFlowBrake'); // 흐르는 긋기 제동 늦춤 몫 (10/28 기본 0.8 · 전 0.5 · 확인표 2723)
if (params.has('ibFlowPow')) CONFIG.IB_FLOW.power = +params.get('ibFlowPow'); // 흐르는 긋기 위력 (10/28 기본 1.2 · 1 = 없음 · 확인표 2724)
if (params.get('ibWrist') === '0') CONFIG.SCHOOL_PASSIVE.iberian.on = false; // 이베리아 손목 힘 패시브만 끔 (10/21 — test.html '이베리아 시험')
// 이베리아 날 세우기 시험 (10/22 — 기본 끔 · 사장님 확인 전, config IB_EDGE · docs/strike/iberian_flat_hits_2026-10-22.md): `?ibEdge=motor` · `?ibEdge=ff` · `?ibEdge=pre` = 이베리아 유파만 그 날 세우기 방식
if (['motor', 'ff', 'pre'].includes(params.get('ibEdge'))) Object.assign(CONFIG.IB_EDGE, { on: true, edge: params.get('ibEdge') });
// 쉬는 날 방향 시험 (10/22 — 기본 끔 · 사장님 확인 전, config EDGE_REST · docs/strike/edge_rest_hold_2026-10-22.md): `?edgeRest=pre` · `kick` · `fast` · `latch` · `tsw` · 쉼표로 여럿 — 사람 칼만
if (params.get('edgeRest')) {
  const m = params.get('edgeRest').split(',').filter((x) => ['pre', 'kick', 'fast', 'latch', 'tsw'].includes(x));
  if (m.length) { CONFIG.EDGE_REST.on = true; for (const x of m) CONFIG.EDGE_REST[x] = true; }
}
// 이베리아 자세표 칸 걷기 시험 (10/22 — 기본 끔 · 사장님 확인 전, docs/strike/iberian_flat_hits_2026-10-22.md): `?ibTableSkip=sideR,sideL` 처럼 칸 짧은 이름(guards.js IBERIAN_TABLE_KEYS) · 묶음 wait · pass — 걷은 칸은 앞무게 틀 표 값
if (params.get('ibTableSkip')) skipIberianTable(params.get('ibTableSkip').split(',').map((x) => x.trim()).filter(Boolean));
// 이베리아 자세표 v2 (10/22 — 기본 끔 · 사장님 확인 전, guards.js IBERIAN_TABLE_V2): `?ibTable=v2` = 사람 · AI 모두 · `?ibTable=v2p` = 사람만(플레이어 몸에만 덮음 — 아래 newRound)
const IB_TABLE = params.get('ibTable');
if (IB_TABLE === 'v2') useIberianTableV2();
{ // 열린 비기 유파 (10/21 — config SECRET.openSchools): `?secretOpen=all` 옛 판 · `?secretOpen=japanese,german` 고르기
  const so = params.get('secretOpen');
  if (so) CONFIG.SECRET.openSchools = CONFIG.SECRET.aiOpenSchools = so === 'all' ? ['german', 'italian', 'iberian', 'japanese', 'chinese'] : so.split(',').map((x) => x.trim()).filter(Boolean); // 사람 · AI 둘 다 (10/22 aiOpenSchools)
}
{ // 이탈리아 사람 비기 (10/22 — config SECRET.itSecret · risoluto* · src/italian_risoluto.js): `?itSecret=contratempo` 옛 엇박 찌르기 · `?risoHold=1.5` 창까지 이어질 시간 · `?risoBeat=1` 두 번째 길(상대 박자) · `?risoCover=0.1` 덮음 거리
  const its = params.get('itSecret');
  // 10/28 01:4x 사장님 '상대가 물러서면 내가 들어가고, 상대가 들어오면 내가 나가는 걸로' (기본 — italian_risoluto.js mirrorOk): `?risoMirror=0` = 10/25 21:0x 판(스틱 앞이나 뒤만 · 다 붙음 창 켬 — 아래 ?risoClose 가 덮을 수 있게 먼저)
  if (params.get('risoMirror') === '0') Object.assign(CONFIG.SECRET, { risolutoMirror: 0, risolutoClose: 1 });
  if (params.get('risoWide') === '0') Object.assign(CONFIG.SECRET, { risolutoAnyPart: 0, risolutoGrace: 0, risolutoClosing: 1, risolutoClose: 0, risolutoBeat: 0, risolutoHold: CONFIG.realS(0.6), risolutoTouch: 0, risolutoMirror: 0 }); // 10/23 넓은 판정 전 10/22 판 (10/28 상대 걸음 맞춤도 끔) (아래 낱낱 스위치가 덮을 수 있게 먼저)
  if (['risoluto', 'contratempo'].includes(its)) CONFIG.SECRET.itSecret = its;
  if (params.has('risoHold') && +params.get('risoHold') > 0) CONFIG.SECRET.risolutoHold = CONFIG.realS(+params.get('risoHold'));
  if (params.has('risoBeat')) CONFIG.SECRET.risolutoBeat = +params.get('risoBeat') ? 1 : 0;
  if (params.has('risoCover') && +params.get('risoCover') > 0) CONFIG.SECRET.risolutoCover = +params.get('risoCover');
  if (params.has('risoClose')) CONFIG.SECRET.risolutoClose = +params.get('risoClose') ? 1 : 0; // '다 붙었을 때' 창 — 10/28 기본 끔(내 커맨드라 비기 원칙 밖) · 1 = 켬
  if (params.has('risoLine')) CONFIG.SECRET.risolutoLine = +params.get('risoLine') ? 1 : 0; // 시험: 칼을 대지 않는 덮음 (줄 막기)
  if (params.has('risoGuard')) CONFIG.SECRET.risolutoGuard = +params.get('risoGuard') ? 1 : 0; // 시험: 막기 단추를 누른 채 나아가기도 셈
  // 10/23 넓은 판정 (사장님 '칼이 붙어 있는 상황에 대한 판정을 더 광범위하고 유연하게'): `?risoWide=0` = 10/22 판(손 쪽 ↔ 칼끝 쪽만 · 끊김 너그러움 없음 · 가슴 사이 줄어듦 · 다 붙음 · 상대 박자 끔) · 낱낱이 `?risoAny=0|1` · `?risoGrace=0.2` · `?risoClosing=0|1`
  if (params.has('risoAny')) CONFIG.SECRET.risolutoAnyPart = +params.get('risoAny') ? 1 : 0;
  if (params.has('risoGrace') && +params.get('risoGrace') >= 0) CONFIG.SECRET.risolutoGrace = CONFIG.realS(+params.get('risoGrace'));
  if (params.has('risoClosing')) CONFIG.SECRET.risolutoClosing = +params.get('risoClosing') ? 1 : 0;
  // 10/24 런지 (사장님 '런지로 진행해 … 고노센처럼 빠르게 … 0.6초 내 경직도 0.6초'): `?risoLunge=0` = 10/23 판(탭 찌르기 · 팔 늦춤 FLOW_RECOVERY 0.4 · 굳음 stiff.italian 0.4) · `?risoShare=0.6` 칼끝 빠르기 몫 비교 · `?risoRoom=1` · `?risoGlide=0`
  if (params.get('risoLunge') === '0') Object.assign(CONFIG.SECRET, { risolutoLunge: 0, risolutoArmSlow: null, risolutoStiff: null });
  if (params.has('risoShare') && +params.get('risoShare') > 0) CONFIG.SECRET.risolutoShare = +params.get('risoShare'); // 10/31 01:2x 사장님 0.7 (전 0.8 · 0.9 · 그 전 1)
  if (params.has('risoArmSlow') && +params.get('risoArmSlow') >= 0) CONFIG.SECRET.risolutoArmSlow = CONFIG.realS(+params.get('risoArmSlow')); // 런지 상대 팔 늦춤 (실제 초 — 10/30 20:0x 사장님 0 · 전 0.6)
  if (params.has('risoRoom')) CONFIG.SECRET.risolutoStep = { ...CONFIG.SECRET.risolutoStep, room: +params.get('risoRoom') ? 1 : 0 }; // 1 = 앞발 런지 걸음을 가슴 사이(clinch 밖까지)로 줄임
  if (params.has('risoGlide')) CONFIG.SECRET.risolutoGlide = +params.get('risoGlide') ? 1 : 0; // 0 = 붙은 칼 따라 미끄러짐 끔 (연환과 같은 막힘)
  if (params.get('risoRecover') === '0') CONFIG.SECRET.risolutoStep = { ...CONFIG.SECRET.risolutoStep, draw: 1, recover: 0, push: 0, accel: 0 }; // 10/24 14:0x 전 걸음 = 디딘 뒤 뒷발 끌어붙임 (몸 따라감 배율 · 몸 가속 · 앞발 거둠은 없음)
  if (params.has('risoGap')) CONFIG.SECRET.risolutoGap = +params.get('risoGap') ? 1 : 0; // 10/24 13:2x 런지 간격 조건 — 0 = 간격 조건 없음 (12:1x 판 — 가까워도 창)
  if (params.has('risoTouch')) CONFIG.SECRET.risolutoTouch = +params.get('risoTouch') ? 1 : 0; // 10/25 01:0x 칼끝 얽힘 창 — 0 = 10/24 판 (이어짐 0.6 s 를 기다림)
  // 10/25 21:0x 사장님 조건 셋 · 창 지킴 (기본 — 확인표 2563 ~ 2569): `?risoStick=fwd` 스틱 앞만(전) · `?risoTap=1` 탭만(전) · `?risoCover=0.07` 덮음 거리(전 — 위 줄) · `?secretHold=0` 열린 창을 조건이 바뀌면 바로 닫음(전 — 모든 사람 비기 창)
  if (params.get('risoStick') === 'fwd' || params.get('risoStick') === 'both') CONFIG.SECRET.risolutoStick = params.get('risoStick');
  if (params.has('risoTap')) CONFIG.SECRET.risolutoTap = +params.get('risoTap') ? 1 : 0;
  if (params.has('secretHold')) CONFIG.SECRET.secretHold = +params.get('secretHold') ? 1 : 0;
  // 10/25 14:0x 런지 연출 (사장님 '리솔루토 쓰는 순간 비기인 줄 모르겠더라' → 안 1 — 화면만): `?risoCam=0` 카메라 밀어 넣기 끔(`?risoCam=0.9` 처럼 m 로 견주기) · `?risoStreak=0` 빛줄기 · 끝 반짝임 끔(10/23 마주 보는 띠 'line' 그대로) · `?risoGlint=0` 끝 반짝임만 끔
  if (params.has('risoCam')) CONFIG.SECRET.risoCam = Math.max(0, +params.get('risoCam') || 0);
  if (params.has('risoStreak')) CONFIG.SECRET.risoStreak = +params.get('risoStreak') ? 1 : 0;
  if (params.has('risoGlint')) CONFIG.SECRET.risoGlintLife = Math.max(0, +params.get('risoGlint') || 0); // 빛줄기 끝 반짝임만: 0 = 끔 · `?risoGlint=0.2` 처럼 s 로 견주기
  if (params.has('thrustArm')) CONFIG.SECRET.thrustArm = +params.get('thrustArm') ? 1 : 0; // 10/24 15:5x 운동학 겨눈 찌름(런지 · 격살 허파 찌르기) — 0 = 전 손 자리(어깨 가까이 · 칼이 새끼 쪽으로 꺾여 거꾸로 쥔 꼴)
  if (params.has('holdDepth')) CONFIG.SECRET.holdDepth = +params.get('holdDepth') ? 1 : 0; // 시험 (10/24 17:2x 뒤 · 기본 끔): 1 = 맞힌 겨눈 찌름(런지 · 격살 허파 찌르기)의 굳음 동안 칼끝이 겨눈 곳(상대 몸통 가운데)을 넘지 않게 손을 칼 줄을 따라 거둠 (fighter.js holdDepthHand — 끄면 런지 앞발을 따라 칼이 상대 등 뒤로 나옴)
}
{
  // 유파 패시브 (10/21 — config SCHOOL_PASSIVE · school_passive.js · test.html '유파 패시브'): `?schoolPassive=0` = 모두 끔 · `?schoolPassive=italian,german` = 고른 유파만 (나와 상대 모두)
  const sp = params.get('schoolPassive');
  if (sp === '0') CONFIG.SCHOOL_PASSIVE.on = false;
  else if (sp && sp !== '1') {
    const keep = new Set(sp.split(','));
    for (const k of ['iberian', 'italian', 'japanese', 'german', 'chinese']) CONFIG.SCHOOL_PASSIVE[k].on = keep.has(k);
  }
  // 10/28 01:4x 사장님 '무기가 맞부딪혔을 때로 하면?' — 독일 인데스 창이 칼끼리 닿음에도 열림 (기본): `?indesTouch=0` = 전(상대 공격이 실패할 때만)
  if (params.has('indesTouch')) CONFIG.SCHOOL_PASSIVE.german.touch = +params.get('indesTouch') ? 1 : 0;
  // 10/28 01:5x 사장님 '일본 기다림과 침도 고노센도 적용받게 해' — 고노센에도 켄타이 (기본): `?kenSecret=0` = 전(비기엔 안 실림)
  if (params.has('kenSecret')) CONFIG.SCHOOL_PASSIVE.japanese.secret = +params.get('kenSecret') ? 1 : 0;
}
if (params.has('whipKneel')) CONFIG.WHIP_KNEEL.p = +params.get('whipKneel') || 0; // 채찍 무릎 꿇리기 확률 (10/23 — 판 값 0.5 · `?whipKneel=0` 끔)
if (params.get('whipKneelAi') === '1') CONFIG.WHIP_KNEEL.ai = true; // AI 가 든 채찍도 꿇리기 (기본 끔 — 사람 먼저)
if (params.get('dartagnanAbility') === '0') CONFIG.WEAPON_ABILITY.duelOneHand = 1; // 달타냥 '총사의 결투' 끔 (10/25 — 판 값 1.15 · 시험용 · combat.js duelOneHandMult)
if (params.has('buckle')) CONFIG.UNIQUE_ASSIST.buckle.p = +params.get('buckle') || 0; // 곁눈 베기 무릎 꺾기 확률(10/21 — 판 값 0.15 · `?buckle=0` 끔)
if (params.has('schielPath')) CONFIG.UNIQUE_ASSIST.schielPath = +params.get('schielPath') ? 1 : 0; // 곁눈 베기 AI 길 (사장님 10/25 08:0x '셸하우 3번' — 기본 1 = 다시 그린 길 · `?schielPath=0` = 10/25 전 길 · sword_art.js applySchoolArt · ai.js techPlanStep)
if (params.has('schielPlayer')) CONFIG.UNIQUE_ASSIST.schielPlayer = +params.get('schielPlayer') ? 1 : 0; // 사람 곁눈 베기 같은 길 (사장님 10/25 18:0x '같은 길 입혀' — 기본 1 · `?schielPlayer=0` = 사람은 옛 길 잣대 · 덧칸 없음 · unique_assist.js uniqueDef · planStep)
if (params.has('schielPlayerK') && Number.isFinite(+params.get('schielPlayerK'))) CONFIG.UNIQUE_ASSIST.schielPlayerK = +params.get('schielPlayerK'); // 사람 곁눈 베기 세기 손잡이 (사장님 10/25 20:2x 결정 — 기본 1 = 세기 100 % · `?schielPlayerK=0.5` = 시험용 50 % · combat.js analyze)
if (params.has('schielPlayerTip')) CONFIG.UNIQUE_ASSIST.schielPlayerTip = +params.get('schielPlayerTip') ? 1 : 0; // 사람 곁눈 베기 칼끝 들기 (사장님 10/25 20:2x 결정 '칼끝 들기 빼지 마' — 기본 1 = AI 와 같은 덧칸 셋 · `?schielPlayerTip=0` = 시험용 칼끝 들기 없음 · unique_assist.js planStep)
for (const k of ['tsuRuler', 'tsuSnap', 'tsuAim', 'tsuBand', 'tsuHook']) if (params.has(k)) CONFIG.UNIQUE_ASSIST[k] = +params.get(k) ? 1 : 0; // 사람 제비 베기 세 해법 (사장님 10/25 21:1x '해법 1~3 좋아' — 기본 1 · 0 = 그 해법만 끔 · unique_assist.js) · tsuHook (사장님 10/31 16:xx '곧은 길로' — 기본 0 = 곧은 길 · `?tsuHook=1` = 10/25 갈고리 길)
// 특수 공격 칼끝 빠르기 몫 (사장님 10/29 02:0x — 같은 칼 고노센 칼끝 × 몫 · config UNIQUE_ASSIST.specialShare 한 곳): `?specialShare=redondo:0.5,lianchi:0.5` · 옛 이름 `?tsuSnapShare=` · `?cavSnapShare=` · `?lianSnapShare=` · `?dupSnapShare=` · `?rdSnapShare=` 도 그 칸(값 = 고노센 몫)
{
  const SPK = { tsuSnapShare: 'tsubameGaeshi', cavSnapShare: 'cavazione', lianSnapShare: 'lianchi', dupSnapShare: 'duplieren', rdSnapShare: 'redondo', inqSnapShare: 'inquartata' }; // inqSnapShare: 비껴서며 찌르기 (10/31 — 이탈리아 특수 공격) · cavSnapShare 는 칸만 남음(칼끝 돌려 빼기는 10/31 부터 특수 공격 아님 — cavSpeed)
  for (const [k, name] of Object.entries(SPK)) if (params.has(k) && +params.get(k) >= 0) CONFIG.UNIQUE_ASSIST.specialShare[name] = +params.get(k);
  for (const kv of String(params.get('specialShare') ?? '').split(',').filter(Boolean)) {
    const [name, v] = kv.split(':');
    if (name in CONFIG.UNIQUE_ASSIST.specialShare && +v >= 0) CONFIG.UNIQUE_ASSIST.specialShare[name] = +v;
  }
}
if (params.has('yaojiBleed')) CONFIG.UNIQUE_ASSIST.yaojiBleed.k = +params.get('yaojiBleed') || 1; // 요격 몸통 출혈 배율(10/21 — 판 값 1.5 · 1 = 끔)
if (params.has('imbroccataGap')) CONFIG.UNIQUE_ASSIST.imbroccataGap = +params.get('imbroccataGap'); // 위에서 내려 찌르기 파고드는 값(10/21 — 판 값 0.6)
for (const k of ['imbroReach', 'cavTap', 'cavSnap', 'cavHeld', 'cavCapCut', 'tapHeld', 'inqTap']) if (params.has(k)) CONFIG.UNIQUE_ASSIST[k] = +params.get(k) ? 1 : 0; // 사람 위에서 내려 찌르기 닿게(10/27 23:5x) · 칼끝 돌려 빼기 탭 · 운동학 찌름(10/28 00:5x) — 기본 1 · 0 = 그것만 끔 (unique_assist.js)
if (params.has('cavFrom') && +params.get('cavFrom') >= 0) CONFIG.UNIQUE_ASSIST.cavFrom = CONFIG.realS(+params.get('cavFrom')); // 칼끝 돌려 빼기 탭 창 처음 (실제 초 — 기본 0.2 · 10/29 20:0x · 옛 판 0.6)
if (params.has('cavTo') && +params.get('cavTo') > 0) CONFIG.UNIQUE_ASSIST.cavTo = CONFIG.realS(+params.get('cavTo')); // 칼끝 돌려 빼기 탭 창 끝 (실제 초 — 기본 1.2 · 사장님 10/28 01:1x)
if (params.has('cavArmSlow') && +params.get('cavArmSlow') >= 0) CONFIG.UNIQUE_ASSIST.cavArmSlow = CONFIG.realS(+params.get('cavArmSlow')); // 칼끝 돌려 빼기 심화 · 헛누름 상대 팔 늦춤 (실제 초 — 기본 1.2 · 사장님 10/31 '1.2초로 할게' · 0 = 끔)
if (params.has('cavArmSlowAi')) CONFIG.UNIQUE_ASSIST.cavArmSlowAi = +params.get('cavArmSlowAi') ? 1 : 0; // 그 AI 몫 (10/31 — 기본 1)
if (params.has('imbroDown') && +params.get('imbroDown') >= 0) CONFIG.UNIQUE_ASSIST.imbroDown = +params.get('imbroDown'); // 이탈리아 위에서 내려 찌르기 — 아래로 가는 긋기 각 (10/31 사장님 · 기본 67.5 · 0 = 황소 찌르기 긋기만)
if (params.has('cavSide')) CONFIG.UNIQUE_ASSIST.cavSide = params.get('cavSide') === 'free' ? 'free' : 'contact'; // 칼끝 돌려 빼기 비킨 쪽 (10/31 — 'contact' 닿았을 때 상대 칼 쪽 · 'free' 10/28 판)
if (params.has('cavSelfFree')) CONFIG.UNIQUE_ASSIST.cavSelfFree = +params.get('cavSelfFree') || 0; // 칼끝 돌려 빼기 넘어짐 고침 (10/31 — 1 칼 어깨 면 밧줄 뗌 · 0 전 판)
if (params.has('rdDrainCut')) CONFIG.UNIQUE_ASSIST.rdDrainCut = +params.get('rdDrainCut') ? 1 : 0; // 정수리 가르기 메는 동안 기력 = 초당 베기 한 번 값 (11/01 사장님 · 0 = 초당 10)
if (params.has('cavSpeedMul')) CONFIG.UNIQUE_ASSIST.cavSpeedMul = +params.get('cavSpeedMul') || 1; // 칼끝 돌려 빼기 시제품 A (10/31 — 칼끝 빠르기 배 · 1 = 끔)
if (params.has('cavGap')) CONFIG.UNIQUE_ASSIST.cavGap = +params.get('cavGap') || 0; // 시제품 B (틈 파고들기 · 0 = 끔)
if (params.has('cavParryLock')) CONFIG.UNIQUE_ASSIST.cavParryLock = CONFIG.realS(+params.get('cavParryLock') || 0); // 시제품 C (상대 반응 묶음 실제 초 · 0 = 끔)
if (params.has('cavHitMul')) CONFIG.UNIQUE_ASSIST.cavHitMul = +params.get('cavHitMul') || 1; // 시제품 D (판정 배율 · 1 = 끔)
if (params.has('cavCancel')) CONFIG.UNIQUE_ASSIST.cavCancel = +params.get('cavCancel') || 0; // 시제품 E (끄는 동안 막기로 거둠 · 0 = 끔)
if (params.has('cavSpeed')) CONFIG.UNIQUE_ASSIST.cavSpeed = +params.get('cavSpeed') > 0 ? +params.get('cavSpeed') : 'tap'; // 칼끝 돌려 빼기 칼끝 빠르기 m/s (10/31 — 기본 'tap' = 보통 탭 찌르기 빠르기)
if (params.has('lianTap')) CONFIG.UNIQUE_ASSIST.lianTap = +params.get('lianTap') ? 1 : 0; // 사람 날개 접기 탭 (사장님 10/28 01:2x — 물러나며 탭 · 기본 1)
if (params.has('lianStep') && +params.get('lianStep') >= 0) CONFIG.UNIQUE_ASSIST.lianStep = +params.get('lianStep'); // 사람 날개 접기 앞 걸음 (m — 기본 0.45 · 사장님 10/29 14:3x)
if (params.has('specialCooldown')) CONFIG.UNIQUE_ASSIST.specialCooldown = CONFIG.realS(Math.max(0, +params.get('specialCooldown') || 0)); // 특수 공격 공통 식힘 (실제 초 — 기본 6 · 0 = 끔 · 사장님 10/28 02:0x)
/** `?secretUses=1,chinese:3` → { default: 1, chinese: 3 } (숫자 하나 = default · 'inf' · 'off' = 끝없음 — 10/29 19:5x) */
function parseSecretUses(v) {
  const out = { default: 1 };
  for (const p of String(v ?? '').split(',')) {
    const [k, n] = p.includes(':') ? p.split(':') : ['default', p];
    const x = n === 'inf' || n === 'off' ? Infinity : +n;
    if (k.trim() && (x === Infinity || x >= 0)) out[k.trim()] = x;
  }
  return out;
}
if (params.has('specialCoolFrom') && ['free', 'motion', 'fire'].includes(params.get('specialCoolFrom'))) CONFIG.UNIQUE_ASSIST.specialCoolFrom = params.get('specialCoolFrom'); // 특수 공격 식힘을 세기 시작하는 때 (기본 free — 몸이 다시 자유로울 때 · motion 동작 끝 · fire 나간 순간 · 10/29 19:5x)
if (params.has('secretUses')) CONFIG.UNIQUE_ASSIST.secretUses = parseSecretUses(params.get('secretUses')); // 유파 비기 판당 쓸 수 (기본 1 · 동방 3 · 'inf' = 끝없음 · 사장님 10/29 19:5x)
if (params.has('dupTap')) CONFIG.UNIQUE_ASSIST.dupTap = +params.get('dupTap') ? 1 : 0; // 사람 겹치기 탭 (사장님 10/28 01:2x — 맞물린 채 탭 · 기본 1)
if (params.has('rdHold')) CONFIG.UNIQUE_ASSIST.rdHold = +params.get('rdHold') ? 1 : 0; // 사람 풍차 베기 길게 누름 (이베리아 B4 — 사장님 10/29 · 기본 1)
if (['heavy', 'all', 'off'].includes(params.get('frameScale'))) CONFIG.SKILL.frameScale = params.get('frameScale'); // 날것 매핑 반지름 잣대 — 대검은 덮기 전 무기 틀 표로 (10/31 · 기본 'heavy' · 사장님 확인 전) · `?frameScale=off` = 전 판
if (params.has('restTouch')) CONFIG.SKILL.restTouch = +params.get('restTouch') ? 1 : 0; // 얹은 손가락은 뗀 것과 같게 — 쉼 자세 그대로 (10/31 · 기본 1 · 사장님 확인 전) · `?restTouch=0` = 전 판
if (params.has('dupGrace')) CONFIG.UNIQUE_ASSIST.dupGrace = Math.max(0, +params.get('dupGrace') || 0); // 겹치기 시제품: 닿음이 끝난 뒤 받는 초 (10/31 · 기본 0 · 사장님 확인 전 — 확인표 3100)
if (params.has('dupAny')) CONFIG.UNIQUE_ASSIST.dupAny = +params.get('dupAny') ? 1 : 0; // 겹치기 시제품: 칼끼리 닿음이면 모두 (기본 0 · 확인표 3101)
if (params.has('dupStep')) CONFIG.UNIQUE_ASSIST.dupStep = Math.max(0, +params.get('dupStep') || 0); // 겹치기 시제품: 앞 걸음 m (기본 0 · 확인표 3102)
// 겹치기 자동 (사장님 10/31 16:xx — 시제품 · 기본 0 = 지금 탭 · 확인표 3220 ~ 3229): `?dupAuto=bind` · `?dupAuto=clash2` · 수는 실제 초 · m
if (params.has('dupAuto')) CONFIG.UNIQUE_ASSIST.dupAuto = ['bind', 'clash2'].includes(params.get('dupAuto')) ? params.get('dupAuto') : 0;
for (const k of ['dupStackS', 'dupStackGap', 'dupClashT', 'dupClashGap']) if (params.has(k) && +params.get(k) >= 0) CONFIG.UNIQUE_ASSIST[k] = CONFIG.realS(+params.get(k)); // 실제 초
for (const k of ['dupBandMax', 'dupClashMax', 'dupStackDrain']) if (params.has(k) && +params.get(k) >= 0) CONFIG.UNIQUE_ASSIST[k] = +params.get(k); // 가슴 사이 m (dupClashMax 0 = 위 끝 없음) · 빠짐 초당 몫 (0 = 곧장 0)
if (params.has('dupBandMin')) CONFIG.UNIQUE_ASSIST.dupBandMin = +params.get('dupBandMin') > 0 ? +params.get('dupBandMin') : null; // null = 죽음의 일격 거리(SECRET.mordCloseN)
for (const k of ['dupAutoParry', 'dupAutoHint']) if (params.has(k)) CONFIG.UNIQUE_ASSIST[k] = +params.get(k) ? 1 : 0;
if (params.has('stickGuard')) CONFIG.INPUT.stickGuardPx = Math.max(0, +params.get('stickGuard') || 0); // 이동 스틱 둘레 (px — 10/31 08:xx 사장님 '+10~20px 정도' · 기본 15 · 0 = 전 판) [확인표 3096]
if (params.has('stickGuardGrab')) CONFIG.INPUT.stickGuardGrab = +params.get('stickGuardGrab') ? 1 : 0; // 둘레에 닿은 손가락이 스틱을 쥠 (기본 1 · 0 = 버리기만) [사장님 확인 전 — 확인표 3097]
if (params.has('holdPx') && +params.get('holdPx') > 0) CONFIG.INPUT.holdPx = +params.get('holdPx'); // 길게 누름 떠돎 한도 (손가락 px — 10/31 · 기본 24 · 12 = 전 판 탭 문턱) [사장님 확인 전 — 확인표 3090]
if (params.has('strokeMin')) CONFIG.STAMINA.humanStrokeMin = Math.max(0, +params.get('strokeMin') || 0); // 사람 긋기 청구 바닥 (패드 m — 10/31 · 기본 0.15 · 0 = 전 판 strokeTravel 0.06) [사장님 확인 전 — 확인표 3092]
if (params.has('rdEdge')) CONFIG.UNIQUE_ASSIST.rdEdge = +params.get('rdEdge') < 0 ? -1 : 1; // 감는 칼 날 쪽 (기본 −1 — 사장님 확인 전)
if (params.get('b4Old') === '1') CONFIG.applyB4Old(true); // B4 옛 판 견줌 (사장님 10/31 19:xx 다시 짬 — 기본 새 판 · 1 = 10/31 14:xx 판: 어깨에 얹음 · 곧장 사선 60° · 흐름의 첫 칼 · 아래 칸 하나하나는 그 위에 덮음)
if (params.has('rdWind')) CONFIG.UNIQUE_ASSIST.rdWindMode = ['spin', 'slowSpin', 'shoulder', 'load'].includes(params.get('rdWind')) ? params.get('rdWind') : 'load'; // 풍차 베기 감기 꼴 (사장님 10/29 20:0x 두 안 · 10/30 00:1x 'A로' · 10/31 02:xx 'b안으로 본판 적용해' · 10/31 19:xx 어깨에 메기 — 기본 'load' · 10/31 08:xx 판 'shoulder' · 안 A 'slowSpin' · 10/29 판 'spin')
if (params.has('rdRelease')) CONFIG.UNIQUE_ASSIST.rdRelease = ['chamber', 'direct', 'tajo'].includes(params.get('rdRelease')) ? params.get('rdRelease') : 'tajo'; // 풍차 베기 내려침 길 (사장님 10/30 00:1x '바로 내려치는 게 아닌가?' · 10/31 19:xx '45도~90도 사이로' — 기본 'tajo' 멘 어깨에서 내려침 · 'direct' 10/30 곧장 사선 · 'chamber' 10/29 판 왼 어깨 뒤 길)
if (params.has('rdTajoAngle')) CONFIG.UNIQUE_ASSIST.rdTajo = { ...CONFIG.UNIQUE_ASSIST.rdTajo, angle: Math.min(90, Math.max(45, +params.get('rdTajoAngle') || CONFIG.UNIQUE_ASSIST.rdTajo.angle)) }; // B4 내려침 벰 면 각 (10/31 19:xx 사장님 '45도~90도 사이로' — 견줌용)
if (params.has('rdAiOld')) CONFIG.UNIQUE_ASSIST.rdAiOld = +params.get('rdAiOld') ? 1 : 0; // AI B4 옛 판 (10/31 19:xx — 기본 0 = AI 도 새 꼴)
if (params.has('ibWindApart')) CONFIG.IB_FLOW.windmillApart = +params.get('ibWindApart') ? 1 : 0; // B4 와 흐름 서로 닿지 않음 (10/31 19:xx 사장님 '이어지는 흐름과 무관' — 기본 1)
if (params.has('rdAiWind')) CONFIG.UNIQUE_ASSIST.rdAiWind = +params.get('rdAiWind') ? 1 : 0; // AI 풍차 베기 = 사람과 같은 감기 · 내려침 (사장님 10/31 08:xx — 기본 1 · 0 = 옛 판 패드 길)
if (params.has('rdAiQuick')) CONFIG.UNIQUE_ASSIST.rdAiQuick = +params.get('rdAiQuick') ? 1 : 0; // (a) 빠른 틈엔 감지 않고 바탕 동작 (사장님 10/31 13:4x — 기본 1 · 0 = 08:xx 판)
if (params.has('rdAiThrift')) CONFIG.UNIQUE_ASSIST.rdAiThrift = +params.get('rdAiThrift') ? 1 : 0; // (c) 성향마다 기력 아낌 (사장님 10/31 13:4x — 기본 1 · 0 = 늘 감음)
if (params.has('rdSteady')) CONFIG.UNIQUE_ASSIST.rdSteady = +params.get('rdSteady') ? 1 : 0; // 풍차 베기 감기 휘청 고침 (10/29 20:0x — 기본 1 · 0 = 10/29 판)
if (params.has('rdRamp')) CONFIG.UNIQUE_ASSIST.rdRamp = +params.get('rdRamp') ? 1 : 0; // 감기 첫머리 도는 빠르기 부드럽게 (10/29 20:0x — 기본 1)
if (params.has('ibChain')) CONFIG.IB_FLOW.chainStack = +params.get('ibChain') ? 1 : 0; // 이어지는 흐름 (이베리아 B6 — 사장님 10/29 01:4x · 01:5x · 기본 1)
if (params.has('ibFreeEvery')) CONFIG.IB_FLOW.freeEvery = Math.max(0, Math.round(+params.get('ibFreeEvery') || 0)); // 이어지는 흐름 — 사슬 세 칼마다 기력 0 (사장님 10/29 14:2x · 기본 3 · 0 = 끔)
if (params.has('ibWindChain')) CONFIG.IB_FLOW.windmillChain = ['simple', 'inside'].includes(params.get('ibWindChain')) ? params.get('ibWindChain') : 0; // 풍차 베기를 이어 그은 칼 하나로 셈 (사장님 10/29 01:5x · 08:3x 'simple' — 기본 'simple' · 'inside' 견줌 · 0 끔)
if (params.has('ibWindPower')) CONFIG.IB_FLOW.windmillPower = +params.get('ibWindPower') ? 1 : 0; // 풍차 베기 내려침 자체 흐름 위력 (사장님 10/31 14:xx — 기본 0 = 없음 · 사슬 첫 칼 자리는 그대로 · 1 = 10/29 판 × 1.2)
if (params.has('dupEdge')) CONFIG.UNIQUE_ASSIST.dupEdge = +params.get('dupEdge') < 0 ? -1 : 1; // 겹치기 날 (1 긴 날 · −1 짧은 날)
if (params.has('koteDrop')) CONFIG.UNIQUE_ASSIST.koteDrop.p = +params.get('koteDrop') || 0; // 손목 치기 칼 떨구기 확률(10/24 J8 — 판 값 0.5 · `?koteDrop=0` 끔)
if (['cut', 'arm', 'all'].includes(params.get('koteJudge'))) CONFIG.UNIQUE_ASSIST.koteDrop.judge = params.get('koteJudge'); // 칼 떨구기 닿음 판정(10/24 12:3x — 판 값 'all' · 'cut' = 11:5x 판 · 'arm' = 아래팔 닿음만)
if (params.has('uniqueAssist')) CONFIG.UNIQUE_ASSIST.on = +params.get('uniqueAssist') ? 1 : 0; // 플레이어 고유 동작 강화(10/14 — 10/13 이어 주기): 기본 1, `?uniqueAssist=0` = 끔 (기술 이름 알림도 없음)
// 테스트 경로도 기본 켬 (사장님 10/14 03:1x '테스트에서 켜' — 10/14 02:0x 부터 '궤적은 내 것' 강화 판으로 다시 만드는 동안 꺼 두었던 것). 끄려면 `?uniqueAssist=0`
if (params.has('uniqueEnhance')) CONFIG.UNIQUE_ASSIST.enhance = Math.max(0, +params.get('uniqueEnhance') || 0); // 고유 동작 강화 세기(10/14): 기본 1 · 0 = 기술 이름 알림만 · 0.5 = 절반 (걸음·몸·끝 힘 한꺼번에)
const UNIQUE_STAGE = stageParam(params.get('uniqueStage')); // 개발 인자 `?uniqueStage=0..5`: 손에 든 무기 유파의 옛 급 N 까지의 스킬트리 칸을 켬 (0 = 칸 없음 · 1 = 보법 · 2 = + 막기 · 3 = + 고유 공격 · 심화 · 4 = + 패시브 · 5 = 모두 — 익힌 칸 · 테스트 경로보다 먼저, skill_tree_store.js playerKit). 없으면 익힌 칸 · 테스트 경로는 모두
const SKILL_NODES = params.get('skillNodes'); // 개발 인자 `?skillNodes=G1,G5`(10/21): 그 칸만 켬 · `all` = 모두 · 빈 값 = 없음 — ?uniqueStage 보다도 먼저 (칸 하나씩 시험)
const FOE_PROF_PARAM = params.get('foeProficiency'); // 시험: 그 판 상대의 숙련도 덮어쓰기 `?foeProficiency=0..6` (실력 숫자 이름·고유 동작 거르기·5 이상 비기 모두 — characters.js aiAtProficiency). 없거나 범위 밖이면 인물 시트 값
const FOE_PROF = /^[0-9]$/.test(FOE_PROF_PARAM ?? '') && +FOE_PROF_PARAM < AI_PROFICIENCY.levels.length ? +FOE_PROF_PARAM : null; // 0 ~ 6 (10/24 — 6 칸 · 전 0 ~ max 5)
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
// 10/22 대검 마무리 (docs/strike/greatsword_finish_2026-10-22.md · 확인표 2211~2217): `?finishCleave=0` = 사람 칼도 전 찍기 · `?finishCleaveAi=1` = AI 칼도 쪼개 내려치기 (기본 끔) · `?finishCleaveCharge=초` = 힘 모으기 시간
if (['0', '1'].includes(params.get('finishCleave'))) FINISH_SWITCH.cleave.player = params.get('finishCleave') === '1';
if (params.get('whip') === 'src') setWhipPreset('src'); // 10/23 드루이드의 채찍: 샛별 저장소 덩굴 값 그대로(손맛 고치기 전 — 견줌용 · docs/import/druid_whip_2026-10-23.md)
if (['0', '1'].includes(params.get('finishCleaveAi'))) FINISH_SWITCH.cleave.ai = params.get('finishCleaveAi') === '1';
if (params.has('finishCleaveCharge') && Number.isFinite(+params.get('finishCleaveCharge'))) FINISH_SWITCH.cleave.charge = CONFIG.realS(Math.max(0, +params.get('finishCleaveCharge')));
if (['0', '1'].includes(params.get('finishCleaveLow'))) FINISH_SWITCH.cleave.anyHeight = params.get('finishCleaveLow') === '1'; // 10/22 23:0x 꿇기 이하 어떤 높이든(상태로 열기) · 땅까지 — 0 = 첫 판(찍기와 같은 문 · 몸 점까지)
if (params.has('schoolGait')) CONFIG.GAIT.school = +params.get('schoolGait') ? 1 : 0; // 유파 걸음(10/10 비싼 층, gait.js gaitParams): 기본 1, `?schoolGait=0` = 모든 유파 같은 걸음(전 판)
if (params.has('strideRule')) CONFIG.GAIT.strideRule = +params.get('strideRule') ? 1 : 0; // 보폭 규칙(10/15 20:3x 사장님 — 유파 보폭 상한 0.62 × k · 박자 2.05 ÷ k, 최고 빠르기 같음 · docs/strike/stride_rule_2026-10-15.md): 기본 1, `?strideRule=0` = 옛 유파 값
if (params.has('jpSteady')) CONFIG.BALANCE.schoolSteady = +params.get('jpSteady') ? 1 : 0; // 일본 보법 버티기(10/15 — 흔들림 × 0.75, fighter.js swayScale): 기본 1, `?jpSteady=0` = 끔
// 이탈리아 박자 걸음 셈(10/15 — schools.js ITALIAN_GAIT.rhythm · setItalianRhythm, docs/strike/italian_rhythm_2026-10-15.md §8 · §9 · §10): 기본 디딤 셈 2 + 2 · ×1.5(보통 디딤 둘 → 빠른 디딤 둘 — 사장님 10/15 15:1x 2 + 2 · 19:3x '50%로 해'),
//  15:1x 판(×1.3) 비교 `?itRhythm=2+2x1.3`('N+MxK' = 배율 손으로) ·
//  지난 판 비교(그때 ×1.5): `?itRhythm=4+2`(13:2x 판) · `?itRhythm=3+2` · `?itRhythm=3` = 옛 짝 셈 3 + 1(10/15 오전 판 — 짝걸음 한 짝 = 한 걸음) · `?itRhythm=4` = 옛 짝 셈 4 + 1 · `?itRhythm=0` = 끔
if (params.has('itStride')) setItalianStride(params.get('itStride')); // 이탈리아 보폭 박자(10/15 22:1x · 22:5x — 짧은 디딤 둘 0.8 + 몸 ×1.3 → 긴 디딤 둘 1.1): `?itStride=0` = 22:0x 판(속도 ×1.5 · 계수 0.7) · `?itStride=a,b[,c[,p]]` = 짧은·긴 계수·짧은 디딤 빠르기 · 가까이 짝걸음 보폭 상한(예 0.8,1.1 = 보폭만 · 0.7,1.2 · 0.8,0.8,1.5 · 0.62,0.85,1.3,0.44)
if (params.has('itRhythm')) setItalianRhythm(params.get('itRhythm'));
if (params.has('itWalk')) setItalianWalk(params.get('itWalk')); // 이탈리아 보법 빠르기 시험(10/21 — 판 값 없음): `?itWalk=1,1.15,1.5` = 앞 · 뒤 걷는 빠르기 배율 · 짧은 디딤 가속 한도 배율(사람 · AI) · `?itWalk=p:1,1.15` = 앞뒤 배율만 플레이어만 — 제안 갈래(10/21 재기): R0 `?itStride=0.62,0.85,1.3,0.44&itWalk=1,1,1.5` · R `?itStride=0.62,0.85,1.3,0.44&itWalk=1,1.1,1.5`
if (params.has('itBackCap')) setItalianBackCap(params.get('itBackCap')); // 이탈리아 물러서기 걸음 수 한도(10/31 08:xx 사장님 '네걸음 이후에는 (다섯 걸음째부터) 70% 적용' — schools.js ITALIAN_GAIT.backCap): `?itBackCap=0` = 10/21 판(늘 뒤 느려짐 없음) · `?itBackCap=N` = N 걸음까지
if (params.has('itGait')) CONFIG.GAIT.itEven = params.get('itGait') === 'old' ? 0 : 1; // 이탈리아 고른 바탕 걸음(10/15 19:3x 사장님 '이탈리아 보법 자체가 이미 불균질' — 고른 짝걸음, docs/strike/italian_rhythm_2026-10-15.md §10): 기본 켬, `?itGait=old` = 옛 짝걸음('따·닥 + 쉼')
if (params.has('deChase')) CONFIG.GAIT.deChase = +params.get('deChase') ? 1 : 0; // 독일 간격 잡기의 빠른 디딤(10/15 — 상대 헛침 뒤 앞 두 걸음 빠른 걸음, docs/strike/german_chase_2026-10-15.md · 그때 이름 '따라 들어가기'): 기본 1, `?deChase=0` = 끔(잡기도 없음)
if (params.has('deHold')) CONFIG.GAIT.deHold = +params.get('deHold') ? 1 : 0; // 독일 간격 잡기의 잡기(10/15 18:0x — 칼이 제대로 들어가는 거리 contact 에서 서고 0.6 s 앞 몫 0 · 스틱 놓았다 밀면 풀림 · 플레이어만, docs/strike/german_hold_2026-10-15.md): 기본 1, `?deHold=0` = 끔(빠른 디딤만 — 지금 판)
if (params.has('cnLight')) CONFIG.GAIT.cnLight = +params.get('cnLight') ? 1 : 0; // 동방 보법 가벼운 발(10/15 18:3x — 발로 내는 가속 한도의 보통 걸음 몫 × 1.5, 최고 빠르기 그대로 · 사람·AI 같이, docs/strike/cn_light_feet_2026-10-15.md): 기본 1, `?cnLight=0` = 끔(지금 판)
if (params.has('cnLightAi')) CONFIG.GAIT.cnLightAi = +params.get('cnLightAi') ? 1 : 0; // 동방 AI 걸음 박자(10/15 — 가벼운 발 몸의 AI 는 공격 꼴에서만 가벼운 발 · 간 보기·막기·물러남은 옛 가속, docs/strike/cn_light_feet_2026-10-15.md §7): 기본 1, `?cnLightAi=0` = 끔(사람·AI 같이 — 지금 판)
if (params.get('walk') === 'old') Object.assign(CONFIG.GAIT, { moveSpeed: 2.3, backFactor: 0.45, sideFactor: 0.31 }); // 걷기 빠르기 전 값(10/15 사장님 결정 전 — 앞 2.3 · 뒤 × 0.45 · 옆 × 0.31) 비교용: `?walk=old`
if (params.has('burstDe')) CONFIG.GAIT.burstDe = +params.get('burstDe') ? 1 : 0; // 박차기는 독일 보법(10/15 20:4x 사장님 '박차기는 독일 보법으로 넣어' — 뒤 박차기는 독일 유파만 · 옆은 이베리아만 그대로 · 그 밖 유파 없음, docs/strike/step_burst_2026-10-15.md §10): 기본 1, `?burstDe=0` = 지금 판(이탈리아 빼고 모든 유파)
if (params.has('stepBurst')) CONFIG.GAIT.stepBurst = +params.get('stepBurst') ? 1 : 0; // 첫 걸음 박차기(10/15 — 서 있다가 뒤·옆으로 떼는 첫 걸음만 빠름, 플레이어만 · 이탈리아 빼고 · 옆은 이베리아만(10/15 15:1x), docs/strike/step_burst_2026-10-15.md): 기본 1, `?stepBurst=0` = 끔
// 전체 빠르기 손잡이 (10/10 사장님 '모티브 게임은 모든 움직임이 다 빠르다'): `?tempo=1.35|1.5|1.7` — 게임 시간 배율(실제 1 초에 물리 스텝을 더 돌림, 비기 느린 화면의 반대 꼴).
//  기본 1 = 오늘 그대로. 시뮬 도구에는 닿지 않는다(이 파일만). 프레임마다 스텝 상한(PHYSICS.maxStepsPerFrame)은 그대로 — 느린 폰에선 상한에 걸리면 그만큼 덜 빨라진다
const TEMPO = CONFIG.TIME.tempo; // = Math.min(2, Math.max(0.5, +(params.get('tempo') ?? 1.1) || 1.1)) — config.js TIME 한 곳(표준 시간 std 가 이 템포를 따라감 · 10/25 22:3x) · 기본 1.1 (사장님 10/10 05:1x '기본 템포 1.1로'), 전 값 `?tempo=1` // 결정타 연출(비기 터뜨림 순간 화면 시간 늦춤, CONFIG.SECRET.slowMo): `?slowMo=0` = 끔
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
if (params.has('elbowSwivel')) CONFIG.JOINTS.elbowSwivel = +params.get('elbowSwivel') ? 1 : 0; // 기본 켬 (사장님 10/24 17:2x · `?elbowSwivel=0` 전 판): 칼이 새끼 쪽으로 꺾이면 팔꿈치를 돌려 세움 (fighter.js elbowSwivel — 사람 · AI 모두)
if (params.has('wristGuard')) CONFIG.JOINTS.wristGuard = +params.get('wristGuard') ? 1 : 0; // 기본 켬 (사장님 10/24 17:2x · `?wristGuard=0` 전 판): 사람 손목 범위 밖 칼 겨눔을 범위 끝으로 (fighter.js wristClamp — 사람 · AI 모두 · 밧줄은 아래 wristRope)
if (params.has('swivelThrust')) CONFIG.JOINTS.swivelThrust = +params.get('swivelThrust') ? 1 : 0; // 10/24 17:2x 뒤 고침 (기본 켬 · `?swivelThrust=0` = 17:2x 판): 탭 찌르기 동안 팔꿈치 돌림이 칼을 아래팔의 연장 쪽으로 (fighter.js elbowSwivel align)
if (params.has('wristPronate')) CONFIG.JOINTS.wristPronate = +params.get('wristPronate') ? 1 : 0; // 10/25 (기본 켬 · `?wristPronate=0` = dbf2120 판): 한손 무기 엎친 손 길 — 높은 자세에서 손을 엎쳐 손목을 굽혀 칼끝을 상대 쪽으로 (fighter.js wristPlane)
if (params.has('swivelHuman')) CONFIG.JOINTS.swivelHuman = +params.get('swivelHuman') ? 1 : 0; // 10/25 01:2x (기본 켬 · `?swivelHuman=0` = 10/24 17:2x 뒤 판): 한손 무기 팔꿈치 돌림이 팔꿈치를 줄 위로 · 아래팔 굴림 · 위팔 돌림을 한도 밖으로 밀지 않게 (fighter.js elbowSwivel armOk)
if (params.has('cutPronate')) CONFIG.JOINTS.cutPronate = +params.get('cutPronate') ? 1 : 0; // 10/25 19:0x (기본 켬 · `?cutPronate=0` = 10/25 전 판): 엎친 손 길은 손이 자세에 쉬는 동안만 — 칼을 끄는 동안(감기 · 긋기 · 자세 사이 옮김)은 팔꿈치 돌림 + 굴림 0 손 면 교정 (fighter.js pronateRest · 사람 · AI 한손 무기)
if (params.has('itThrust')) CONFIG.THRUST.itLunge = +params.get('itThrust') ? 1 : 0; // 10/25 08:0x 사장님 '이탈리아 찌르기 손봐' (기본 켬 · `?itThrust=0` = 10/25 아침 판): 이탈리아 유파 탭 찌르기 · AI 찌르기 기술 = 몸통 겨눔 · 당기지 않음 · 몸이 실린 런지 · 몸이 다 실릴 때까지 뻗은 채 (skill.js thrust · updateThrust · ai.js startStrike · gaitStep)
if (params.has('wristSwing')) CONFIG.JOINTS.wristSwing = Math.max(0, Math.min(2, Math.round(+params.get('wristSwing') || 0))); // 시험 (10/25 · 기본 0): 베는 동안 손목 교정 — 1 = 칼 면 안에서만 · 2 = 안 함 (fighter.js wristGuardAim · cutSwing · 기록 wrist_audit §11)
if (params.has('wristRope')) CONFIG.JOINTS.wristRope = +params.get('wristRope') ? 1 : 0; // 시험 (10/24 17:2x · 기본 끔 · `?wristRope=1` = 손목 치우침 밧줄 둘 — fighter.js gripDevOn · 기록 §9)
if (CONFIG.JOINTS.presets[params.get('joints')]) CONFIG.JOINTS.mode = params.get('joints'); // 칼 팔 관절 가동 범위 교정 시제품(10/9, docs/motion/joint_range_2026-10-09.md): `?joints=off|anat|hard|soft|reach`, 없으면 기본 anat(켬)
// 타격감 (10/25 사장님 '타격감 보강도 진행해' — config IMPACT_FX · src/impact_fx.js · 화면 · 소리만): `?impactFx=0` = 10/25 전 게임 그대로(옛 멈칫 · 흔들림 식 · 무게 소리 없음) · `?impactMass=0` = 무게 배율 없이 판정 에너지만(견주기)
if (params.has('impactFx')) CONFIG.IMPACT_FX.on = +params.get('impactFx') ? 1 : 0;
if (params.has('impactMass') && +params.get('impactMass') >= 0) CONFIG.IMPACT_FX.massExp = +params.get('impactMass');
const chainParam = params.get('chain');
if (chainParam === 'legs' || chainParam === 'anchor') CONFIG.BODY.chain = chainParam;
let lastPlayerWeapon = null; // 지난 판에 고른 무기 (여정 이어하기 저장용 — 10/21 16:3x 사장님 '이전 판 무기 다시 안 나오게 하는 제한 없애' 로 카드에서 빼지 않는다)
/** 이번 판 내 카드 두 장 (맨 오른쪽 세 번째 칸은 상대 무기라 여기서 뽑지 않는다): 뽑기 목록에서 겹치지 않게 고르게 뽑는다
 *  (지난 판 무기를 빼던 규칙은 10/21 사장님 지시로 없앰 — 9/27 첫 카드 뽑기 때 감독이 넣은 것, 사장님 지시 기록 없음).
 *  테스트용 ?cards=excalibur,rubber_chicken 으로 두 장을 정할 수 있다 (세 번째 id 를 적어도 버린다: 상대 카드는 상대 무기다) */
function drawCardIds() {
  // 모르는 id 는 버리고(getWeapon 이 롱소드로 바꿔 버린다) 서로 다른 두 장일 때만 쓴다
  const forced = (params.get('cards') || '').split(',').filter((id) => id && getWeapon(id).id === id).slice(0, 2);
  if (forced.length === 2 && forced[0] !== forced[1]) return forced;
  // 등급을 먼저 뽑고 그 등급 안에서 고른다 (사장님 결정 — 등급 확률은 weapons.js TIER_DRAW 한 곳 · 편지가 있으면 아래 칸마다 무게)
  // 편지 (스킬트리 — 사장님 10/21 '칸마다 무게'): 칸마다 무게 = 등급 확률 ÷ 그 등급 칸 수, 편지를 가진 유파 칸은 × LETTER.mult — 모든 등급에서 한 번에 (편지가 없으면 지금 뽑기 그대로 — weapons.js drawWeaponCards weightOf)
  const letters = playerLetters({ test: testRoute.active });
  // 호칭 (사장님 10/24 04:0x): 가진 호칭 하나마다 레전드 +0.2 %p · 커먼 −0.2 %p — 여정 · 방랑의 내 카드만(테스트 경로 · 고정 주소 판은 기본 표)
  const tierDraw = careerSaves() && !testRoute.active ? titleTierDraw(TIER_DRAW) : TIER_DRAW;
  return drawWeaponCards(PLAYER_WEAPON_POOL, 2, { tierDraw, ...(letters.size ? { weightOf: (id) => letterMul(traditionOf(getWeapon(id)), letters) } : {}) });
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
const strikeCue = createStrikeCue(scene, screenTint, params.get('strikeCue'), { anchor: params.get('cueAnchor'), secretEdge: params.get('secretEdge'), secretEdgeW: params.get('secretEdgeW'), secretEdgeA: params.get('secretEdgeA'), secretEdgeStyle: params.get('secretEdgeStyle'), secretEdgeLevel: params.get('secretEdgeLevel') }); // 칠 때 알림 (strike_cue.js): 느낌표 하나를 장면에 먼저 붙여 둔다

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
// 첫 화면·대기실에서 연 여정 (game_entry.js → launchJourney — docs/import/lobby_port_2026-10-16.md §5): 이어하기 지점 저장 · 대면 결과 기록 · 대기실 이름은 이 판들에서만.
//  주소로 무대·상대·무기를 고정했거나 테스트 경로면 여정이 아니다 (아래 checkRoundEnd 의 '무대 깸' 조건 + 고정 무기 없음)
let journeyMode = false;
let pendingJourney = null; // 이어하기: 다음 startFight 가 되살릴 무대 시작 지점 (validJourney 가 고른 것 · 방랑이면 지금 판)
const JOURNEY_PURE = foeParam === 'stage' && !STAGE_PIN && !testRoute.active && !FIXED_WEAPON;
const journeySaves = () => journeyMode && JOURNEY_PURE;
// 방랑 (10/23 — wander_rules.js · 대기실 '방랑' 단추 → game_entry.js → launchWander): 무작위 무대 · 상대 · 방랑 보상(이기면 +20~50 · 연승 보너스 · 특별 몫 — 10/24 03:0x) · 저장은 lobby_progress.js 의 wander 칸(여정 이어하기 지점 · 깬 수는 안 건드림).
//  주소 고정 판 · 테스트 경로에서는 열리지 않는다(JOURNEY_PURE). 여정과 같은 몫: 대기실 장착 · 대기실 이름 · 대면 결과 · 정지 · 결과 창의 '대기실'(careerSaves)
let wanderMode = false;
let wanderResume = false; // 이번 startFight 가 대기실에서 들어온 것인가(저장된 판 그대로 — 카드 · 고른 무기까지) · 아니면 정지 창 '재대결' · '다음 방랑'
const wanderSaves = () => wanderMode && JOURNEY_PURE;
const careerSaves = () => journeySaves() || wanderSaves();
// 방랑 풀: 무대 = 여정 30곳(보관용 화전 터 · 어두운 홀 빼고) · 상대 = 그 무대 상대 + 방랑 전용 일곱(아르토리아 두 모습 · 롤랑 · 백린의 전사 · 베르나르도 · 쥘리아 두 모습 — 10/30 22:1x)
const WANDER_STAGES = [...STAGE_ORDER];
const WANDER_FOES = [...new Set([...WANDER_STAGES.map((id) => STAGE_FOE[id]), ...WANDER_EXCLUSIVE])].filter((id) => CHARACTERS_BY_ID[id]);
// 주소 스위치 (?title=1 과 함께 — 대기실을 거쳐야 방랑이 열린다): ?wanderQuit=1 = 싸움 도중 그만두면 패배 · ?wanderLegacy=0 = 옛 저장 한 바퀴 인정 끔 (wander_rules.js WANDER — 사장님 확인 전)
if (['0', '1'].includes(params.get('wanderQuit'))) WANDER.quitAsLoss = params.get('wanderQuit') === '1';
if (['0', '1'].includes(params.get('wanderLegacy'))) WANDER.legacyLoop = params.get('wanderLegacy') === '1';
if (['0', '1'].includes(params.get('wanderResume'))) WANDER.resumeState = params.get('wanderResume') === '1'; // 몸 상태 이어받기 (사장님 10/30 01:1x · 08:2x '둘 다 켜' — 기본 켬 · 0 = 전 판: 같은 대면을 처음 몸으로)
// 대기실 장착을 싸움에 (docs/import/lobby_fix_2026-10-16.md §3): 첫 화면·대기실에서 연 여정만(journeySaves — 주소 고정 판·테스트 경로·옛 메뉴 판은 지금 그대로).
//  weapon = 대기실 무기(있으면 무대마다 카드 없이 그 무기 · 없으면 카드) · armor = 케틀 햇(있으면 투구 + 최대 기력 130 · 없으면 맨머리) ·
//  neck = 용사의 눈물(있으면 플레이어 기력 무한 + 내 기력 막대 없음 · 겉모습 그대로 — 10/17, docs/import/hero_tear_2026-10-17.md).
//  스킬트리(유파 몫)는 여기가 아니라 모든 판이 읽는다 — newRound 의 playerKit (10/16 08:1x 인장 없앰 · 10/21 스킬트리)
const journeyLoadout = () => (careerSaves() ? { weapon: readLobbyEquipment(), armor: readLobbyArmor(), neck: readLobbyNeck() } : null); // 방랑도 같다
const LOOK_BAREHEAD = { ...LOOKS.player, helmet: null }; // 케틀 햇을 벗은 주인공 — 겉모습·머리 방어 둘 다 없음 (fighter.js look.helmet)
// 이번 판 금화 · 머리 (결과 창 한 줄 — showRewardLine). 첫 화면·대기실 여정만 바뀐다 (주소 고정 판 · 테스트 경로 · 옛 메뉴 판은 그대로)
let roundReward = null;
// 뿔피리 (사장님 10/30 19:0x "뿔피리는 '왕'을 잡으면 50% 확률로 얻어. 얻으면 전투 후 팝업에 획득 메시지가 뜸." — config.js SHOP · lobby_progress.js awardKingHorn):
//  여정 · 방랑(내 저장 판 — careerSaves)에서 왕(SHOP.hornKings)을 이긴 판 끝에 한 번 · 상점이 켜졌을 때만(SHOP.enabled — 본판은 끔) · 난수 = rand01(crypto — 게임 난수 그대로).
//  결과 창 = 금화 · 머리와 같은 줄에 '[뿔피리] 뿔피리 +1'(showRewardLine — 사장님 10/31 00:2x '금화나 목 획득처럼 아이콘만 넣고 따로 메시지 출력 안 함' · 전 10/30 은 금화 줄 아래 따로 한 줄 글).
//  상점 시험판 `?horn=1` = 모든 상대 · 늘(사장님이 왕까지 가지 않고 창을 보게 — 본판에는 없음)
let roundHorns = 0;
const HORN_FORCE = SHOP.testMode && params.get('horn') === '1';
const kingHorn = () => (SHOP.enabled ? awardKingHorn(currentFoe?.id, { kings: SHOP.hornKings, chance: SHOP.hornChance, amount: SHOP.hornAmount, force: HORN_FORCE }) : 0);
// 머리 (사장님 결정 10/16 04:3x '적의 머리를 베면 1개씩 주는 재화'): 참수가 일어난 순간 한 번 부르는 자리(combat.js COMBAT_HOOKS.onDecapitate — fighter.js applyWound ·
//  흙 몸의 머리 떨어짐 detachHeadFromWound)에 건다. 이 판 상대만 · 한 상대에 한 번(lobby_progress.js awardHead). 시뮬은 이 훅을 걸지 않는다(null)
//  방랑도 머리 1(WANDER_HEAD — 10/24 02:4x, 전 2) · 판마다 한 번 — 판 결과와 같은 저장에 적어 다시 열어도 두 번 받지 않는다(awardWanderHead). 쓰러뜨린 뒤 벤 목도 센다(여정과 같게)
COMBAT_HOOKS.onDecapitate = (f) => {
  if (f !== enemy || !careerSaves()) return;
  if (wanderMode) {
    if (awardWanderHead()) roundReward = { coins: roundReward?.coins ?? 0, heads: (roundReward?.heads ?? 0) + WANDER_HEAD, bonus: roundReward?.bonus, streak: roundReward?.streak };
    return;
  }
  if (!awardHead(f)) return;
  roundReward = { coins: roundReward?.coins ?? 0, heads: (roundReward?.heads ?? 0) + 1 };
};
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
 *  지거나 도중에 정지 창 "재대결"(10/24 02:4x — 전 '처음부터 다시')을 누르면 같은 배경 — 상대도 배경을 따르니 같은 상대와 다시 싸운다 (사장님 결정)
 */
function nextRoundStage() {
  if (wanderMode) {
    // 방랑: 무대는 startFight 가 지금 판(ensureWanderRun)대로 짓는다
    stageFought = true;
    lastRoundWon = false;
    return;
  }
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
  // 상대 무기: 주소에 foeWeapon/weapon을 직접 적었으면 그것, 아니면 캐릭터가 쓰는 무기 (브론은 10% 확률로 주워 온 커먼 칼)
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
  const loadout = journeyLoadout();
  // 손에 든 무기 유파의 스킬트리 — 모든 판 (첫 화면·대기실 여정 · 옛 메뉴 판 · 주소 판). 테스트 경로 = 모두 · ?uniqueStage=N = 옛 급 N 까지 · ?skillNodes= 그 칸만 (무유파 무기 = null — 유파 몫이 원래 없다)
  const kitSchool = traditionOf(getWeapon(weaponId));
  const kit = playerKit(kitSchool, readLearned(), { test: testRoute.active, upTo: UNIQUE_STAGE, nodes: skillNodesParam(SKILL_NODES, kitSchool) });
  player = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 0,
    human: true, // 사람 손(입력)이 모는 몸 — 기력 회복 사람 값(STAMINA.humanRecoverPerSecond — 사장님 10/29 17:5x) · 시뮬 도구는 안 넘김(자리 0 이어도 AI · 대본 몸)
    name: careerSaves() ? readProfile().name : '나', // 대기실 이름 (첫 화면에서 연 여정만 — 화면에 플레이어 이름이 나오는 자리는 없다. 메뉴 뒤 판·주소 판은 그대로 '나')
    x: -ARENA.startGap / 2,
    z: startZ,
    heading: 0,
    terrain, // 지형 무대만 땅 계약 (평지 null)
    look: loadout && loadout.armor !== LOBBY_ARMOR.id ? LOOK_BAREHEAD : LOOKS.player, // 대기실에서 케틀 햇을 벗었으면 맨머리 (여정만 — 그 밖은 지금처럼 케틀 햇)
    weapon: weaponId,
    // 스킬트리 (사람만 — 10/21): 보법 I 없음 = 기본 걸음(gait.js · stamina.js — schools.js footworkTradition) · 막기 I 없음 = 무유파 막기 자리(parry_button.js) — 걸음을 만들기 전에 넘긴다
    //  칸마다의 몫(보법 II · 막기 II · III · 이어 긋기 흐름 · 강화동작 이점 …)은 skillKit(skill_kit.js kitOff · perkOff 가 읽는다)
    schoolFootwork: kit ? kit.footwork : undefined,
    schoolParry: kit ? kit.parry : undefined,
    schoolPassive: kit ? kit.passive : undefined, // 패시브 칸 (이베리아 손목 힘 · 이탈리아 · 일본 · 독일 · 동방 — school_passive.js)
    skillKit: kit ?? undefined,
    ...(IB_TABLE === 'v2p' ? { guardTables: { iberian: iberianTableV2() } } : {}), // 이베리아 자세표 v2 사람만 (10/22 시험 — 기본 끔)
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
    z: stageStartZ(stages.id, 1), // 중정은 상대가 다른 자리 (샛별 제안 ② — 다른 무대는 startZ 와 같음)
    heading: Math.PI,
    terrain,
    look: enemyLook,
    weapon: foeWeapon, // prepareRound 가 정한 상대 무기
    revive: currentFoe?.revive, // 부활 (이졸데: 처음 죽으면 한 번 다시 일어선다, src/revive.js)
    physiology: currentFoe?.physiology, // 몸 규칙 (병마용: 출혈 0 · 머리가 떨어져야만 죽음 · 흙 몸 / 광기의 병마용: 사람 몸 · 흰 피 — fighter.js HUMAN_BODY). 없으면 사람
    vitality: currentFoe?.vitality, // 버티는 힘 (10/24 — 롤랑 · 베르나르도 1.1 · 없으면 1, fighter.js)
  });
  if (loadout?.armor === LOBBY_ARMOR.id) player.stamina.setMaxBonus(LOBBY_ARMOR.staminaBonus); // 케틀 햇 '생존술: 기력 +30' — 최대 130에서 시작·회복 (문턱 0 · −35 · −70 그대로 · 기력 끔이면 아무 일 없음)
  //  판 시작 장착으로 정한다: 판 중에 투구가 맞아 벗겨져도(fighter.js knockOffHelmet) 그 판은 130 그대로 — 사장님 결정 10/16 08:1x '아이템은 사라져도 효과는 그대로 둬.'
  if (loadout?.neck === HERO_TEAR.id) player.stamina.setInfinite(true); // 용사의 눈물 '기력 무한' (사장님 10/17) — 플레이어만 · 청구 · 지침 · 탈진 없음 · 머리 위 내 막대 없음(stamina_hud.js) · 몸에 붙이는 것 없음(겉모습 그대로)
  for (const [a, v] of [[player, enemy], [enemy, player]]) applyAweStart(a, v); // 티소나 '위세' (사장님 10/24 11:3x · 11:4x): 상대는 그 판을 최대 기력 − 15 로 시작 (stamina.js)
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
  const madEyes = attachMadEyes(enemy, ['madGlow','clothGlow'].includes(currentFoe?.eyes) || params.has('madEyes'), { veiled: currentFoe?.eyes === 'clothGlow', sheltered: currentFoe?.look?.alter === 'bran' }); // Veil transmits light; Bran's low brim hides pupils and leaves a dim spill.
  if (madEyes) auras.push(madEyes);
  for (const f of [player, enemy]) { const h = attachHands(f); if (h) auras.push(h); } // 벙어리장갑 손 (외형 PM, hands.js — 겉모습만)
  swordTrails.attach([player, enemy]); // 칼 잔상 띠: 이번 판 두 검객 (지난 띠는 지운다)
  if (player.weapon?.gun || enemy.weapon?.gun) warmGunFx(renderer, camera); // 권총 효과 재질을 지금 무대 빛으로 미리 컴파일 (첫 발 멈칫 방지)
  // 캐릭터를 골랐으면 그 캐릭터의 숙련도(실력 숫자 이름 level · 유파별 숙련도 persona.proficiency — characters.js)와 성격(persona)을 그대로 쓴다.
  //  캐릭터가 없으면(기본 상대) 숙련도 2(= 실력 숫자 normal, AI_PROFICIENCY.ofLevel) + 무작위 성격 (10/13 메뉴 난이도 줄을 뺌)
  //  ?foeProficiency=N 이면 그 판 상대의 숙련도를 N 으로 (시험)
  //  캐릭터가 평소와 다른 무기를 들었으면 유파 꾸러미도 그 무기 것으로 — 검술을 배우지 못한 인물(noSwordsmanship — 브론이 주워 온 칼, 사장님 10/25)은 꾸러미 그대로 (없으면 롱소드 기본) — 숙련도 표는 시트 무기 유파 열쇠라 그 무기 유파는 0(고유 동작 없음)
  const foeAI = currentFoe ? (FOE_PROF != null ? aiAtProficiency(currentFoe, FOE_PROF) : currentFoe.ai) : FOE_PROF != null ? { level: AI_PROFICIENCY.levels[FOE_PROF], persona: { proficiency: FOE_PROF } } : { level: 'normal', persona: null };
  const persona = currentFoe && foeWeapon !== currentFoe.weapon && !currentFoe.noSwordsmanship ? { ...foeAI.persona, school: getWeapon(foeWeapon).id } : foeAI.persona; // 꾸러미 id 는 정식 무기 id 로 (별칭 · 지운 무기 'ice' 같은 옛 id 가 롱소드 꾸러미로 떨어지지 않게 — 10/21)
  ai = new AI(enemy, player, foeAI.level, persona);
  if (testRoute.foeWhiff) ai.drill = new WhiffDrill(); // ?foeWhiff=1: 상대가 닿지 않는 거리에서 2~3 s 마다 허공을 벤다 (whiff_drill.js — 판마다 새 바깥 거리). 없으면 평소 그대로
  // 손에 든 무기 유파의 고유 공격 · 비기 = 위의 스킬트리 몫 kit (고유 공격 칸 하나 = 기술 하나 · 비기 칸 = 비기 — 사장님 10/21)
  playerSecret = new PlayerSecretWatch(player, enemy, { locked: !kit?.secret }); // 내 무기 유파의 비기 — 비기 칸을 익혔을 때만. 그 밖·스위치 끔·무유파·권총이면 S = null — 아무 일도 없다
  playerGuard = new PlayerParryGuard(player, enemy); // 막기 버튼 (누르는 동안만 손을 쥔다 — 권총·맨손이면 아무 일도 없다)
  player.stamina.controller = playerGuard;
  playerUnique = new PlayerUniqueAssist(player, { names: kit?.unique ?? new Set() }); // 고유 동작 강화: 익힌 고유 공격 칸의 기술만 (없음 · 무유파 · 끔이면 붙지 않음 — 무기 비검은 칸과 상관없이)
  uniqueCueSeen = null;
  secretSlow = 0;
  secretBurstsSeen = 0;
  {
    // 비기 소리 (10/25 — src/secret_sfx.js): 사람(검술 층) · AI(AI 실행부) 터뜨림 수를 따로 본다 — 지금 수가 바탕이라 지난 판 수가 판 시작에 터지지 않는다.
    //  AI 몸의 검술 층 수(enemy.skill.secretBursts)는 보지 않는다 (싱지르 · 모르트슐라크 AI 는 둘 다 세어 한 비기에 두 번이 된다)
    const P = player, E = enemy, A = ai;
    secretSfx = new SecretSfxWatch([
      { who: 'player', fighter: P, count: () => P.skill.secretBursts, run: () => P.skill.sec },
      { who: 'ai', fighter: E, count: () => A.secretBursts, run: () => A.secretRun },
    ], (file) => sound.secretSfx(file));
  }
  secretOpenSeen = 0;
  secretArcSeen[0] = player?.instantArc?.id ?? 0;
  secretArcSeen[1] = enemy?.instantArc?.id ?? 0;
  camSwing.t = -1;
  camPush.t = -1;
  camPush.run = null;
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
  hitStop.left = 0;
  hitStop.spent = 0;
  hitStop.quiet = CONFIG.IMPACT_FX.chainGap;
  // 시간이 흐르기 전에도(무기 뽑기 동안) 선 자세 그대로 보이게 겉모습을 몸에 맞춰 둔다
  player.syncMeshes();
  enemy.syncMeshes();
  warmRoundFx(fxWarm); // 판 도중 처음 나오는 효과(자국·잔상·입자·칼 조각)의 셰이더 (판의 난수를 다 쓴 뒤 — 그리기 전과 같은 순서)
}

// ── 타격감 ──
// 큰 타격 때 아주 잠깐 멈칫하는 연출 — left = 남은 멈칫(실제 초). 멈칫 = 화면 시간 배율만 낮춤(물리 스텝 길이 · 차례 그대로 — 판정 같음).
//  spent · quiet = 멈칫 묶음(타격감 10/25 — src/impact_fx.js stopGrant · stopTick: 잇달아 오는 멈칫 합 IMPACT_FX.chainCap 까지). 넣는 곳은 addHitStop 하나
const hitStop = { left: 0, spent: 0, quiet: 0 };
function addHitStop(t) {
  if (CONFIG.IMPACT_FX.on) stopGrant(hitStop, t, CONFIG.IMPACT_FX);
  else hitStop.left = Math.max(hitStop.left, t); // `?impactFx=0`: 옛 식 그대로 (더 긴 쪽만 · 묶음 상한 없음)
}
let playerEmo = null; // 플레이어 감정 판정 (emotions.js)
let playerEv = { hurt: false, parried: false, landed: false }; // 이번 프레임에 플레이어에게 일어난 사건
const playerTremor = { x: 0, y: 0, ax: 0, ay: 0, t: 0 }; // 공포 손 떨림 (지금 얹혀 있는 값·시계)
let clashCooldown = 0;
let clashStopCooldown = 0; // 칼끼리 부딪혀 멈칫한 뒤 다시 멈칫하기까지 (초)
const CLASH_GAP = CONFIG.realS(0.12); // 부딪힘 불꽃 · 소리 간격 (물리 스텝 시계 — 실제 초로 적음 · 표준 시간 10/25)
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
let secretSfx = null; // 비기 소리 걸쇠 (10/25 — 판마다 새로, src/secret_sfx.js)
let secretOpenSeen = 0;
// 비기 화면 연출 (10/10 발도 섬광 · 이베리아 카메라): 본 잔상 수 · 카메라 돌림 { t, sign }
const secretArcSeen = [0, 0];
const camSwing = { t: -1, sign: 1 };
// 런지 카메라 (10/25 14:0x 사장님 '리솔루토 쓰는 순간 비기인 줄 모르겠더라' → 안 1 — SECRET.risoCam): 시계 t · 런지 방향 (dx, dz — 수평 단위) · 본 런지(skill.sec 한 덩이)
const camPush = { t: -1, dx: 0, dz: 0, run: null };
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
  // 런지 카메라 (10/25 — SECRET.risoCam): 내 안다레 리솔루토 런지(skill.sec.lunge — 비기를 낸 그 덩이)를 본 첫 프레임에 내 가슴 → 상대 가슴(수평) 쪽으로 밀기 시작.
  //  사람 런지만 — AI 런지(지금은 없음 · 생기면 빛줄기만 sword_trail.js)는 카메라를 움직이지 않는다: 상대 비기에 화면이 상대 쪽으로 쏠리면 막고 물러날 내 조작 화면이 흔들림
  const run = player?.skill?.sec;
  if (run?.lunge && run !== camPush.run) {
    camPush.run = run;
    const a = player.bodies.chest.translation();
    const b = enemy.bodies.chest.translation();
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (CONFIG.SECRET.risoCam > 0 && L > 1e-3) Object.assign(camPush, { t: 0, dx: (b.x - a.x) / L, dz: (b.z - a.z) / L });
  }
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
  //  피 색(blood_palette.js — 사장님 10/27 23:2x · 샛별 저장소 6821e98c): 광기의 병마용(physiology.blood 'white')은 사람 길 그대로에 피만 희다 —
  //   튀는 피 · 바닥 얼룩 · 상처 자국 · 번지는 핏자국 · 칼에 묻는 피 · 핏방울(updateDrips). 붉은 피 사람은 예전 값 그대로
  const clay = vic.physiology?.body === 'clay';
  const blood = bloodPalette(vic);
  // 피: 벤 방향으로 흩뿌림
  if (clay) { if (e > 5) particles.clayChips(point, r.dir, e); } // 5 J 넘는 타격마다 잠깐 흩어지는 흙 알갱이 (샛별 값 — 확인표 1420)
  else if (opened) particles.blood(point, r.dir, 6 + r.severity * 40, r.speed, blood.splash);
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
      if (e > 15) stickDecal(mesh, local, null, 'bruise', 0.05 + Math.min(0.08, e / 1500), 0.05 + Math.min(0.08, e / 1500), blood.key);
    } else {
      const len = Math.min(0.24, 0.06 + sev * 0.14);
      if (r.type === 'stab') stickDecal(mesh, local, null, 'stab', 0.05 + sev * 0.02, 0.05 + sev * 0.02, blood.key);
      else stickDecal(mesh, local, bladeLocal, clothed ? 'tear' : 'cut', 0.035 + Math.min(0.03, sev * 0.02), len, blood.key);
      // 피가 옷에 번진다 (상처에서 계속 흐르는 만큼)
      const wound = vic.wounds.findLast((w) => !w.stump); // 참수: 목 단면(stump)은 건너뛰고 목 상처에 번진다
      if (wound && wound.part === pr.v.part && !wound.soak) wound.soak = stickDecal(mesh, local, null, 'soak', 0.04, 0.04, blood.key);
    }
  }
  if (opened && !clay) att.bloodyBlade(0.08 + r.severity * 0.15, blood.blade); // 흙 몸을 벤 칼에는 피가 묻지 않는다 (흰 피 몸을 벤 칼에는 흰 피)
  // 소리: 투구는 투구 소리. 판금은 전투 판정(r.plate — 아직 붙어 있는 판이 덮은 곳을 맞았다)을 따른다:
  //  날이 들지 못했으면 판금이 막는 소리(때린 무기 재질대로), 판을 뚫고 들어갔으면 강철 소리 한 번 (살 소리는 아래에서 따로)
  //  불꽃: 막혔으면 더 많고, 판을 뚫고 들어가도 강철을 긁은 불꽃이 조금 튄다 (ARMOR 를 켰을 때만 — 끄면 예전 그대로)
  const mat = att.weapon?.material || 'steel';
  const whipHit = !!att.weapon?.flexible; // 드루이드의 채찍 (10/23): 투구 · 판금 · 살 모두 채찍 녹음으로 (흙 몸은 아래 마른 타격음 그대로)
  if (whipHit) { if (!clay) sound.whip('hit', e, !!(r.helmet || r.plate)); }
  else if (r.helmet) sound.helmet(e);
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
  else if (whipHit) { /* 채찍: 위에서 냈다 */ }
  else if (r.type === 'cut') sound.cut(e, r.pass);
  else if (r.type === 'stab' && opened) sound.stab(e); // 날이 들지 못한 내려찍기 즉사 찌르기(r.finish, 심각도 0)는 막힌 타격 소리
  else sound.blunt(e);
  if (!clay && e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg') && !r.helmet && !r.plate) sound.bone(e);
  // 멈칫: 재질에 따라. 살을 깨끗이 가르면 짧게, 박히거나 뼈·투구에 걸리면 길게 (최대 0.1초 — 조작이 늦게 느껴지지 않게)
  const bone = e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg');
  // 타격감 (10/25 — config IMPACT_FX · src/impact_fx.js): 맞는 순간의 무게(판정 에너지 × 때린 무기 무게 배율) 하나로 멈칫 · 카메라 밀림 · 무게 소리 — 모든 무기 같은 식 · 무거운 칼일수록 크게.
  //  내가 맞음 · 내가 침 둘 다 (카메라는 내가 맞을 때 더 크게). `?impactFx=0` 이면 아래 옛 식 그대로
  //  총알(r.gun)은 무게 배율 없이 판정 에너지만 (총 무게는 맞은 몸에 실리지 않는다)
  const fx = CONFIG.IMPACT_FX.on ? woundImpact({ energy: e, mass: r.gun ? 0 : att.swordProps?.m, pass: !!r.pass, hard: !!(r.stuck || bone || r.helmet || r.plate), taken: vic === player }, CONFIG.IMPACT_FX) : null;
  if (fx) {
    // 무게 소리 한 겹 (기존 타격음 위에 — 빛의 칼 · 고무 닭은 몸통 '쿵'이 어울리지 않아 뺌 · 드루이드의 채찍은 녹음 맞음 소리 그대로)
    if (mat !== 'plasma' && mat !== 'rubber' && !whipHit) sound.heft(fx.sound, fx.x, { metal: !!(r.helmet || r.plate) && !opened });
  }
  const stopT = fx ? fx.stop : r.pass ? Math.min(0.06, e / 2000) : r.stuck || bone || r.helmet || r.plate ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200);
  addHitStop(stopT);
  // 손맛: 칼의 타격 중심(스위트 스팟, 코등이에서 약 58cm)에 맞으면 손이 울리지 않고, 칼끝·칼 밑동에 맞으면 손이 찌릿하다
  //  (손을 축으로 도는 강체에서 한 점을 치면 축(손)이 받는 충격 = 1 − a·b/k²)
  const sting = att.swordSting(r.t);
  // 카메라가 칼이 지나간 방향으로 밀린다 (내가 맞으면 더 크게, 내가 칠 땐 손이 받은 충격만큼 — 옛 식. 타격감 켬이면 무게대로 + 무거울수록 아래로)
  if (fx) impactKick(r.dir, fx.cam, fx.down);
  else kickCamera(r.dir, Math.min(1.6, e / 120) * (vic === player ? 1.4 : 0.4 + 0.4 * sting));
  if (vic === player) haptic(e / 120);
  else if (att === player) haptic((e / 120) * (0.4 + 0.6 * sting));
  if (!vic.alive) slowMo = 1.6;
  arena.excite(vic.alive ? Math.min(0.6, e / 250) : 1); // 떠다니던 먼지가 흩날린다
  sound.gust(vic.alive ? Math.min(0.6, e / 250) : 1); // 산사: 단풍잎 바스락 + 솔바람 + 풍경
}

function onClash(point, speed, touch) {
  if (touch?.fresh && touch.vn > 3 && player?.alive && player.tipVel.length() > 6) playerEv.parried = true; // 감정 사건: 내 베기가 막혔다
  // 흘려 받기(우케나가시 — combat.js nagashi) 한 번 (사장님 10/18 23:4x '흘림을 보이고 들리게. 지친 표시는 X'): 긴 "스르르릉" · 미끄러진 쪽으로 흐르는 불꽃 줄 · 짧은 멈칫.
  //  사람 · AI 누가 흘려도 같다. 보통 부딪힘 연출(아래)은 이 순간 건너뛴다 — 흘림은 '쨍' 대신 미끄러짐으로 읽히게
  if (touch?.nagashi) {
    sound.flow(Math.max(touch.vn ?? 0, 3));
    particles.flowSparks(point, combat?.lastNagashi?.dir);
    addHitStop(0.035);
    clashCooldown = Math.max(clashCooldown, CLASH_GAP);
    haptic(0.5);
    return;
  }
  // 소리: 새로 부딪힌 순간(또는 맞댄 채 다시 세게 친 순간)에만 "쨍". 맞댄 채 미끄러지는 동안은 긁히는 소리(updateBindSound)
  //  touch.vn = 부딪히기 직전 맞닿는 방향 속도(부딪히는 세기), touch.vt = 칼날을 따라 스치는 속도 (combat.js bladeClash)
  if (touch && (touch.fresh || touch.vn > 3)) {
    // 두 무기의 재질이 둘 다 강철이면 칼끼리 "쨍", 아니면 재질에 맞는 소리 (나뭇가지 "딱", 광검 "파직", 고무 닭 "삑", 언 참치 "텅")
    const ma = player?.weapon?.material || 'steel';
    const mb = enemy?.weapon?.material || 'steel';
    if (player?.weapon?.flexible || enemy?.weapon?.flexible) sound.whip('clash', touch.vn); // 드루이드의 채찍이 칼에 감기며 부딪힘 (녹음 — 10/23)
    else if (ma === 'steel' && mb === 'steel') {
      sound.clash(touch.vn, touch.vt);
      // 타격감 (10/25): 쇠 칼끼리면 부딪힌 무게만큼 낮은 '쿵' 한 겹 (맞음보다 순하게 — IMPACT_FX.sound.clash)
      if (CONFIG.IMPACT_FX.on) {
        const cs = clashImpact({ vn: touch.vn, m1: player?.swordProps?.m, m2: enemy?.swordProps?.m, energyScale: CONFIG.STRIKE.energyScale }, CONFIG.IMPACT_FX);
        sound.heft(cs.sound, cs.x, { metal: true });
      }
    } else sound.impact({ a: ma, b: mb, energy: 12 * touch.vn });
  }
  // 연출의 세기는 "부딪히기 직전" 속도로 정한다 (부딪힌 뒤 속도엔 튕겨 나온 몫이 섞여 있다)
  const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
  if (clashCooldown > 0) return;
  if (impact < 2.5) {
    // 세게 부딪히진 않았지만 칼날을 따라 빠르게 긁으면 불꽃만 조금
    if (touch && touch.vt > 5) {
      clashCooldown = CLASH_GAP;
      particles.sparks(point, touch.vt * 0.4);
    }
    return;
  }
  clashCooldown = CONFIG.realS(0.09);
  stats.clashes++;
  particles.sparks(point, impact);
  // 타격감 (10/25 — IMPACT_FX): 부딪힌 무게(두 칼 무게 · 맞닿는 빠르기)로 멈칫 · 카메라 — 맞음과 같은 곡선을 순하게. 문턱(6 m/s) · 간격(0.5 s)은 그대로. 끔이면 옛 식
  const cfx = CONFIG.IMPACT_FX.on ? clashImpact({ vn: impact, m1: player?.swordProps?.m, m2: enemy?.swordProps?.m, energyScale: CONFIG.STRIKE.energyScale }, CONFIG.IMPACT_FX) : null;
  // 세게 부딪힐 때만 잠깐 멈칫 (칼끼리 맞대고 밀 때마다 멈추면 끊겨 보인다)
  if (impact > 6 && clashStopCooldown <= 0) {
    addHitStop(cfx ? cfx.stop : Math.min(0.08, impact / 200));
    clashStopCooldown = CONFIG.realS(0.5);
  }
  const clashDir = new THREE.Vector3((Math.random() - 0.5), 0.3, (Math.random() - 0.5)).normalize();
  if (cfx) impactKick(clashDir, cfx.cam);
  else kickCamera(clashDir, Math.min(0.6, impact / 25));
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
  if (f.flexWeapon) return whipWhoosh(f, st); // 드루이드의 채찍: 합성 바람 고리 대신 녹음 "휙" · "딱" (아래)
  st.loop?.set(f.armed ? f.tipVel.length() : 0);
}
// 드루이드의 채찍 소리 (10/23 사장님 '휘두르고 때릴 때 실제 채찍 소리' — 녹음만, sound.js whip): 끝 빠르기(fighter.tipVel)를 화면마다 보고 "휙" · "딱" 한 번씩.
//  걸쇠 셈 = src/whip_sound.js whipTipStep (10/24 옮김 — 값 그대로 · 노드 도구 · 시험과 같은 셈). 값은 소리 걸쇠일 뿐 판정 · 물리와 무관 (확인표 2259 — 사장님 확인 전)
function whipWhoosh(f, st) {
  st.loop?.set(0);
  for (const [kind, x] of whipTipStep((st.whip ??= {}), f.armed ? f.tipVel.length() : 0)) sound.whip(kind, x);
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
      if (g) particles.drip(g.localToWorld(_wp.copy(w.local)), bloodPalette(f).drip); // 흰 피 몸(광기의 병마용)은 흰 핏방울
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
let state = 'menu'; // menu | fight | paused | draw(무기 카드) | encounter(방랑 전용 상대 알림 창 — 10/24 wanderEncounter)
let roundOver = false;
let roundOverTime = 0;
let resultShown = false; // 판 끝 결과 글자("승리"/"패배")를 띄웠나 — 결정타 슬로모션(slowMo)이 끝난 뒤에 띄운다

$('howto').innerHTML = input.isTouchDevice
  ? '<li>화면을 손가락으로 끌면 칼이 따라 움직입니다. 좌우로 끌면 가로베기, 위아래로 끌면 내려치기입니다.</li><li>왼쪽 아래 조이스틱으로 걷습니다. 화면을 톡 치면 찌릅니다.</li><li>오른쪽 아래 막기를 누르고 있으면 들어오는 칼을 유파 막기 자세로 받습니다. 누른 채 휘두르면 바로 공격합니다.</li><li>칼을 빠르게 휘둘러야 세게 들어갑니다. 머리가 약점입니다.</li>'
  : '<li>화면을 클릭하면 마우스가 잠기고, 마우스로 칼을 휘두릅니다.</li><li>WASD 또는 방향키로 걷습니다. F를 누르고 있으면 들어오는 칼을 유파 막기 자세로 받습니다.</li><li>Esc로 마우스 잠금을 풀고, P로 일시정지합니다.</li><li>칼을 빠르게 휘둘러야 세게 들어갑니다. 머리가 약점입니다.</li>';

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

/** 상대의 한마디: 소개 칸을 다시 써서 이름 + 대사만 잠깐 보여 준다 — 싸움 화면 3.4 s. 지금은 부활 대사만 (승리 대사는 10/18 01:4x 부터 패배 창에만 — showDefeatFoe) */
function showFoeLine(ch, line) {
  if (!line) return;
  const el = $('foeIntro');
  el.querySelector('b').textContent = ch.name;
  el.querySelector('i').textContent = '';
  el.querySelector('span').textContent = `“${line}”`;
  el.querySelector('small').textContent = lineSourceOf(ch, line); // 대사 아래 줄 출처 (병마용의 고전 인용 『사기』·『설원』 — 사장님 10/14 '출처까지 다 나오게 해'. 없는 인물은 빈칸이라 줄이 숨는다)
  el.classList.add('show');
  hudLater('foeIntro', 3.4, () => el.classList.remove('show'));
}

// 패배 창의 상대 (사장님 10/17 22:1x '패배하면 팝업창에 나를 패배시킨 캐릭터가 프로필이 뜨고, 그 오른쪽이든 아래든 적절한 곳에 대사 출력' — docs/design/portrait_ui_2026-10-17.md §4):
//  진 순간 고른 승리 대사(10/18 01:4x 부터 싸움 화면엔 안 띄움 — 패배 창에만)를 들고 있다가 결과 창에서 그 상대의 프로필(portraits.js — 변형은 바탕 인물 그림) 오른쪽에 그대로 · 출처 줄도 같은 꼴.
//  그림이 없는 상대(?foe=default 기본 상대 등)는 그림 칸을 숨기고(대사가 있으면 글만) · 그림을 못 불러오면 그림 칸만 숨긴다 · 이긴 판 · 정지 · 시작 창은 숨김
let defeatFoe = null; // { ch, line } — 이번 판에 나를 쓰러뜨린 상대와 그 대사 (판이 끝날 때 정한다)
$('menuFoeImg').addEventListener('error', () => { $('menuFoe').hidden = true; $('menu').querySelector('.card').classList.remove('foe-shown'); });
/** 진 순간: 그림을 미리 받아 둔다(결과 창은 3.5 s 뒤) — 숨긴 칸이어도 img 는 받는다 */
function loadDefeatFoe(foe) {
  defeatFoe = foe;
  const src = foe ? portraitSrc(foe.ch.id) : null, img = $('menuFoeImg');
  if (src && img.getAttribute('src') !== src) img.src = src;
}
/** 상대 프로필 칸 (패배 창 · 10/24 방랑 전용 상대 알림 창 — 같은 꼴): ch 의 그림(portraits.js)을 건다. 그림이 없거나 전에 못 불러왔으면 칸을 숨긴다. 돌려줌: 칸이 보이나 */
function setFoePortrait(fig, img, ch) {
  const src = ch ? portraitSrc(ch.id) : null;
  const broken = !!src && img.getAttribute('src') === src && img.complete && img.naturalWidth === 0; // 같은 그림을 전에 못 불러왔으면(예: 오프라인에서 예비 low) 칸을 숨긴 채로
  fig.hidden = !src || broken;
  if (src && !broken) {
    fig.dataset.portrait = portraitIdOf(ch.id); fig.dataset.mode = portraitMode(); fig.toggleAttribute('data-grid', portraitGrid()); // ?portraitGrid=1 칸 줄 (10/18 16:3x 확인용)
    img.alt = `${ch.name} 프로필`;
    if (img.getAttribute('src') !== src) img.src = src;
  }
  return !fig.hidden;
}
function showDefeatFoe(foe) {
  const lineEl = $('menuFoeLine');
  const shown = setFoePortrait($('menuFoe'), $('menuFoeImg'), foe?.ch);
  lineEl.hidden = !foe?.line;
  $('menuFoeQuote').textContent = foe?.line ? `“${foe.line}”` : '';
  $('menuFoeSource').textContent = foe?.line ? lineSourceOf(foe.ch, foe.line) || '' : ''; // 병마용의 고전 인용 출처 (없는 인물은 빈칸이라 줄이 숨는다 — showFoeLine 과 같음)
  $('menu').querySelector('.card').classList.toggle('foe-shown', shown);
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
  hudLater('foeIntro', camOpen.mode === 'old' ? ARENA.startHold / CONFIG.TIME.k : CAMERA.open.introSec, /* 글자 시계는 실제 초 — 정지(게임 초)를 실제 초로 (표준 시간 10/25 · 옛 판 k 1 그대로) */ () => el.classList.remove('show')); // 화면 글자 시계(일시정지·메뉴면 멈춘다)
}
function hideFoeIntro() {
  hudLater('foeIntro');
  $('foeIntro').classList.remove('show');
}

// ── 왼쪽 위 (10/14 사장님 '왼쪽 상단에는 스테이지 번호와 스테이지 이름'): docs/ui/hud_intro_2026-10-14.md · hud_type_system_2026-10-10.md §15 ──
//  첫 줄 = '스테이지 N · 무대 이름'(stages.js stageLabel — 순서표 밖 무대는 이름만).
//  무기 카드를 고르는 동안만 그 아래에 카드 안내 '무기 카드를 한 장 고르십시오'(PC '(1 · 2)') — 10/14 03:3x 사장님 '이전처럼 복구'(00:4x 에 뺐던 줄).
//   예전 자리(왼쪽 위 칸의 마지막 줄, 위 6px)·꼴(--fw-label · --ls-label · 강조 색) 그대로, 크기는 칸 전체 작게 --fs-s (10/14 글자 규칙) (index.html #stageInfo em). 카드를 고르면 숨는다 — 자리는 두어
//   화면이 바뀌어 카드 자리를 다시 재도 들썩이지 않는다. 카드 줄은 이 칸 아래에서 시작한다 (layoutDraw)
//  10/14 03:3x 사장님 'AI 이름·기술명 표기는 아예 없앤다': 둘째 줄 'AI 이름 · 자세 / 기술'(foeLine · startFoeLine · paintFoeLine · updateFoeLine · foeTechPut)은 걷어냈다.
//   상대 기술 알림은 화면 어디에도 띄우지 않는다 (판 시작 가운데 소개 #foeIntro 는 그대로)
const stageInfo = $('stageInfo');
const drawGuide = stageInfo.querySelector('em'); // 카드 안내 줄
/** 판을 열 때(startFight): 무대 줄을 쓴다 */
function showStageInfo() {
  // 방랑: '방랑 <판 번호> · <무대 이름>' (스테이지 번호 대신)
  stageInfo.querySelector('.stg').textContent = wanderMode ? `${WANDER_NAME} ${readProgress().wander.run?.round ?? 1} · ${STAGE_NAME_KO[stages.id] ?? stages.id}` : stageLabel(stages.id);
  stageInfo.classList.add('show');
}
/** 카드 안내 줄: 'on' = 고르는 동안 보임 · 'off' = 카드를 고른 뒤 숨김(자리는 둔다) · null = 비움(뽑기가 끝남 — 자리도 없앤다) */
function setDrawGuide(mode) {
  drawGuide.textContent = mode ? (input.isTouchDevice ? '무기 카드를 한 장 고르십시오' : '무기 카드를 한 장 고르십시오 (1 · 2)') : '';
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
const PX_BACKS = { poseidon: '#1d3037', clearing: '#1a1816', castle: '#1e2433', temple: '#1a352b', poseidon_night: '#0c1220', cathedral: '#2b171a', loggia: '#302326', corsair: '#19383e', sacred_grove: '#1c3025', frozen_bay: '#18293a', qinglan: '#16332f', sluice: '#182a22', dayr: '#2a1d1b', dunhuang: '#2d2418', etna: '#1d1b21', courtyard: '#3a1f24' }; // 테마 → 바탕색 (뒤 열은 샛별 저장소의 무대 — 얼어붙은 만·청람잔도는 10/11, 잠든 습지·소금 사막·철불 절벽·화산섬은 10/14, 봉인의 중정은 10/17 우리가 그림, tools/cardbacks/gen_pixel_cardbacks.py)
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
  // 밤 무대(10/16 샛별)는 뒷면 그림이 아직 없어 같은 곳 낮 무대의 뒷면을 빌린다 (밤의 포세이돈은 제 뒷면)
  const dayOf = typeof stageId === 'string' ? stageId.replace(/_night$/, '') : stageId;
  cardBack = BACK_PIN || (stageId in PX_BACKS ? stageId : dayOf in PX_BACKS ? dayOf : 'classic');
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

/** 카드 세 장을 새로 채워 엎어 놓는다: 내 카드 두 장 + 상대 무기 (prepareRound 가 정한 무기). savedCards = 이어하기 지점에 저장된 내 카드 두 장 */
function openDraw(savedCards = null) {
  const foeId = getWeapon(foeWeaponId).id; // 짧은 별칭(chicken 등)도 상대가 실제로 드는 무기 id 로
  Object.assign(draw, { stage: 'choose', t: 0, ids: [...(savedCards || drawCardIds()), foeId], pick: -1, others: false, foe: false, built: false, skip: false });
  saveJourneyRound(null, draw.ids.slice(0, 2)); // 여정이면 이어하기 지점 = 이 무대 · 이 상대 · 이 카드 두 장 (다시 열어도 같은 카드)
  setCardBack(stages.id); // 이번 판 배경의 뒷면
  cardEls.forEach((el, i) => {
    const w = getWeapon(draw.ids[i]);
    el.className = i === FOE_CARD ? 'wcard foe' : 'wcard';
    el.dataset.tier = w.tier || 'common';
    el.classList.toggle('grand', GRAND_WEAPONS.has(w.id));
    el.setAttribute('aria-label', i === FOE_CARD ? '상대 무기 카드 (고를 수 없습니다)' : `${i + 1}번 카드`); // 뒤집히면 무기 이름·등급·설명으로 바뀐다 (revealLabel)
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
  setDrawGuide('off'); // "무기 카드를 한 장 고르십시오"는 고르는 동안만 (예전처럼)
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
  saveJourneyRound(lastPlayerWeapon); // 여정이면 이어하기 지점 = 고른 무기로 이 무대 시작부터
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

/** 카드를 치운다 (다 끝났을 때, 또는 뽑기 도중에 "재대결") */
function closeDraw() {
  draw.stage = null;
  drawEl.className = '';
  setDrawGuide(null);
}

// 판 알림 (가운데 — 판 시작 · 승리 · 패배만). 판 시작 글은 이 상수 하나 (10/10 19:2x 사장님 — Battle 을 한국어로, 게임 분위기에 어울리는 말로).
//  사장님 결정 '대면' (10/10 19:4x — 후보 결투·겨룸·일합·승부·마주섬·대면). 바꾸려면 이 값만
const FIGHT_START_TEXT = '대면';
function showToast(text, ms = 1200) {
  toast.textContent = text;
  toast.classList.add('show');
  hudLater('toast', ms / 1000, ms ? () => toast.classList.remove('show') : null);
}

// 터치 이동 조이스틱: 싸움 중에만 보인다 (무기 뽑기 동안에는 걸을 수 없으니 감춘다 — 카드 자리도 넓어진다)
function applyMoveMode() {
  $('moveStick').classList.toggle('show', input.isTouchDevice && state !== 'menu' && state !== 'draw' && state !== 'encounter');
  $('btnParry').classList.toggle('show', input.isTouchDevice && state !== 'menu' && state !== 'draw' && state !== 'encounter'); // 막기 단추: 조이스틱과 같은 때 (오른쪽 아래)
}

function showHint(text, ms = 3500) {
  hint.textContent = text;
  hint.classList.add('show');
  hudLater('hint', ms / 1000, () => hint.classList.remove('show'));
}

// 방랑 몸 상태 이어받기 (WANDER.resumeState — 사장님 10/30 01:1x '이어하면 그 상황 그대로' · 감독 안 (b) · src/fight_snapshot.js):
//  싸우는 동안 2 초마다 · 대기실로 나갈 때 · 화면을 떠날 때 두 몸의 사본을 진행 중 판(run.resume)에 적고, 같은 대면을 다시 열면 판을 세운 뒤 첫 스텝 전에 입힌다
let resumeSaveT = 0;
const wanderResumeOn = () => wanderSaves() && WANDER.resumeState && !WANDER.quitAsLoss;
function saveWanderBody() {
  if (!wanderResumeOn() || roundOver || !player || !enemy || !currentFoe) return false;
  return saveWanderResume({ v: 1, foe: currentFoe.id, foeWeapon: enemy.weapon?.id ?? null, player: snapshotFighter(player), enemy: snapshotFighter(enemy) });
}
function applyWanderBody(run) {
  const R = run?.resume;
  if (!wanderResumeOn() || !R || R.v !== 1 || R.foe !== currentFoe?.id) return false;
  applyFighterSnapshot(player, R.player);
  if (R.foeWeapon === enemy.weapon?.id) applyFighterSnapshot(enemy, R.enemy);
  return true;
}
async function startFight() {
  if (wanderMode && !openWanderRound()) return; // 방랑: 지금 판의 무대를 짓고 pendingJourney 에 넣는다 (버린 판을 패배로 셈했으면 결과 창 — 판을 열지 않음)
  $('btnStart').hidden = false; // 방랑 진 판 결과 창이 숨긴 단추
  const savedRound = pendingJourney; // 이어하기로 연 판이면 저장된 무대 시작 지점 (launchJourney 가 넣는다 — 한 번만 쓴다)
  pendingJourney = null;
  roundReward = wanderMode && savedRound?.headTaken ? { coins: 0, heads: WANDER_HEAD } : null; // 방랑: 이 판에서 이미 벤 목(다시 연 판)
  roundHorns = 0; // 이번 판 뿔피리 (10/30 상점)
  $('menuReward').hidden = true;
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
  closeDraw(); // 뽑기 도중에 "재대결"을 눌렀으면 그 카드는 치운다
  toast.classList.remove('show');
  nextRoundStage(); // 배경: 첫 판은 메뉴 뒤 그대로, 그 다음 판부터는 정해진 순서로 다음 배경 (짓는 멈칫은 메뉴가 아직 떠 있는 동안)
  planOpening(); // 판 시작 카메라: 이 무대 첫 판이면 무대 훑기, 같은 무대 다시면 내려앉기 — 정지(발 묶임) 길이도 여기서 (카드 고르는 동안 카메라는 그 시작 자리)
  if (savedRound?.foe) {
    // 이어하기: 저장된 상대 · 상대 무기 그대로 (validJourney 가 이 무대의 상대인지 이미 봤다)
    currentFoe = CHARACTERS_BY_ID[savedRound.foe];
    foeWeaponId = savedRound.foeWeapon;
    sound.prepareVoices(['player', voiceOf(currentFoe)]);
  } else prepareRound(); // 이번 상대 · 상대 무기
  hideFoeIntro(); // 가운데 소개는 싸움이 시작될 때 (beginFight) — 카드를 고르는 동안에는 띄우지 않는다
  showStageInfo(); // 왼쪽 위 무대 줄
  techClear(); // 새 판이 열렸다: 오른쪽 위 ② 마지막 기술 · ① 자세 칸을 비운다 (10/14 03:1x·03:3x — 둘 다 시간으로는 사라지지 않는다)
  guardClear();
  const lobbyWeapon = journeyLoadout()?.weapon;
  if (lobbyWeapon) {
    // 대기실에서 장착한 무기 (사장님 10/16 03:5x '장착하면 실제 전투에 가져나가게 해'): 무대마다 카드 없이 그 무기로. 이어하기 지점엔 무대·상대만 —
    //  다음에 해제하고 이어가면 그 무대를 카드부터 (저장된 카드·고른 무기보다 대기실 장착이 먼저)
    lastPlayerWeapon = lobbyWeapon;
    newRound(lobbyWeapon);
    saveJourneyRound(null);
    applyWanderBody(savedRound); // 방랑 몸 상태 이어받기 (WANDER.resumeState — 끄면 아무 일 없음)
    if (wanderEncounter(beginFight)) return; // 방랑 전용 상대면 싸움 전에 알림 창 (10/24 — 확인을 누르면 싸움)
    beginFight();
    return;
  }
  if (savedRound?.weapon) {
    // 이어하기: 무기를 이미 골라 둔 판 — 그 무기로 무대 시작부터 (카드 없이)
    lastPlayerWeapon = savedRound.weapon;
    newRound(savedRound.weapon);
    applyWanderBody(savedRound); // 방랑 몸 상태 이어받기 (WANDER.resumeState — 끄면 아무 일 없음)
    if (wanderEncounter(beginFight)) return; // 방랑 전용 상대 알림 창 (10/24 — 같은 대면에서 이미 봤으면 없음)
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
  const toDraw = () => {
    state = 'draw';
    input.enabled = false;
    applyMoveMode();
    setDrawGuide('on'); // 왼쪽 위 무대 줄 아래 "무기 카드를 한 장 고르십시오" (10/14 03:3x 되살림 — 카드 자리를 재기 전에)
    openDraw(savedRound?.cards);
  };
  if (wanderEncounter(toDraw)) return; // 방랑 전용 상대면 카드 고르기 전에 알림 창 (사장님 10/24 01:1x — 확인을 누르면 카드)
  toDraw();
}

// ── 여정 이어하기 (첫 화면 'Stage 1' · '이어하기' · 대기실 'Stage 입장' — game_entry.js 가 아래 내보낸 함수를 부른다, docs/import/lobby_port_2026-10-16.md §5) ──
//  저장 단위는 무대 시작 자리: 카드를 펼치면 { 무대 · 상대 · 상대 무기 · 내 카드 둘 }, 고르면 { … · 내 무기 }, 이기면 곧바로 { 다음 무대 } (같은 승리를 다시 받지 않게).
//  무대 차례 = STAGE_ORDER (nextStage), 깬 수(통계)는 checkRoundEnd 의 addJourneyClear 만 센다 — 이어하기 지점은 깬 수를 바꾸지 않는다.
function saveJourneyRound(weapon, cards = null) {
  if (wanderSaves()) {
    saveWanderLoadout({ weapon, cards, lastWeapon: lastPlayerWeapon }); // 방랑: 지금 판에 (여정 이어하기 지점은 그대로)
    return;
  }
  if (journeySaves()) writeJourney({ stage: stages.id, foe: currentFoe?.id ?? null, foeWeapon: getWeapon(foeWeaponId).id, weapon, cards, lastWeapon: lastPlayerWeapon });
}
/** 저장된 이어하기 지점을 지금 여정에 맞춘다: 무대가 STAGE_ORDER 에 없으면 없음. 상대가 그 무대의 상대(STAGE_FOE · 후보)가 아니거나
 *  무기가 지금 뽑기 목록(빼 둔 무기 제외)에 없으면 그 무대를 처음부터(상대·카드 새로) — 무대 자리는 지킨다 */
function validJourney() {
  if (!JOURNEY_PURE) return null; // 주소로 무대·상대·무기를 고정한 판에는 이어하기가 없다
  const saved = readJourney();
  if (!saved || !STAGE_ORDER.includes(saved.stage)) return null;
  const pool = new Set(PLAYER_WEAPON_POOL);
  const known = (id) => WEAPON_LIST.some((w) => w.id === id);
  const foes = [STAGE_FOE[saved.stage], ...(STAGE_FOE_EXTRA[saved.stage] ?? [])];
  const out = { stage: saved.stage, foe: null, foeWeapon: null, weapon: null, cards: null, lastWeapon: pool.has(saved.lastWeapon) ? saved.lastWeapon : null };
  if (saved.foe && foes.includes(saved.foe) && CHARACTERS_BY_ID[saved.foe] && known(saved.foeWeapon)) {
    out.foe = saved.foe;
    out.foeWeapon = savedFoeWeapon(CHARACTERS_BY_ID[saved.foe], saved.foeWeapon); // 시트 무기가 바뀐 뒤의 옛 저장이면 지금 시트 무기 (10/25 광기의 하인리히 — characters.js)
    if (saved.weapon && pool.has(saved.weapon)) out.weapon = saved.weapon;
    else if (saved.cards?.every((id) => pool.has(id)) && saved.cards[0] !== saved.cards[1]) out.cards = saved.cards.slice();
  }
  return out;
}
export const canContinueJourney = () => !!validJourney();

// ── 방랑 (10/23 — wander_rules.js · 대기실 '방랑' 단추 → game_entry.js depart('wander') → launchWander) ──
const drawWanderEncounter = () => {
  const e = chooseWanderEncounter(WANDER_STAGES, WANDER_FOES, rand01); // 게임 난수(Math.random — AI 흐름)를 건드리지 않게 crypto 로 (lobby_progress.js rand01)
  return { ...e, foeWeapon: pickCharacterWeapon(CHARACTERS_BY_ID[e.foe]) };
};
/** 저장된 진행 중 판이 지금 목록에 있나 (없으면 lobby_progress.js ensureWanderRun 이 그 대면만 다시 뽑는다 — 리뷰 2-3) */
const validWanderRun = (run) => WANDER_STAGES.includes(run.stage) && WANDER_FOES.includes(run.foe) && WEAPON_LIST.some((w) => w.id === run.foeWeapon);
/** 옛 저장 인정 (한 번 — 대기실 · 여정 출발 때): 방랑이 들어오기 전 저장의 이어하기 지점 · 누적 깬 수 (wander_rules.js legacyWanderStages) */
function migrateLegacyWander() {
  if (JOURNEY_PURE) migrateCampaignStages(readJourney()?.stage ?? null, journeyClears(), STAGE_ORDER);
}
/**
 * 방랑 판을 연다 (startFight 앞): 지금 판(ensureWanderRun — 없거나 끝났으면 새로 뽑음)의 무대를 짓고 pendingJourney 에 넣는다. 돌려줌: 판을 여나
 *  도중에 그만두기 (WANDER.quitAsLoss — 기본 끔, 일반 여정과 같게): 대기실에서 들어오면 저장된 판 그대로(카드 · 고른 무기까지 — 여정 '이어하기'처럼) ·
 *   정지 창 '재대결'이면 같은 대면을 카드부터 다시(여정 '재대결'처럼) · 금화는 판이 끝날 때만 바뀐다.
 *   켬: 싸우던 중 버린 판(새로고침 · 대기실 · 재대결)은 패배로 셈하고 진 판 결과 창을 띄운다(판을 열지 않음)
 */
function openWanderRound() {
  const resume = wanderResume;
  wanderResume = false;
  if (WANDER.quitAsLoss) {
    const lost = settleAbandonedWander();
    if (lost) {
      showWanderForfeit(lost);
      return false;
    }
  } else if (!resume) resetWanderLoadout(); // 재대결 — 진행 중 판이면 카드부터 (끝난 판이면 아무 일 없음 — '다음 방랑'은 새 판)
  const run = ensureWanderRun(drawWanderEncounter, validWanderRun);
  if (!run) throw new Error('방랑이 잠겨 있음');
  run.foeWeapon = savedFoeWeapon(CHARACTERS_BY_ID[run.foe], run.foeWeapon); // 진행 판도 여정과 같게 (10/25)
  // 저장된 내 무기 · 카드가 지금 뽑기 목록에 없으면 카드부터 (여정 validJourney 와 같게)
  const pool = new Set(PLAYER_WEAPON_POOL);
  if (run.weapon && !pool.has(run.weapon)) run.weapon = null;
  if (run.cards && (!run.cards.every((id) => pool.has(id)) || run.cards[0] === run.cards[1])) run.cards = null;
  if (run.lastWeapon && !pool.has(run.lastWeapon)) run.lastWeapon = null;
  pendingJourney = run;
  stageFought = false;
  lastPlayerWeapon = run.lastWeapon;
  if (useStage(run.stage)) stages.warm(renderer, camera);
  sound.setStage(stages.id);
  return true;
}
/** 싸우던 중 버린 방랑 판을 패배로 셈한 결과 창 (WANDER.quitAsLoss 켬 — 정지 창 '재대결'): 진 판 결과 창과 같은 꼴 · '대기실'만 */
function showWanderForfeit(lost) {
  recordDuel(false);
  roundReward = lost;
  roundHorns = 0; // 진 판 — 지난 판 뿔피리가 남지 않게 (10/30)
  pauseOpen = false;
  state = 'paused';
  roundOver = true;
  input.enabled = false;
  input.resetTransient();
  closeDraw();
  toast.classList.remove('show');
  hideFoeIntro();
  clearEmoMsg();
  $('menuTitle').textContent = '패배';
  $('menuSub').textContent = `${WANDER_NAME} ${lost.round} · 싸움을 그만두었다 · ${WANDER_NAME} 종료`;
  showDefeatFoe(null);
  $('btnStart').hidden = true;
  $('btnResume').style.display = 'none';
  const lobbyOk = lobbyMenu();
  $('fpsRow').hidden = lobbyOk;
  $('btnLobby').hidden = !lobbyOk;
  showRewardLine();
  showMenu();
}
/**
 * 대기실 방랑 단추 (lobby.js): 옛 저장 인정(한 번) · 버린 판 셈(WANDER.quitAsLoss 켬) 뒤 지금 상태.
 *  돌려줌 { unlocked, cleared: 깬 무대 수, total: 무대 수, ongoing: 이어 갈 판이 있나('방랑 이어가기'), name, notice: 알림 창을 띄울 때인가, forfeit: 방금 패배로 셈한 판(없으면 null) }
 */
export function getWanderStatus() {
  migrateLegacyWander();
  const forfeit = JOURNEY_PURE && WANDER.quitAsLoss ? settleAbandonedWander() : null;
  if (forfeit) recordDuel(false);
  const w = readProgress().wander;
  return {
    unlocked: JOURNEY_PURE && w.unlocked,
    cleared: STAGE_ORDER.filter((id) => w.cleared.includes(id)).length,
    total: STAGE_ORDER.length,
    ongoing: !!w.run && w.run.status !== 'lost',
    name: WANDER_NAME,
    notice: JOURNEY_PURE && wanderNoticeDue(),
    forfeit,
  };
}
/** 대기실의 '방랑' 단추: 지금 판(없으면 새로 뽑음)부터. 잠겨 있으면 false */
export async function launchWander() {
  if (!getWanderStatus().unlocked) return false;
  journeyMode = false;
  wanderMode = true;
  wanderResume = true;
  pendingJourney = null;
  lastRoundWon = false;
  await startFight();
  return true;
}
// (10/18 04:1x 사장님 '옛 3d 지워': 대기실 3D 캐릭터 몸에 주던 lobbyRigSpec · 겉모습 복제용 getLobbyPlayer 를 지움 — 대기실 ① 칸은 10/17 부터 프로필 그림)
/** 대기실 스킬트리 화면이 읽는 이 판의 갈래: test = 테스트 경로(칸 모두 익힘 · 이미 받은 인장 · 옛 스킬북을 금화로 바꾸지 않음) */
export const getSkillBookContext = () => ({ test: testRoute.active });
/** 대기실 프로필 칸의 인물 (사장님 10/17 22:1x — docs/design/portrait_ui_2026-10-17.md): ?hero=<인물 id> 로 다른 영웅이면 그 인물(그림이 없으면 플레이어) · 아니면 플레이어 */
export const lobbyPortraitId = () => (testRoute.hero && portraitIdOf(testRoute.hero.id)) || 'player';
export const getLobbySettings = () => ({ fpsCap: settings.fpsCap });
export function setLobbyFps(enabled) {
  settings.fpsCap = !!enabled; // 첫 화면 설정 창 — 메뉴의 '화면 60 fps 제한' 줄과 같은 값 · 같은 저장
  saveSettings();
  refreshSettingsUI();
}
/** 대기실의 출발 단추: choice 'new' = 첫 무대(STAGE_ORDER[0])부터 새 카드 · 'continue' = 저장된 무대 시작부터. 깬 수·설정은 그대로 */
export async function launchJourney(choice) {
  const saved = choice === 'continue' ? validJourney() : null;
  if (choice === 'continue' && !saved) return false;
  migrateLegacyWander(); // 옛 저장 인정 (한 번 — 첫 화면에서 곧장 싸움으로 가도)
  wanderMode = false;
  journeyMode = true;
  pendingJourney = saved;
  stageFought = false; // 메뉴 뒤 판처럼 '이 무대 첫 판' — nextRoundStage 가 넘기지 않는다
  lastRoundWon = false;
  lastPlayerWeapon = saved?.lastWeapon || null;
  if (useStage(saved?.stage || STAGE_PIN || nextStage())) stages.warm(renderer, camera);
  sound.setStage(stages.id);
  await startFight();
  return true;
}

/** 무기를 받았다: 싸움 시작 (판 시작 알림, 조이스틱, 조작 안내) */
function beginFight() {
  input.resetTransient();
  state = 'fight';
  input.enabled = true;
  if (wanderSaves() && WANDER.quitAsLoss) markWanderFighting(true); // 도중에 그만두기 켬: 지금부터 판을 버리면 다음에 패배로 셈한다
  emoSeen.player = emoSeen.enemy = null; // 감정 알림은 판마다 새로 (시작 감정도 알린다 — 브론은 분노로 시작한다)
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
  // 방랑 정지 창은 '재개' · '대기실'만 (사장님 10/30 01:1x '방랑과 생사전은 일시정지 후엔 재개랑 대기실로 가기만 할 수 있고 재시작은 못하게 해') — 아래 btnStart('재대결')를 감춘다
  const noRestart = wanderMode;
  // 방랑 · 도중에 그만두기 켬(WANDER.quitAsLoss)이면 싸우는 동안 그만두면 패배라고 알린다
  $('menuSub').textContent = wanderSaves() && WANDER.quitAsLoss && pausedFrom === 'fight' ? '지금 그만두면 이 방랑은 패배로 끝납니다.' : '설정을 바꾸거나 계속할 수 있습니다.';
  $('btnStart').hidden = false; // 방랑 진 판 결과 창이 숨긴 단추
  $('menuReward').hidden = true;
  showDefeatFoe(null); // 패배 창의 상대 프로필 · 대사는 정지 창에 남기지 않는다
  $('btnStart').textContent = '재대결'; // 사장님 10/24 02:4x "스테이지 모드에서 일시 정지 누른 화면에서 '처음부터 다시'를 '재대결'로 고쳐" (여정 · 시험 판 정지 창)
  $('btnStart').hidden = noRestart; // 방랑은 재대결 없음 (10/30 01:1x)
  $('btnStart').classList.remove('wander'); // 방랑 승리 창의 '다음 방랑' 색을 정지 창에 남기지 않는다 (금색 주 단추)
  $('btnResume').style.display = '';
  $('btnLobby').hidden = !lobbyMenu(); // 첫 화면·대기실 여정만 — 판을 떠나 대기실로 (아래 toLobby)
  $('fpsRow').hidden = false;
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

// ── 싸움 → 대기실 (사장님 10/16 08:3x '전투에서 대기실로 가는 기능이 필요해. 정지 누르면 거기에 넣어' · 결과 창 '다음 여정과 대기실 선택지로' — docs/import/ui_fix_2026-10-16.md §3 · §4) ──
//  첫 화면·대기실로 연 여정만 (journeySaves + game_entry.js 가 출발할 때 건 setLobbyReturn) — 테스트 경로 · 주소 판 메뉴는 그대로.
//  판을 떠난다: 금화 · 대면 결과는 안 바뀐다(사장님 08:4x '깎지 마') · 이어하기 지점도 그대로(지금 무대 시작 — 이긴 판이면 이미 다음 무대) · 대기실 동안 게임 소리는 멈춤.
//  대기실이 다시 'Stage 입장'으로 출발하면 launchJourney('continue') 가 그 지점부터 판을 새로 연다
let lobbyReturn = null;
export function setLobbyReturn(fn) {
  lobbyReturn = typeof fn === 'function' ? fn : null;
}
const lobbyMenu = () => careerSaves() && !!lobbyReturn; // 방랑도 같다
function toLobby() {
  if (!lobbyMenu()) return;
  if (pausedFrom === 'fight' && !roundOver) saveWanderBody(); // 방랑 몸 상태 이어받기 (WANDER.resumeState) — 싸우던 몸을 적고 떠난다
  const back = lobbyReturn;
  pauseOpen = false;
  state = 'menu';
  journeyMode = false; // 대기실에서 다시 출발하면 launchJourney 가 켠다
  wanderMode = false; // 방랑도 (launchWander 가 켠다) — 판은 저장에 그대로: 진행 중이면 '방랑 이어가기'로 같은 대면 · 이긴 판이면 다음 대면
  wanderNoticeAfterResult = false; // 결과 창 전에 떠나면 알림 창은 대기실이 띄운다
  input.enabled = false;
  input.resetTransient();
  document.exitPointerLock?.();
  menu.classList.remove('show');
  closeDraw();
  toast.classList.remove('show');
  hint.classList.remove('show');
  clearEmoMsg();
  hideFoeIntro();
  topButtons.classList.remove('show');
  $('rotate').classList.remove('enabled');
  parryHold.btn = null; // 막기를 누른 채 떠나도 다음 판에 막기가 붙어 있지 않게
  parryHold.key = false;
  applyMoveMode();
  sound.ctx?.suspend?.()?.catch?.(() => {}); // 판이 다시 열리면 startFight 의 sound.unlock 이 되살린다
  // 싸우던 판은 그대로 멈춰 둔다(덮개 뒤 — 시간 안 흐름). 대기실은 이 판을 읽지 않는다(① 칸 = 프로필 그림) · 다시 출발하면 startFight 가 판을 새로 연다
  back();
}
$('btnStart').addEventListener('click', startFight);
$('btnLobby').addEventListener('click', toLobby);
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
  if (document.documentElement.hasAttribute('data-start-open')) return; // 첫 화면·대기실이 앞에 있는 동안 게임 키(P·F·1·2)는 쉰다 (game_entry.js)
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
  window.addEventListener(ev, () => sound.ctx && !document.documentElement.hasAttribute('data-start-open') && sound.unlock(), { passive: true }); // 첫 화면·대기실이 앞이면 안 켬 (싸움 → 대기실 동안 소리 멈춤)
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'fight') saveWanderBody(); // 방랑 몸 상태 이어받기 — 앱을 닫거나 새로고침해도 그 몸으로 (WANDER.resumeState)
  if (document.hidden) pause(); // 화면을 떠나면(전화·앱 전환) 멈춘다 — 돌아와서 첫 손가락이 지난 획을 잇지 않게 (10/8)
  if (!document.hidden && sound.ctx && !document.documentElement.hasAttribute('data-start-open')) sound.unlock(); // (손을 대지 않아도 되는 브라우저는 여기서 바로 다시 켜진다)
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
//  상대: "브론 오소리이 공포에 잠식된다" / 주인공: 주어 없이 "공포에 잠식된다" (10/10 문구 정리: 다른 감정 줄과 같은 현재형) (집념은 주어 없이: 상대 "집념을 보인다", 주인공 "집념이 생긴다")
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

/** 결과 창 한 줄: '[금화] 금화 +12 · [천 주머니] 머리 +1 · [뿔피리] 뿔피리 +1' / '[금화] 금화 −3' (첫 화면·대기실 여정 · 방랑만 — 그 밖은 숨김 · 뿔피리는 왕을 이긴 판 — 10/31).
 *  사장님 10/16 14:0x: 늘든 줄든 같은 색(index.html .reward — 강조 색) · 위 부제와 빈 줄 하나 · 대기실 금화 그림. 그림은 글 옆 꾸밈이라 읽는 글에서 뺀다(글 '금화' · '머리'가 이미 있다) */
function showRewardLine() {
  const r = roundReward, el = $('menuReward');
  el.hidden = !r;
  if (!r) return;
  const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
  // 방랑 보너스 (wander_rules.js WANDER_BONUS · WANDER_STREAK · 이름 WANDER_BONUS_LABEL — 사장님 10/24 02:4x '왕의 금고' · '빼앗은 수급' · 03:0x '연승보너스'):
  //  금화 바로 뒤 '(왕의 금고 +200 · 연승 보너스 +5 포함)' · 머리 바로 뒤 '(빼앗은 수급 +10 포함)'. 전: 줄 끝에 '(특별 보상 금화 +200 포함)'.
  //  괄호 앞 한 칸은 index.html .reward .bonus 여백(줄이 flex 라 글의 빈칸은 접힌다)
  const L = WANDER_BONUS_LABEL;
  const parts = { coins: [r.bonus?.coins && `${L.coins} +${r.bonus.coins}`, r.streak && `${L.streak} +${r.streak}`], heads: [r.bonus?.heads && `${L.heads} +${r.bonus.heads}`] };
  const note = (kind) => { const p = parts[kind].filter(Boolean); return p.length ? `<span class="bonus"> (${p.join(' · ')} 포함)</span>` : ''; };
  // 재화마다 한 덩이(.rw — ' · ' · 그림 · 수 · 특별 몫): 줄이 좁으면 덩이째 다음 줄로 (10/31 — 왕의 금고 · 연승 · 빼앗은 수급 · 뿔피리가 한 판에 다 붙으면 한 줄에 안 들어 글자가 세로로 눌렸다)
  const seg = (sep, icon, label, extra = '') => `<span class="rw">${sep ? '<span class="sep"> · </span>' : ''}${icon}<span class="rw-n">${label}</span>${extra}</span>`;
  el.innerHTML = seg(false, COIN_ICON, `금화 ${sign(r.coins)}`, note('coins')) + (r.heads ? seg(true, POUCH_ICON, `머리 +${r.heads}`, note('heads')) : '') + (roundHorns > 0 ? seg(true, HORN_ICON, `${HORN_REWARD_LABEL} +${roundHorns}`) : '');
  for (const icon of el.querySelectorAll('img')) { icon.alt = ''; icon.setAttribute('aria-hidden', 'true'); } // 매끈한 그림(wallet_icons.js — 10/16 15:3x ⑦): 빈 alt = 꾸밈
}

function checkRoundEnd(dt) {
  if (!roundOver) {
    if (!enemy.alive || !player.alive) {
      roundOver = true;
      resultShown = false;
      const win = !enemy.alive;
      if (wanderSaves()) {
        // 방랑 (wander_rules.js): 금화(이기면 +20~50 + 연승 보너스 + 특별 몫 '왕의 금고' · 지면 −10~20 — 10/24 03:0x) · 특별 머리 · 판 결과를 한 번의 저장에 (lobby_progress.js settleWander — 진행 중 판만 한 번)
        const reward = settleWander(win);
        if (reward) {
          recordDuel(win);
          roundReward = reward;
          if (win) roundHorns = kingHorn(); // 왕을 이긴 판의 뿔피리 (10/30 상점 — 셈한 판에서만 한 번)
        }
      } else if (journeySaves()) {
        recordDuel(win); // 대기실 '대면 결과' — 첫 화면에서 연 여정의 판마다 한 번
        // 금화 (사장님 결정 10/16 04:3x · 10/22 01:5x · 10/24 03:0x — 낮 · 밤 같음: 이기면 +10~25 · 지면 −5~10, 0 아래로는 안 내려감, lobby_progress.js journeyCoins)
        roundReward = { heads: roundReward?.heads ?? 0, coins: journeyCoins(win, undefined, { night: /_night$/.test(stages.id ?? '') }).delta };
        if (win) roundHorns = kingHorn(); // 왕을 이긴 판의 뿔피리 (10/30 상점)
      }
      lastRoundWon = win; // 다음 판을 열 때 다음 무대로 넘어갈지 (nextRoundStage)
      // 여정(무대마다 그곳 검객 — 이기면 다음 무대로 넘어간다: nextRoundStage 의 advance)에서 이긴 판 = 무대 하나 깸 → 깬 수 +1 (통계 — journey_save.js).
      //  인장은 없다(사장님 10/16 08:1x '인장 제도 없애' — 얻지도 알리지도 않는다 · 유파 몫은 스킬북)
      if (win && !wanderMode && foeParam === 'stage' && !STAGE_PIN && !testRoute.active) {
        addJourneyClear();
        // 방랑 열기 (10/23): 이긴 무대를 적는다 — 30 무대 모두 처음 깬 판이면 결과 창 위에 방랑 알림 창 (showWanderNotice)
        if (journeySaves() && recordCampaignStage(stages.id, STAGE_ORDER).opened) wanderNoticeAfterResult = true;
        // 이긴 순간 이어하기 지점을 다음 무대로 — 다시 열어 같은 승리를 또 받지 않게 (첫 화면에서 연 여정만)
        if (journeySaves()) writeJourney({ stage: nextStage(stages.id), lastWeapon: player.weapon.id });
      }
      showRoundResult();
      // 상대의 승리 대사 (죽은 쪽은 말이 없다) — 진 순간 골라(randomLine 차례 그대로) 패배 창에만 프로필과 함께 (10/17 22:1x — showDefeatFoe).
      //  싸움 화면 3.4 s 대사는 뺐다 (사장님 10/18 01:4x '싸움 화면쪽은 빼' — 전: showFoeLine). 결과 창이 뜨는 때는 그대로
      const foeWin = !win && currentFoe ? { ch: currentFoe, line: randomLine(currentFoe, 'win') } : null;
      loadDefeatFoe(foeWin);
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
    // 부제 = 이 한 줄뿐 (사장님 10/16 14:4x '패배 후의 팝업창에선 대사 빼버리자') — 10/17 22:1x 패배 창은 새 결정: 나를 쓰러뜨린 상대의 프로필 + 그 오른쪽에 승리 대사(싸움 화면 3.4 s 와 같은 줄 · 출처 줄 같은 꼴)
    //  — showDefeatFoe. 이긴 판은 그대로(부제 한 줄). 금화 줄은 그 위 글과 빈 줄 하나 띄고 (index.html .reward)
    // 방랑: '방랑 <판 번호> · <까닭>' · 지면 ' · 방랑 종료'
    $('menuSub').textContent = wanderMode ? `${WANDER_NAME} ${readProgress().wander.run?.round ?? 1} · ${cause}${win ? '' : ` · ${WANDER_NAME} 종료`}` : cause;
    showDefeatFoe(win ? null : defeatFoe);
    // 여정(무대마다 그곳 검객): 이기면 다음 상대, 지면 같은 상대와 다시 (주소로 상대·배경을 고정했으면 그냥 다시 싸우기)
    $('btnStart').textContent = win && foeParam === 'stage' && !STAGE_PIN ? '다음 여정' : '재대결'; // 사장님 10/24 08:0x '다시 겨루기와 재대결 통일' — 정지 창과 같은 이름 // 사장님 10/14 11:1x '다음 여정. 다시 겨루기.' (전 '다음 상대' · '다시 싸우기')
    // 방랑: 이기면 '다음 방랑'(새로 뽑은 다음 판 — 사장님 10/24 00:3x, 전 '다음 대면') · 지면 그 연속은 끝 — '대기실'만 (다시 들어가면 새 조합)
    //  '다음 방랑' 색 = 대기실 방랑 단추 (index.html .primary.wander — 같은 10/24 말씀). 여정 결과 창 · 정지 창(pause)은 금색 그대로
    if (wanderMode) {
      $('btnStart').textContent = '다음 방랑';
      $('btnStart').hidden = !win;
    }
    $('btnStart').classList.toggle('wander', wanderMode && win);
    $('btnResume').style.display = 'none';
    // 첫 화면·대기실 여정 (사장님 10/16 08:3x '팝업에선 얻은 금화나 잃은 금화 표시하고, 그 화면에서 설정은 빼고, 다음 여정과 대기실 선택지로'): 금화 줄(showRewardLine) ·
    //  '다음 여정'(진 판은 '재대결' — 같은 무대 · 10/24 전 '다시 겨루기') · '대기실'. 설정 줄은 정지 창 · 첫 화면 설정에만. 그 밖 판은 지금 그대로
    const lobbyOk = lobbyMenu();
    $('fpsRow').hidden = lobbyOk;
    $('btnLobby').hidden = !lobbyOk;
    showRewardLine();
    testRoute.resultLabel($('btnStart'));
    reviveFx.reset(); // 결과 화면: 부활 연출이 남아 있으면 치운다 (상대가 일어서는 동안 내가 죽었을 때)
    hideFoeIntro(); // 화면 글자 시계는 게임 시간이라 결과 창 뒤에 남지 않게 여기서 걷는다 (대사는 결과 창이 뜨기 전에 이미 보였다)
    clearEmoMsg();
    showMenu();
    if (wanderNoticeAfterResult) showWanderNotice();
    if (!$('wanderNotice').classList.contains('show')) showTitleNotice(); // 판 끝에 얻은 호칭 (10/24 — 방랑자 · 왕 시해자 · 정복자: title_notice.js) · 방랑 알림 창이 떠 있으면 그 창 다음
  }
}

// ── 방랑 알림 창 (사장님 10/23 18:3x '스테이지 30을 다 깼을 때 알림 팝업을 한 번 띄워 설명해주거나, 이미 깬 유저는 대기실에 진입했을 때 알림 팝업 띄워') ──
//  30 무대를 처음 다 깬 판의 결과 창 위에 한 번(여기) · 이미 깬 사람(옛 저장 인정)은 대기실에 처음 들어올 때 한 번(lobby.js). 본 기록 = 저장 wander.noticeSeen(확인을 누르면)
//  글은 lobby.js 와 같은 WANDER_NOTICE_TEXT (wander_rules.js). 확인을 누르지 않고 닫으면 다음 대기실에서 다시
let wanderNoticeAfterResult = false;
function showWanderNotice() {
  wanderNoticeAfterResult = false;
  if (!wanderNoticeDue()) return; // 결과 창이 뜨기 전에 대기실에서 이미 봤으면
  $('wanderNoticeText').textContent = WANDER_NOTICE_TEXT;
  $('wanderNotice').classList.add('show');
  $('btnWanderNotice').focus({ preventScroll: true });
}
$('btnWanderNotice').addEventListener('click', () => {
  markWanderNotice();
  $('wanderNotice').classList.remove('show');
  showTitleNotice(); // 30 무대를 처음 다 깬 판: 방랑 알림 창 다음 방랑자 호칭 창 (10/24)
});

// ── 방랑 전용 상대 알림 창 (사장님 10/24 01:1x '방랑에서 방랑 전용 캐락터가 등장했을 땐 카드 고르기 전에 알림 팝업 띄우고 낯선 발걸음 소리가 들린다. 이렇게 쓰고 프로필 사진과 대사 출력. 확인 단추는 청동색으로') ──
//  방랑 판의 상대가 방랑 전용(wander_rules.js WANDER_EXCLUSIVE)이면 카드 고르기 전에 한 번(대기실 장착 무기 · 이미 고른 무기로 바로 싸우는 판이면 싸움 전에 — startFight).
//  창 = 패배 창 꼴(index.html #wanderEncounter): 프로필(setFoePortrait — 대기실 · 패배 창과 같은 그림 길) · 장면 글 '낯선 발걸음 소리가 들린다.' · 이름 · 소개 대사 첫 줄(lines.intro[0] — 없으면 taunt) · 확인(방랑 단추 색).
//  대면마다 한 번: 확인을 누르면 저장 run.encounterSeen(lobby_progress.js markWanderEncounter) — 정지 '재대결' · 대기실 → '방랑 이어가기'로 같은 대면을 다시 열면 안 뜬다
//  (확인 전에 앱을 닫으면 다음에 다시). 창이 떠 있는 동안 state 'encounter' — 판 시간 · 정지 · 키 · 조이스틱이 쉰다.
//  startFight 는 창을 기다리지 않고 끝난다(then 을 확인 때 부름) — 대기실에서 연 판은 launchWander 가 끝나야 덮개가 걷혀 창이 보인다
let encounterThen = null;
/** 창이 필요하면 띄우고 true (확인을 누르면 then()) · 아니면 false */
function wanderEncounter(then) {
  const ch = currentFoe;
  if (!wanderMode || !ch || !WANDER_EXCLUSIVE.includes(ch.id) || readProgress().wander.run?.encounterSeen) return false;
  const line = ch.lines?.intro?.[0] ?? ch.taunt ?? '';
  $('wanderEncounter').querySelector('.card').classList.toggle('foe-shown', setFoePortrait($('encounterFoe'), $('encounterFoeImg'), ch));
  $('encounterName').textContent = ch.name;
  $('encounterLine').hidden = !line;
  $('encounterQuote').textContent = line ? `“${line}”` : '';
  $('encounterSource').textContent = line ? lineSourceOf(ch, line) || '' : '';
  state = 'encounter';
  input.enabled = false;
  applyMoveMode();
  $('wanderEncounter').classList.add('show');
  $('btnEncounter').focus({ preventScroll: true });
  encounterThen = then;
  return true;
}
$('encounterFoeImg').addEventListener('error', () => {
  $('encounterFoe').hidden = true;
  $('wanderEncounter').querySelector('.card').classList.remove('foe-shown');
});
$('btnEncounter').addEventListener('click', () => {
  markWanderEncounter();
  $('wanderEncounter').classList.remove('show');
  const next = encounterThen;
  encounterThen = null;
  next?.();
});

// ── 카메라: 내 캐릭터 오른쪽 어깨 너머에서 상대를 바라본다 ──
//  흔들림은 "스프링에 매단 카메라"로 계산한다: 충격이 오면 그 방향으로 밀렸다가 부드럽게 제자리로.
//  (예전처럼 매 프레임 무작위로 떨지 않는다)
const camShake = { o: new THREE.Vector3(), v: new THREE.Vector3() };
function kickCamera(dir, strength) {
  camShake.v.addScaledVector(dir, strength);
}
/**
 * 타격감 카메라 밀림 (10/25 — config IMPACT_FX · onWound · onClash): 방향 dir(단위) 에 아래 몫 down 을 섞어 세기 strength 만큼 스프링을 민다 (같은 스프링 — 발걸음 · 권총 흔들림과 같은 장치).
 *  민 뒤 스프링 속도가 IMPACT_FX.camCap 을 넘으면 그 길이로 줄인다 — 한 칼이 두 부위를 베거나 맞음 · 부딪힘이 겹쳐도 카메라가 한꺼번에 크게 튀지 않게 (폰 멀미)
 */
const _kick = new THREE.Vector3();
function impactKick(dir, strength, down = 0) {
  if (!(strength > 0)) return;
  _kick.copy(dir);
  _kick.y -= down;
  if (_kick.lengthSq() < 1e-8) return;
  camShake.v.addScaledVector(_kick.normalize(), strength);
  const L = camShake.v.length();
  const cap = CONFIG.IMPACT_FX.camCap;
  if (L > cap) camShake.v.multiplyScalar(cap / L);
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
//       'settle' = 같은 무대를 다시('재대결' — 진 판 결과 창 · 정지 창, 10/24 이름 통일): 짧은 내려앉기 settleSec 초 · 'old' = `?openSweep=0` (9/30 판 시작, 정지 2 s)
//  정지(발 묶임 fighter.feetHeld · AI 판 시작 몸짓)는 이 브라우저에서만 판 시작 카메라 길이와 같다: ARENA.startHold 를 판마다 바꾼다(게임 시간 = 실제 초 × 템포).
//   시뮬 도구는 이 파일을 읽지 않아 config 값(SIM_HOLD 2.0)을 그대로 쓴다 — 관문 그대로
const SIM_HOLD = ARENA.startHold;
const camOpen = { mode: 'old', params: null, centre: { x: 0, z: 0 }, swept: null, cue: false, introUp: false, u: null, endPos: new THREE.Vector3(), endLook: new THREE.Vector3() }; // u: 스크린샷용으로 판 시작 자리를 그 u 에 세운다 (game.camOpen.u — null 이면 시계대로) · endPos/endLook: 지금 평소 자리
/** 판을 열 때(startFight · 처음 메뉴 뒤 판): 판 시작 카메라와 정지 길이를 정한다 */
function planOpening() {
  if (!OPEN_SWEEP) {
    camOpen.mode = 'old';
    ARENA.startHold = CONFIG.realS(SIM_HOLD); // 실제 2.0 s (표준 시간 10/25 — 훑기 · 내려앉기와 같이 실제 초 × 템포 · 옛 판 k 1 = 게임 2.0 그대로)
  } else {
    camOpen.mode = stages.id !== camOpen.swept ? 'sweep' : 'settle';
    ARENA.startHold = (camOpen.mode === 'sweep' ? CAMERA.open.sweepSec : CAMERA.open.settleSec) * TEMPO;
  }
  camOpen.params = sweepParams(stages.id);
  camOpen.centre = { x: 0, z: (stageStartZ(stages.id) + stageStartZ(stages.id, 1)) / 2 }; // 두 사람 시작 자리의 가운데 (잠든 습지는 +z 로 비켜 선다)
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
  // 런지 카메라 (10/25 14:0x — SECRET.risoCam · watchSecretFx): 카메라와 바라보는 점을 런지 방향으로 함께 risoCam m — risoCamIn 초에 밀고 risoCamOut 초에 되돌림 (camSwing 과 같은 smoothstep).
  //  최소 거리 뒤에 더한다 (앞에 더하면 minDist 가 밀어 넣은 몫을 거의 다 되돌린다 — 서 있을 때 3.04 → 2.8 m 까지만)
  let push = 0;
  if (camPush.t >= 0) {
    camPush.t += dt;
    const S = CONFIG.SECRET;
    const ti = S.risoCamIn;
    const to = S.risoCamOut;
    if (camPush.t > ti + to) camPush.t = -1;
    else {
      push = S.risoCam * (camPush.t < ti ? THREE.MathUtils.smoothstep(camPush.t, 0, ti) : 1 - THREE.MathUtils.smoothstep(camPush.t, ti, ti + to));
      camTarget.x += camPush.dx * push;
      camTarget.z += camPush.dz * push;
    }
  }
  // 경기장 바깥 돌벽을 뚫고 나가지 않게
  const r = Math.hypot(camTarget.x, camTarget.z);
  if (r > 10.5) camTarget.multiplyScalar(10.5 / r).setY(camH);
  clampStageCamera(a, camTarget, arenaStone?.navigation); // 잠든 습지: 카메라가 석상을 가로지르거나 안으로 들어가지 않게 (석상 없으면 그대로)
  const look = _cl.copy(a).addScaledVector(camDir, CAMERA.lookAhead).setY(1.1 + terrainY);
  if (push) look.set(look.x + camPush.dx * push, look.y, look.z + camPush.dz * push); // 런지 카메라: 바라보는 점도 같이 (밀어 넣기 — 보는 각은 그대로)
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
  if (CONFIG.IMPACT_FX.on) shakeWall(camShake.o, camShake.v, CONFIG.IMPACT_FX.camMaxOff); // 타격감 (10/25): 맞음이 잇달아 와도 밀린 거리는 벽 안 (폰 멀미)
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
  if (playerGuard?.opposition?.run && player.alive) {
    if (guardShown !== 'it-opposition') paintGuard('it-opposition', '막아찌르기', '칼을 받치며 찌르기');
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
  // 이어 긋기 창 (10/21 강화동작 · 명령 — unique_assist.js readyChain): 앞 동작 뒤 이어 그을 수 있는 동안 자세 칸에 그 기술 이름 · '이어 긋기'
  //  겹치기 자동 'bind' (10/31 16:xx 시제품 — UNIQUE_ASSIST.dupAutoHint): 맞댄 채 쌓임이 절반 넘으면 같은 칸에 '겹치기' · '맞물림' (새 그림 없음 · 끔이면 dupCue 없음)
  const uqReady = playerUnique?.ready ?? playerUnique?.dupCue;
  if (uqReady && player.alive) {
    const key = uqReady.sub ? `uq:${uqReady.name}:${uqReady.sub}` : `uq:${uqReady.name}`;
    if (key !== guardShown) paintGuard(key, uqReady.nameKo, uqReady.sub ?? '이어 긋기');
    return;
  }
  // 고노센 발도 대기 (10/31 13:xx 사장님 '1-2번 다 고쳐' — 확인표 3201): 준비된 채 칼이 왼 허리에 있는 동안(허리 대기 · 웅크림 판) '발도 대기' — 칼을 쥐면(손 몫 0) 아래 보통 자세 이름으로 돌아옴
  if (player.alive && iaiReadyShown(player)) {
    if (guardShown !== 'iaiReady') paintGuard('iaiReady', IAI_READY_STANCE.name, IAI_READY_STANCE.desc);
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
  // 고노센 준비 (10/10 02:4x · 10/25 22:3x 부터 거리와 상관없이 이동 입력 · 공격 · 막기 · 맞음 · 비기 없이 iaiArmTime 초 · 준비된 뒤엔 걸어도 유지 — secret.js gnsArmTick): 차면 ② 에 흐린 '고노센 준비' — 준비된 동안 마지막 기술을 덮는다 (다른 상태 알림이 없을 때만)
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
  // 첫 화면·대기실이 앞에 있는 동안(game_entry.js — html[data-start-open])에는 뒤의 3D 그리기·물리 시간을 멈춘다 (화면이 가려져 있다)
  if (document.documentElement.hasAttribute('data-start-open')) { last = now; acc = 0; return; }
  sound.setPaused(state !== 'fight' && state !== 'draw' && state !== 'encounter'); // 샛별 저장소 무대 셋의 배경음·세부음만 메뉴·일시정지 동안 줄인다 (stage_detail_sound.js)
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
    const inScale = hitStop.left > 0 ? 0.25 : 1;
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
    const secSwipe = swipe && !playerSecret?.S?.do?.tapOnly; // tapOnly(이탈리아 안다레 리솔루토 전 판 — `?risoTap=1`)면 찌르기 입력(톡)만 · 10/25 21:0x 사장님 '공격하면 발동' 뒤 기본은 끌기도 비기 (schools.js tapOnly = SECRET.risolutoTap)
    // 이베리아 휘감아 돌기 스틱 판 (10/23 사장님 '공격 버튼 대신 이동 버튼을 360도 돌린다거나' · '반 바퀴 이상으로' — SECRET.ibSpin.input 'stick'): 무장 창은 공격 입력으로 나가지 않고
    //  (무장 동안의 톡 · 끌기는 보통 공격) 이동 스틱을 stickTime 초 안에 stickTurn° 돌리면 같은 길(fire → skill.secret → showPlayerCue)로 낸다. 몸짓 셈 = 실제 프레임 시간 (secret.js spinStick)
    //  10/24 공격 원 판 (사장님 02:5x '공격 동작 360도 원형 입력으로 변경' — 기본 'attackCircle'): 무장 창은 톡 · 끌기 하나로 나가지 않고(원이 아닌 공격은 보통 공격) 공격 손 움직임 d 로
    //  circleTime 초 안에 원 한 바퀴를 그리면 같은 길로 낸다 (secret.js spinCircle · src/attack_circle.js). 손가락이 닿아 있나 = 터치 손가락 · 잠긴 마우스(늘 — 멈춤으로 획을 가름)
    const atkWin = !!playerSecret?.open && !playerSecret.stickOwns() && !playerSecret.circleOwns();
    const stickGo = !!playerSecret?.spinStick(dt, input.move, !secBusy && player.alive);
    const handDown = input.activeTouch !== null || document.pointerLockElement === canvas;
    const circleGo = !!playerSecret?.spinCircle(dt, d, handDown, !secBusy && player.alive);
    // 창 지킴 (10/25 21:0x — SECRET.secretHold): 보통 탭 찌르기 · 손잡이 찍기가 아직 도는 동안은 비기를 못 낸다(skill.secret 이 받지 않음) — 그 입력으로 창을 써 버리지 않고 남겨 둠 (`?secretHold=0` = 전: 창을 쓰고 비기 없음)
    const secArm = !(CONFIG.SECRET.secretHold && (player.skill.tap || player.skill.pom));
    if (((atkWin || gilReady) && (taps > 0 || secSwipe) || stickGo || circleGo) && !secBusy && player.alive && secArm) {
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
    //  둘째 값 = 손이 정말 쥐여 있나(막기가 손을 쥠 · 미리 받기) — 막기 단추를 쥔 채 친 탭은 막기가 놓아 주는 공격(위 G.broken)이라 칼끝 돌려 빼기 탭은 이것만 봄 (10/30 — UNIQUE_ASSIST.cavHeld)
    player.skill.uniq?.feed(d.x, d.y, dt, guardHold || bufHold || !!playerGuard?.held, guardHold || bufHold);
    // 풍차 베기 (이베리아 B4 — 10/29 · unique_assist.js holdTick): 탭 입력을 끌지 않고 길게 누르면 감기 · 떼면 내려침 — 누름 상태를 알린다(비기 창이 열려 있으면 감지 않음 — 싱지르가 먼저).
    //  감는 동안은 손가락 움직임을 손 목표에 더하지 않는다(손은 감기가 쥔다)
    if (player.skill.uniq?.holdE) {
      const hs = input.holdState();
      player.skill.uniq.holdInput(hs.down && !exhausted, hs.still, !!playerSecret?.open);
    }
    const winding = !!player.skill.uniq?.winding;
    // 권총: 자동 조준이라 끌기는 손을 움직이지 않는다 (빠른 끌기가 내딛기·자세 복귀를 부르지 않게)
    if (player.alive && !player.weapon?.gun && !secBusy && !guardHold && !bufHold && !winding) {
      player.handOffset.x += d.x * inScale;
      player.handOffset.y += d.y * inScale;
    }
    // 검술 층의 "자세로 돌아가기"가 알아야 할 것: 손가락이 화면에 닿아 있는지, 지금 움직였는지
    player.handHeld = input.activeTouch !== null;
    player.inputActive = !secBusy && !bufHold && !winding && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    // 칼을 쥐었나 (고노센 허리 대기 — SECRET.gnsReadyHip · secret.js): 손가락은 닿은 자리에서 길게 누름 한도(INPUT.holdPx — 엄지 떠돎)를 넘게 끌었을 때부터 뗄 때까지 · 마우스는 움직임 그대로(inputActive)
    const pr = input.press;
    player.handGrip = pr && !pr.mouse ? pr.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx) : player.inputActive;
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
    if (CONFIG.IMPACT_FX.on) {
      scale = 1 - stopTick(hitStop, dt, CONFIG.IMPACT_FX) * (1 - 0.12); // 멈칫 묶음 시계 (실제 시간 · 화면 안 멈칫 몫만 0.12 배 — 느린 폰에서도 짧게)
    } else if (hitStop.left > 0) {
      hitStop.left -= dt;
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
    secretSfx?.tick(); // 비기 소리 (10/25 — src/secret_sfx.js): 위 화면 늦춤과 같은 수(터뜨림 수)를 사람 · AI 따로 봐, 오른 전투자 유파의 녹음을 한 번 — 이번 화면 물리 스텝 뒤라 그 스텝 끝 실행이 못 걸린 비기는 거른다 (준비 · 창 · 실패 · 다음 칼은 수가 안 오름)
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
      updateCapeSway(f, steps * PHYSICS.timestep); // 긴 망토 흔들림 (10/24 — 겉모습만, 이번 프레임에 흐른 게임 시간 · 가슴 그림 그룹만 읽음)
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
    if (wanderResumeOn() && !roundOver && (resumeSaveT += dt) >= 2) { resumeSaveT = 0; saveWanderBody(); } // 방랑 몸 상태 2 초마다 (새로고침 · 앱 꺼짐 대비 — WANDER.resumeState)
  } else {
    muteWhoosh();
    camSteps = 0;
    // 무기 뽑기: 싸움(물리·AI)은 멈춘 채 카드 순서만 흐른다. 바다·먼지는 그대로 움직인다
    if (state === 'draw') {
      updateDraw(dt);
      arena.update(dt);
    } else if (state === 'encounter') arena.update(dt); // 방랑 전용 상대 알림 창 (10/24): 판은 멈춘 채 바다 · 먼지만
    // 판이 끝나 메뉴가 뜬 뒤에도 흩어지던 칼·투구·판금 조각은 마저 날아 사라진다 (판 끝 슬로모션 0.5배 그대로. 싸움 중 일시정지면 멈춘 채)
    if (roundOver) tickDebris(dt * 0.5);
  }
  updateCamera(dt); // 거르는 프레임에도: 흔들림 스프링·발걸음(player.footstep 소비)·소리 자리(sound.listener)가 여기 달려 있다
  staminaHud.update([player, enemy], camera, state === 'fight' && !roundOver);
  strikeCue.update(dt, camera, state === 'fight' && !roundOver, player, enemy, playerUnique, playerSecret); // 칠 때 알림: 카메라가 정해진 뒤 · 그리기 전
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
  // 타격감 (10/25 — IMPACT_FX): 멈칫(left · spent · quiet — 실제 초) · 카메라 흔들림 스프링(o 밀린 거리 m · v 빠르기) — 브라우저 탐침이 읽는다
  get impactFx() {
    return { ...hitStop, shake: camShake.o.length(), shakeV: camShake.v.length() };
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
  camPush, // 런지 카메라 (10/25 — t 시계 · dx dz 방향 · SECRET.risoCam) — tools/browser/risoluto_fx_shots.mjs 가 읽는다
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
  auraView: AURA_VIEW, // 레전드 기운 보기 손잡이 (on · t · tune — aura.js · tools/browser/legend_glow_measure.mjs 가 켬 · 끔을 견준다)
  renderInfo: () => ({ frame: renderer.info.render.frame, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory, programs: renderer.info.programs?.length }),
  renderCap, // 화면 갱신 상한: game.renderCap.interval = 잰 화면 간격(초). 끄기는 설정 '화면 60 fps 제한' (game.settings.fpsCap)
  screenTint,
  strikeCue, // 칠 때 알림 (style · state) — tools/browser/strike_cue_shots.mjs 가 읽는다
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
