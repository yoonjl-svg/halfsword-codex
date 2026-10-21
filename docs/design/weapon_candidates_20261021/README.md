# 일본 레어·이탈리아 레전드 후보 섬네일

사용자 요청: 발리사르다·갈가노의 외형 묘사를 확인하고 두 후보, 일본 무라마사·가네사다를 섬네일로 제작해 선택한다. 이번은 선택용 이미지이며 무기 등록·게임 스펙 확정·우화 전달 지시가 아니다.

## 제작과 보존

기존 rapier/uchigatana/excalibur 인게임 섬네일과 이전 쿠사나기 생성 시안을 눈으로 확인했다. 투명 배경·정사각형·자루 왼쪽 아래/칼끝 오른쪽 위·면을 나눈 금속·동일 표시 크기를 사용했다. imagegen 원본4개는 generated_images와 이 폴더의 `*-original.png`, 공개 비교 페이지에 바이트 그대로 보존한다. 이미지 편집/크롭/리사이즈 합성은 하지 않았다. 비교 화면은 브라우저의 CSS 배치이며 실제 모델 렌더가 아니다. [프롬프트](prompts.json), [검수·해시](images.json), [비교 페이지](https://yoonjl-svg.github.io/halfsword-codex/encounters/weapon-candidates-20261021/).

- 발리사르다: 은백색 가는 날·옅은 금/은색 덩굴형 스웹트 힐트·상아색 자루. 팔레리나의 정원에서 장식 동기를 가져왔으나 이 장식이 원전에 명시됐다고 하지 않는다.
- 갈가노: 실물의 단순 십자 코등이·둥근 끝장식에서 출발, 가는 찌르기 날·작은 손가락 고리·끝장식 십자 문양·석회 흔적은 창작. 실물의 숨은 날 전체나 원래 가죽을 복원한 것이 아니다.
- 무라마사: 완만한 외날 곡선·짙은 적갈색 감개·검은 코등이·강한 날무늬. 실존 도공 계열과 후대 요도 전설 구별, 실제 저주 기능 없음.
- 가네사다: 무로마치 미노 2대 노사다를 출발점으로 삼는 제안. 회백 감개·투각 원형 코등이·밝은 날. 에도 후기 히지카타의 11대 가네사다 실물 복원으로 혼동하지 않는다.

## 문헌·유물 근거와 한계

1. Ariosto, *Orlando furioso*, Gutenberg 이탈리아어 원문 [3747](https://www.gutenberg.org/ebooks/3747), 영어 Rose 번역 [615](https://www.gutenberg.org/ebooks/615), 2026-10-21 열람. 이탈리아어 전자본문에서 Balisarda 출현 대목과 주변 문맥을 확인했다. XXX.55–59/ XLI.75–84/ XLVI.120은 마법의 갑옷·방패를 베는 능력을 강조한다. **확인한 대목에서는 색·코등이 형태·보석·정확한 치수의 묘사를 찾지 못했다.** 모든 판본·Boiardo 원작 전체에 외형 묘사가 없다는 주장은 아니다. 원전은 베기도 강하게 묘사하며 레이피어 전용이라는 근거는 없다.
2. Antoni Romuald Chodyński, “The 12th century sword of San Galgano in the Hermitage of Montesiepi in Tuscany. A Transmission of the Arthurian Legend?”, *Fasciculi Archaeologiae Historicae* 27 (2014), 21–30. [논문 페이지/초록](https://journals.iaepan.pl/fah/article/view/1469) 열람. 초록은 돌 위로 코등이·끝장식이 드러나 십자 형태를 이룬다고 설명한다. PDF 다운로드는403으로 전문은 읽지 못했다. 따라서 초록·사진 이상의 분류/실측 검증을 주장하지 않는다.
3. [Wikimedia Commons 실물 사진](https://commons.wikimedia.org/wiki/File:San_Galgano_Spada_nella_roccia.JPG)을 실제 열어 둥근 끝장식·단순 십자 코등이를 관찰했다. 박힌 날의 전체 길이/형태는 사진으로 알 수 없다. 참고사진을 배포 게임 에셋으로 복제하지 않았다.
4. [발리사르다 개요](https://it.wikipedia.org/wiki/Balisarda), [가네사다 계보](https://ja.wikipedia.org/wiki/%E5%92%8C%E6%B3%89%E5%AE%88%E5%85%BC%E5%AE%9A). 무라마사 사실/전설은 이전 [검토](../dartagnan_20261021/README.md) 참고. 두 일본 후보의 특정 현존 한 자루·치수·외장 고증은 선택 후 필요하다.

이탈리아 두 후보 모두 이번 그림의 찌르기 검 형상은 게임용 각색이다. 특히 갈가노는 중세 실물이 있어 역사적 형태에서의 차이가 더 뚜렷하다. 레전드라는 등급만으로 새 마법/갑옷 관통 기능을 구현한 것으로 해석하지 않는다.

## 검수와 적용 범위

원본 4개 투명 RGBA, 전체 칼끝·자루 포함, 인물/배경/문자 없음, 동일 대각선 구도 확인. 휴대폰320/390·가로844·큰화면1040에서 로딩/넘침/원본 링크 확인. 공개 경로는 정적 시안 페이지만 추가하며 src/정식 무기 섬네일/유파/물리 변경0. 실제 공개 확인은 release.json에 기록한다.
