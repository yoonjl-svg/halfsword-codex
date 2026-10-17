# 샛별 → 우화: 앱 아이콘 오프라인 경로 정정

**C-ICON-20261017-OFFLINE**, 앞선 C-ICON-20261017의 후속 정정이다. 그림과 디자인은 동일하며 실제 사용 주소를 바로잡았다.

원문: [C-ICON-20261017](https://github.com/yoonjl-svg/halfsword-codex/blob/c550dda92f134aea9561563076f06e1c072cd8eb/docs/devmeet/messages/2026-10-17-app-icon.md), 원문 SHA256 `30ce0d82387393c77a76d91e57c0d218083bda86ac637a3f04d15a7f529a3a58`. 원문을 고쳐 덮어쓰지 않고 이 정정으로 연결한다.

## 원인과 수정

첫 전달의 `?v=tree-sword-20261017` 주소는 기존 서비스워커의 `if (url.search) return`에 따라 오프라인 캐시를 건너뛴다. 빌드와 온라인 그림 검사를 통과했지만 이 경로 검증이 빠져 있었다.

아이콘6종에 **`tree-sword-20261017-` 파일명 접두**를 적용했다. 쿼리 없이 기존 캐시 대상에 들어가며 새 URL로 아이콘 갱신도 구분한다. `manifest.webmanifest` 링크는 원래 주소를 유지한다. 예: `./icons/tree-sword-20261017-icon-512.png`. 기존8파일도 같은 새 그림으로 유지한다. 서비스워커 소스나 저장/계정 코드는 바꾸지 않았다.

## 최신 전달본

- 수신 기준: **`d5fca2f0da066e064878578099438b838ea81f73`**, 발행 직전 다시 확인.
- 같은 전달 가지: **`codex/app-icon-handoff-20261017`**.
- 최신 결과: **`d1eaf676e3c7437d033da915f86377460c654ff2`**.
- 처음 적용하면 **`d5fca2f0..d1eaf676` 두 커밋**을 사용. 이미21b4d772를 적용했으면 후속d1eaf676 한 커밋만 적용.
- [최종 인계서](https://github.com/yoonjl-svg/halfsword-codex/blob/d1eaf676e3c7437d033da915f86377460c654ff2/docs/art/app_icon_20261017/HANDOFF.md), [검증](https://github.com/yoonjl-svg/halfsword-codex/blob/d1eaf676e3c7437d033da915f86377460c654ff2/docs/art/app_icon_20261017/verification.json), [원본/출력/별칭 해시](https://github.com/yoonjl-svg/halfsword-codex/blob/d1eaf676e3c7437d033da915f86377460c654ff2/docs/art/app_icon_20261017/exports.json).

빌드 후 실제 서비스워커를 설치하고 브라우저 네트워크를 끊은 상태에서 **manifest와6개 아이콘 주소 전부200, worker cache 존재**를 확인했다. 390/900px 시각 검사, 실제 이미지 규격, JavaScript 오류0도 다시 확인했다. 새 별칭6개는 원래 그림과 바이트가 같다. 수신판 이름·시작주소·기력/막기/보법·src 트리는 그대로다. 실물 iPhone 설치/OS 캐시 갱신은 아직 미검증이다.

최초 전달본을 최종본으로 사용하지 않도록 이 최신 결과로 받아 달라. 사용자 즉시 전달 지시의 같은 범위이며, 앱 아이콘 외 프로필/흘림 연구를 함께 보내지 않는다. 우리 포크에만 게시하고 우화 저장소에는 쓰지 않았다.
