# 얼터 프로필 16명 제작 완료

사용자가 기존 디자인 에이전트에게 얼터 프로필 제작을 요청했다. **고화질 원본만, low 제외**. 기존 `/root/portrait_references`에게 후속 작업을 전달했고 제작을 시작했다. **16명 고화질 원본 제작과 검증을 완료했다.** 배포는 별도 publication.json 결과를 따르며 우화 전달은 하지 않았다.

- 전체16명. 실제 플레이어 얼터 정의는 없음. 인물ID는 현행 `CHARACTER_VARIANTS`의 `*_mad`를 사용한다.
- 기존 기본 초상 화풍·액자1·정사각형, 고화질 원본과 생성 출처 보존. 기본17명·low·액자3안 파일을 변경하지 않는다. 제작 전37파일 SHA256은 `/tmp/alter-profiles-base-preservation.json`에 고정했다.
- 최신 수신 기반 `c8ca9c34`와 기존 외형 기준 `15e18adf`의 characters/looks/outfit/mad_eyes는 일치함을 에이전트가 확인했다. 실제 얼터 렌더와 승인 기본 초상을 함께 참조한다. 얼터 병마용은 창백한 사람+얇은 흰 망토이며 기본 토우 얼굴 규칙과 다르다.
- 제작 담당: imagegen 원본·16명 이미지·provenance·profiles.json. 작업원본 `/workspace/portrait-alter-originals-frame1-20261017/`. 배포 준비 `public/encounters/pixel-profiles-alter-frame1-20261017/{id}/original.png`. 상세 자료 `docs/art/pixel_profiles_alter_frame1_20261017/`.
- 부모 담당: 기본/얼터 원본 비교 갤러리 `index.html` 준비. 완성 후 전원 외형/액자/정사각·해시·기본보존·모바일 검토, 필요 수정 후 결과 보고. **갤러리 준비와 원본 완성을 구별한다.**
- 예상20~30분은 디자인 에이전트의 시작 시점 추정이다. 제작 중에는 이베리아 연구/논의를 병행할 수 있다. 원격발행·우화전달·게임UI연결은 아직 하지 않았다.

## 완료 검증

- 모든16명 1254×1254 PNG. image_gen에서 액자1 포함 정사각형으로 개별 생성, 후처리는 바이트 복사뿐이다. 크롭/리사이즈/픽셀화 없음. low0.
- 최초 생성·참조 이미지·실제 프롬프트·원본해시·마야 문서주머니 교정 전후 모두 보존. [제작기록](../art/pixel_profiles_alter_frame1_20261017/README.md), [출처](../art/pixel_profiles_alter_frame1_20261017/provenance.json), [자산검증](../art/pixel_profiles_alter_frame1_20261017/verification.json).
- 부모가16파일 해시·정사각·기본37파일 보존을 별도로 확인했다. 실제 전체 갤러리와 아르토리아 기본/얼터 비교를 확인했다. 마야는 허리주머니를 보이는 구도로 다른 인물보다 얼굴이 작게 보이며 검토 시안의 특성으로 기록한다.
- 320/390/844/1200px에서 원본16개·기본비교·이전/다음 순환·Escape/포커스 복귀·가로 넘침 없음·오류0. [브라우저검증](../art/pixel_profiles_alter_frame1_20261017/gallery-verification.json).
- [전체 실제 검토페이지 캡처](../art/pixel_profiles_alter_frame1_20261017/gallery-desktop.png), [휴대폰](../art/pixel_profiles_alter_frame1_20261017/gallery-mobile.png), [아르토리아비교](../art/pixel_profiles_alter_frame1_20261017/artoria-comparison.png).
- 게임src/계정/물리/기존 프로필 UI는 변경하지 않았다. 공개 검토 페이지 배포는 기존 우리 포크 정적 경로에만 수행한다.
