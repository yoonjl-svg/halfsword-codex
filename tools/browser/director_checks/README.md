# 옛 디렉터의 확인 스크립트 (2026-09-29 인계 때 스크래치패드에서 옮김)

그때그때 쓴 일회성 확인 스크립트라 다듬지 않았다. 대부분 `node <스크립트> <출력 폴더>`로 돌리고, 포트 5173(main 개발 서버)에 붙는다. 일부 경로(출력 폴더, 기준 파일)는 옛 스크래치패드 절대 경로로 적혀 있어 쓰기 전에 고친다.

- 브라우저: `journey*.mjs`(이기면 다음 무대·지면 같은 상대), `gunfx.mjs`·`pistol.mjs`·`stance.mjs`·`tweak.mjs`(권총 발사·효과·자세), `mad.mjs`·`madfx.mjs`(밤 신전·안광·권총 섬광), `check*.mjs`·`fitdbg.mjs`(카드 글 맞춤), `order.mjs`·`clearing.mjs`·`title.mjs`·`bran.mjs`, `breaksnd.mjs`·`revsnd.mjs`(파손·부활 소리 호출)
- 헤드리스(권총 떨림·흔들림 측정): `tremor_probe.mjs`, `jitter.mjs`, `kick.mjs`, `osc*.mjs`, `bias_probe.mjs`, `arm.mjs`, `aishots.mjs`, `geo.mjs`, `probe.mjs`, `reload.mjs`
