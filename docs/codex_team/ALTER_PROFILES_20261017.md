# 얼터 프로필 제작 위임 — 진행 중

사용자가 기존 디자인 에이전트에게 얼터 프로필 제작을 요청했다. **고화질 원본만, low 제외**. 기존 `/root/portrait_references`에게 후속 작업을 전달했고 제작을 시작했다. 현재 완성/배포/우화 전달로 기록하지 않는다.

- 전체16명. 실제 플레이어 얼터 정의는 없음. 인물ID는 현행 `CHARACTER_VARIANTS`의 `*_mad`를 사용한다.
- 기존 기본 초상 화풍·액자1·정사각형, 고화질 원본과 생성 출처 보존. 기본17명·low·액자3안 파일을 변경하지 않는다. 제작 전37파일 SHA256은 `/tmp/alter-profiles-base-preservation.json`에 고정했다.
- 최신 수신 기반 `c8ca9c34`와 기존 외형 기준 `15e18adf`의 characters/looks/outfit/mad_eyes는 일치함을 에이전트가 확인했다. 실제 얼터 렌더와 승인 기본 초상을 함께 참조한다. 얼터 병마용은 창백한 사람+얇은 흰 망토이며 기본 토우 얼굴 규칙과 다르다.
- 제작 담당: imagegen 원본·16명 이미지·provenance·profiles.json. 작업원본 `/workspace/portrait-alter-originals-frame1-20261017/`. 배포 준비 `public/encounters/pixel-profiles-alter-frame1-20261017/{id}/original.png`. 상세 자료 `docs/art/pixel_profiles_alter_frame1_20261017/`.
- 부모 담당: 기본/얼터 원본 비교 갤러리 `index.html` 준비. 완성 후 전원 외형/액자/정사각·해시·기본보존·모바일 검토, 필요 수정 후 결과 보고. **갤러리 준비와 원본 완성을 구별한다.**
- 예상20~30분은 디자인 에이전트의 시작 시점 추정이다. 제작 중에는 이베리아 연구/논의를 병행할 수 있다. 원격발행·우화전달·게임UI연결은 아직 하지 않았다.
