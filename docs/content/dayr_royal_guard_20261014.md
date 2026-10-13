# 소금길의 역참 · 은발의 왕실 근위검사

기준 `d017a96`. 사용자가 데이르에 가친을 선택하고 모노호시자오, 기억상실, 이란풍 문양을 승인했다. 후속 지시로 **여행자 설정을 철회하고, 이름·출신을 잃었으나 실력을 인정받아 왕실 근위대에 들어간 인물**로 확정했다. 새 이름은 미정(다라·키안 등은 제안만). 장발을 유지하는 새 머리 디테일은 기존 외형과 비교한다.

## 구현과 판정 범위

- `dayr`: 실제 이란 데이르에 가친의 벽돌 아치·안뜰에서 착안한 가상 역참. 깊은 이완 문루, 작은 아치 회랑·낮은 돔, 닳은 벽돌 바닥과 옅은 소금벌판. 오후의 따뜻한 빛. 유적의 규모/지리/배치를 그대로 복제했다는 뜻은 아니다.
- 근위검사는 왕실 호송대를 호위하며 역참에 머문다. 문양은 현재 왕실 소속을 표현하며 잃어버린 출신을 확정하지 않는다. 기본 얼굴·눈·몸 크기는 유지한다. 어깨 팔각 꽃무늬, 깃/손목의 갈라진 잎과 가는 덩굴, 검집 세공. 실제 살라딘의 갑옷 복원으로 주장하지 않는다.
- 기존 모노호시자오 무기/유파/보정 사용. 새 힘·속도 배수나 방어구 수치는 추가하지 않는다. 별도 캐릭터 진입의 무대를 연결하며 기존 일반 여정 순서는 유지한다.
- 마른 바람과 우물 줄의 고리가 흔들림 정점에서 드물게 울린다. 절차 합성음이며 기존 환경음의 profile 순서를 보존해 난수 seed를 바꾸지 않는다.
- 등록 인물·기존 서사 파일 검색에서 명시된 기억상실 캐릭터는 발견하지 못했다. 세르파는 이름/목적을 숨기는 설정이며 기억상실로 기록되어 있지 않다. 이번 작업에서 상대 저장소를 조회하지 않았다.

## 참고

- [Dayr-e Gachin](https://en.wikipedia.org/wiki/Dayr-e_Gachin): 이번에 실제 본문과 명칭 유래 항목을 읽었다. 옛 석고 돔에서 이름이 유래한다는 설명이다.
- [역참 사진](https://commons.wikimedia.org/?curid=72779065): Mostafameraji, CC BY-SA4.0. 사진을 시각 참고했으며 게임 자산으로 복사하지 않았다.
- 소금벌판과 실존 건축을 창작으로 조합했다. 팔각/덩굴은 일반 페르시아풍 장식에서 착안했으며 특정 왕조의 유물 문양을 그대로 전사한 것은 아니다.

## 검사와 재현

무대 생성/해제3회:48,662삼각형·해당 카메라16draw calls, geometry16/material14/texture3 정확히 해제, 유한/동일 정점, 바닥 y0, 근경 통행·문루 시야,120초 중4회 고리 이벤트 일치. 실제 물리 검증과 휴대폰 실기 FPS를 대신하지 않는다.

문양 추가는 기존 v4 대비1,792삼각형·7mesh 증가이며 신체/물리 snapshot과 머리 형상 동일. 이전 v2/v3 유지. 새 머리(v5)는 낮은 반묶음/한쪽 가는 땋음이며 기존 v4 비교를 보존했다. 머리 장식 기준+3,180삼각형·4mesh, 물리/얼굴 동일성 통과. 최종 공개 판정은 영수증에 기록한다.

```sh
npm run dev -- --host 127.0.0.1 --port 4320
node tools/browser/dayr_scene_20261014.mjs http://127.0.0.1:4320/ /tmp/halfsword-dayr-scene-20261014
node tools/browser/dayr_audio_20261014.mjs /tmp/halfsword-dayr-20261014/audio-master.json
node tools/browser/dayr_capture_20261014.mjs /tmp/halfsword-dayr-20261014/game-shots-clean
CAPTURE_IDS=silver_wanderer CAPTURE_VIEWS=front,threeq,back,detail,fittings CAPTURE_BASE=http://127.0.0.1:4320 CAPTURE_OUT=/tmp/halfsword-dayr-20261014/portraits-final node tools/browser/native_character_portrait.mjs
npm run build -- --outDir /tmp/halfsword-dayr-20261014/build
```

기존 `new_pair_delivery_20261010.mjs --encounter=silver_wanderer`를 최종 frozen build의 로컬/공개에 각각 실행한다. 모든 응답은 같은 빌드와 해시로 대조한다. 첫 카드 진입·실제 손/이동 입력·일시정지/재개·재시작을 확인한다. 음향은 실제 master render와 mute/pause/전환 제어를 검사한다. 사람의 청음·미적 수락, 모든 부상 자세의 머리/옷 관통, 실기 FPS는 미검증이다.

최종 상태·공개 커밋·검증 결과: [전달 영수증](dayr_royal_guard_release.json). 검사 이미지의 높은 카메라와 실제 전투 시점을 구분한다. 원자료 `/tmp/halfsword-dayr-20261014`와 `/tmp/halfsword-dayr-scene-20261014`.
