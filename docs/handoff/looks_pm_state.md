# 외형 PM 상태 (늘 최신으로 — 디렉터 규칙 ④)

세션 `session_01HNkUuYHag8VSg6xpgbkGVR` · 브랜치 `claude/pm-character-looks` · 갱신 2026-09-30 13:30 KST (참수 겉모습)

## 맡은 일
- 캐릭터 겉모습(`src/outfits.js`·`src/looks.js`), 스테이지 배경(`src/stage_*.js`, `src/stages.js`), 픽셀 카드 뒷면(`tools/cardbacks/`), 겉모습 효과(`src/gun_fx.js` 권총 섬광·연기·궤적·레이저, `src/mad_eyes.js` 광기의 하인리히 안광, `src/sword_trail.js` 칼 잔상 띠).
- 온몸 타격 화면 신호의 모양·색(잔상 띠, 금색·회색 흔적, 맞은 느낌 — 뜻은 디렉터). 갑옷 뚫림 점검·수정. 카메라는 디렉터 코드(의견만).

## 끝남
- 참수 겉모습 (사장님 9/30): src/decap_fx.js 목 단면 원판(몸통·머리) + 1.5초 박동 분출, main.js 세 줄. 전후 docs/handoff/decap_fx_v1.png.
- 칼 잔상 v2 (사장님 9/30 "너무 반짝여 칼보다 돋보인다"): 보통 섞기·칼날 색 × 0.55·불투명도 최대 0.3, 금속·비 trash 칼에만(나뭇가지·고무닭·냉동참치·광선검·리볼버 없음). 전후 docs/handoff/sword_trail_v2_{steel,branch}.png.
- 권총 이펙트 v3 폰 성능 (디렉터 후속, 브랜치에 푸시·병합 대기): 첫 발 셰이더·버퍼 예열 `warmGunFx`(main.js 두 줄: import 에 추가, newRound 에서 권총 있을 때 호출), 총구 점광 → 빛무리 스프라이트. 첫 발 새 프로그램 4 → 0, 성 안뜰 첫 발 프레임 415~570 → 131 ms. 시뮬 3종 main 과 바이트 동일, 스모크 0.
- 권총 발사 이펙트 v2 (사장님 9/29 23:00 "좀 약하다"): 섬광·화염·불티·연기·궤적 강화, 발사 흔들림(main.js installGunFx 에 `shake: (dir, strength) => kickCamera(dir, strength)` 한 줄), 총구 점광 0.1초. 전후 비교 docs/handoff/gun_fx_v2_{night,day}.png. 시뮬 3종 main 과 바이트 동일, 스모크 콘솔 에러 0.
- 칼 잔상 띠 v1: `src/sword_trail.js` + `CONFIG.SWORD_TRAIL` + main.js 네 줄(아래). 사진 `docs/handoff/sword_trail_{cut,cut_zoom,cut_day,rest}.png`.
- 광기의 하인리히 붉은 안광(핏빛·밝기 낮춤·빛꼬리), 권총 효과, 밤의 포세이돈·화전 개간지 스테이지, 판금 밑 속옷, 마르그레테 곁 판, 픽셀 카드 뒷면.

## 열린 요청
- (디렉터 9/29 13:30) src/gun_fx.js 레이저를 디렉터가 급히 고쳐 main 에 올림(2dc9cbc): 빗나가면 선을 상대 가슴 깊이 +0.4 m 에서 끊고 점은 흐리게 그 자리에, 발사 직후·장전 중엔 선·점 흐리게(LASER_A 0.3, 흐린 배율 0.5/0.4). 소유권은 외형 PM. 모양·색·불투명도는 내 판단으로 다듬어도 되나 "빗나가도 상대 깊이에 점"은 유지. 지금 손볼 것 없음 — 사장님 반응 보고.
- (디렉터 R4) `trail.setTone('gold'|'grey')` 호출은 디렉터가 넣는다. `swordTrails.attach([player, enemy])` 가 돌려주는 손잡이 두 개(검객 순)에 `setTone` 이 있다 — main.js 에서 잡아 두려면 `const trailHandles = swordTrails.attach(...)`.
- 브랜치에만 남은 것: 픽셀 카드 앞면 실험 파일(되돌리기 결정, main 에 올리지 않음).

## 칼 잔상 띠 — main.js 줄 (병합 확인용)
```
import { createSwordTrails } from './sword_trail.js';
const swordTrails = createSwordTrails(scene);            // 모듈 상단 (installGunFx 바로 위)
  swordTrails.attach([player, enemy]);                   // newRound, madEyes 줄 다음
      swordTrails.sample(PHYSICS.timestep);              // 물리 루프, combat.afterStep 다음
    swordTrails.update();                                // 프레임, auras update 다음
```

## 재현 명령
- 시뮬 3종(main 과 바이트 동일해야): `node tools/sim/fights12.mjs` · `node tools/sim/hybrid.mjs fights12.mjs` · `node tools/sim/live_battery.mjs` (main 은 별도 worktree 에서 같은 명령, `cmp`).
- 스모크: `npx vite --port 5183 --host 127.0.0.1` 뒤 `node tools/browser/smoke.mjs http://127.0.0.1:5183` (콘솔 에러 0).
- 잔상 사진·비용: 스테이지 `?stage=poseidon_night&foe=heinrich&weapon=longsword` 로 싸움을 열고, `scene` 의 `name==='swordTrail'` 메시 `drawRange.count>0` 인 프레임을 저장. 비용은 `createSwordTrails(new Scene())` 를 따로 만들어 `sample(1/120)` 2만 번: 스텝당 0.002~0.004 ms, `update()` 0.001~0.003 ms (스위프트셰이더 헤드리스 기준).
- 안광: `?stage=poseidon_night&foe=heinrich&madEyes=1`.

## 다음 할 일
- (계획만, 디렉터 2번) 동작 연구 PM 클립의 극단 자세에서 마르그레테 뿔 투구·어깨받이·판금 뚫림 점검: 클립(`docs/motion/clips`, large 벌)이 나오면 (가) 클립의 관절 각을 `f.groups` 에 직접 넣고 물리 없이 그리는 자세 뷰어(`tools/browser/`)를 만들어 — 손 머리 위 +0.15 m, 칼끝 등 뒤 1.4 m, 지나가기(손이 반대 엉덩이 옆) — 세 자세에서 (나) 팔·칼 메시와 투구·어깨받이·판금 메시의 바운딩 상자 겹침을 세고 (다) 겹친 곳을 근접 사진으로 찍는다. 실제 확인은 R2 시험판 뒤.
- (디렉터 Q13 참고, 지금 할 일 없음) 센 베기가 판금·투구에 맞으면 둔기 충격으로 갑옷이 닳아 부서지고, 다 부서진 뒤 벨 수 있다. 부서짐 표현은 지금 두 단계 그대로. R3 에서 닳는 양이 늘면 조각·찌그러짐 표현 요청이 올 수 있다.
