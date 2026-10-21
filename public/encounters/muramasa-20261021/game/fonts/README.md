# 화면 글꼴 — 프리텐다드 + Cinzel

사장님 10/14 10:4x 결정 — 아침 웹폰트 비교의 **3안 '단정'**: 한글·숫자·기호 **프리텐다드(Pretendard)** + 라틴 글자 **Cinzel**. 쓰는 법·크기·까닭은 `docs/ui/webfont_2026-10-14.md` (앞선 1안 '도트' — 갈무리11 + Jacquard 12 — 는 `docs/ui/pixel_font_2026-10-14.md`, 이번에 걷어냈다).
오프라인 앱(PWA)이라 바깥 글꼴 서버(CDN)를 부르지 않고 이 폴더의 파일을 직접 싣는다. **파일은 받은 그대로**다(우리가 글자를 덜어 내거나 이름을 바꾸지 않았다). 바이트·해시는 `provenance.json`.

| 파일 | 글꼴 | 받은 곳 | 바이트 | SHA-256 |
|---|---|---|---|---|
| `Pretendard-Regular.subset.woff2` | Pretendard Regular 400 (판 1.309) — KS X 1001 서브셋(한글 2,780 · 라틴 · 기호 = 3,728 자) | npm `pretendard@1.3.9` `dist/web/static/woff2-subset/` — https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff2-subset/Pretendard-Regular.subset.woff2 | 267 096 | `01dd73155fdfab7ce9b25224523e85a96927e21aef97f21957d41f1bfa7e3878` |
| `Pretendard-SemiBold.subset.woff2` | Pretendard SemiBold 600 (판 1.309) — 같은 서브셋 | 같은 꾸러미 `…/Pretendard-SemiBold.subset.woff2` | 268 752 | `4247dc5e260b92640c2cbd0e75091154647b71e1d5884116655e2903468c54cc` |
| `Pretendard-Bold.subset.woff2` | Pretendard Bold 700 (판 1.309) — 같은 서브셋 | 같은 꾸러미 `…/Pretendard-Bold.subset.woff2` | 270 784 | `78eb71c33101ee7d4f8d1b777d193a12d00f8a296e712a8c417cf27abe946397` |
| `Cinzel-latin.woff2` | Cinzel (판 2.000, 굵기 축 400–900 한 파일) — 구글 폰트의 라틴 조각 | https://fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt79mT7.woff2 | 25 904 | `09941fb1c169c38fd414536b37690057fc01b3117a5c63dd6571186540c8f370` |
| `Cinzel-latin-ext.woff2` | 같음 — 라틴 확장 조각 | https://fonts.gstatic.com/s/cinzel/v26/8vIJ7ww63mVu7gt7-GT7LEc.woff2 | 14 540 | `8fc2606f8ae6c569f444e138dba052d9a6e3f0657f9031796503bbb94eced600` |
| `NotoSansTC-hanja.woff2` | Noto Sans TC Regular (판 2.004) — **프리텐다드에 없는 글자 보충**: 중국 유파 원어의 한자 43 자 + 로마 숫자 Ⅰ·Ⅱ (45 자 — 글자표는 빈칸 하나 더해 46) | 구글 폰트가 그 글자만 담아 준 파일(`text=`) — 아래 '다시 받기' | 9 384 | `0ada276de9deb429b168656049c4ea1f3a93b104066680b443005b94e6305323` |
| `NotoSansMath-symbols.woff2` | Noto Sans Math Regular (판 3.000) — 보충: ▮ ▯(독일 감아 들기 칸) · ↻(돌려 달라는 안내) | 같은 방법 | 3 000 | `c6a6a3f26cb0697cee967f12c12939cbc581c776ce49f6dedb1408391d1425cd` |

- 받은 때: 2026-10-14 01:41–01:51 UTC (한국 시간 10:41–10:51). 받은 뒤 `file` 로 WOFF2 임을 확인했다. 프리텐다드 세 파일과 라이선스의 해시는 jsDelivr 꾸러미 목록(`data.jsdelivr.com/v1/packages/npm/pretendard@1.3.9`)이 적은 해시와 같다.
- **프리텐다드**: 만든 이 길형진(Kil Hyung-jin) · Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard), **with Reserved Font Name Pretendard** · **SIL Open Font License 1.1** — 원문 `Pretendard-OFL.txt`(꾸러미의 `dist/LICENSE.txt` 그대로). 예약 글꼴 이름이 있어 **우리가 고친 판(덜어 낸 서브셋 등)에는 'Pretendard' 이름을 쓸 수 없다** — 그래서 만든 이가 꾸러미에 함께 낸 서브셋을 그대로 싣는다(게임 글만 뽑은 서브셋을 만들지 않은 까닭).
- **Cinzel**: 만든 이 Natanael Gama · Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel) · **SIL Open Font License 1.1** — 원문 `Cinzel-OFL.txt`(구글 폰트 저장소 `ofl/cinzel/OFL.txt` 그대로). 예약 글꼴 이름 없음.
- **Noto Sans TC · Noto Sans Math** (보충): Noto Sans TC = (c) 2014-2021 Adobe, with Reserved Font Name 'Source' · Noto Sans Math = Copyright 2022 The Noto Project Authors (https://github.com/notofonts/math) — 둘 다 **SIL Open Font License 1.1**, 원문 `NotoSansTC-OFL.txt` · `NotoSansMath-OFL.txt`(구글 폰트 저장소 `ofl/notosanstc/OFL.txt` · `ofl/notosansmath/OFL.txt` 그대로). 파일은 구글 폰트가 만들어 내준 그대로이고 이름에 예약 이름('Source')이 없다.
- OFL 은 글꼴만 따로 파는 것을 빼고 쓰기·싣기·다시 나누기를 허락한다 — 다시 나눌 때 저작권 줄과 라이선스 원문을 함께 둔다(이 폴더).
- **다시 받기(보충 두 파일)**: 화면 글에 새 한자·기호가 들어와 `node tools/text/font_glyphs.mjs` 가 '우리 글꼴에 없는 글자'를 적으면, 빠진 글자를 더해 아래 주소의 CSS 를 받고(크롬 사용자 에이전트) 그 안의 `fonts.gstatic.com/l/font?kit=…` 파일을 받아 갈아 끼운 뒤 `index.html` 의 `unicode-range` 와 이 표·`provenance.json` 을 고친다.
  `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400&text=<글자들>` · `https://fonts.googleapis.com/css2?family=Noto+Sans+Math&text=<글자들>`
- 원작자들이 이 게임을 보증하지 않는다.
