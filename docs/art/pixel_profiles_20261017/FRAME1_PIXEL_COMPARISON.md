# 액자1 적용 2명과 픽셀 밀도 비교

사용자 요청: 기존 초상화 액자를 액자1로 교체하는 샘플2명, 같은 인물의 기본/픽셀2배/4배 비교. 대상은 다라이시·아르토리아. 그림은2열3행, 왼쪽 다라이시/오른쪽 아르토리아, 위에서 기본/2배목표/4배목표.

출력: `public/encounters/pixel-profiles-20261017/frame1-pixels.png`, 검토 페이지 `frame1-pixels.html`. 생성 원본 `/workspace/generated_images/exec-29f2aee5-1afb-4ddb-9870-edd075554ccd.png` 보존. 기존17명 갤러리의 초상화는 사용자 검토 전 유지.

## 비교 한계

이미지 생성 도구로 만든 도트 밀도 시안이다. 단일 원본에 정확한 최근접 보간을 적용한 파일이 아니므로 2배/4배가 모든 픽셀에서 수학적으로 성립한다고 주장하지 않는다. 행마다 얼굴·옷의 미세한 형태가 달라진다. 프레임 자체의 도트 크기는 초상화보다 덜 변했다. 사용자 보고와 공개 페이지에 이 한계를 표시한다. 세 디자인/픽셀 크기 최종 선택으로 해석하지 않는다.

## 실제 생성 프롬프트

Make a controlled pixel-size comparison study by editing these supplied assets, preserving the existing portrait art, NOT inventing new faces or costumes.
INPUT 1 is a three-person portrait sheet: use ONLY its LEFT character Daraishi and its CENTER character Artoria. Omit Liao entirely.
INPUT 2 is a sheet of three empty frames. Use ONLY its LEFT frame, called FRAME 1: the extremely thin antique gold DOUBLE-LINE square border, dark edge, small stepped square corner terminals. Remove all old ornate curling/sword-shaped orange-gold portrait frames completely. Replace them with this exact Frame 1 on every sample; do not use frames 2 or 3.
Output one clean comparison sheet of SIX equal SQUARE portrait cards arranged as TWO COLUMNS and THREE ROWS. LEFT COLUMN always Daraishi, RIGHT COLUMN always Artoria. SAME FACE, SAME POSE, SAME CROP, SAME COSTUME, SAME COLORS, SAME FRAME GEOMETRY in all three rows. It must look like pixel-density variants of the very same source image, never like different paintings. Keep all six complete uncropped frames with even narrow gaps on a dark warm charcoal-brown background.
Daraishi: same long warm ash-silver hair with side braids and single loose forehead strand, composed adult male face, purple high-collar cloak edged in dull gold, ivory tunic with three gold clasps. Artoria: same silver-white hair with three pointed bangs and two long front locks, teal eyes, same adult female face, silver plate armor, teal gem and teal cloak. Preserve their reference expressions and head angles precisely. Plain pale ivory inside the portraits.
Critical experiment: same displayed card size, but increasingly large hard square pixels.
TOP ROW = original fine pixel-art detail, approximately a 256 by 256 logical pixel grid per card, displayed using sharp nearest-neighbor square pixels. Preserve the rich original facial and hair detail.
MIDDLE ROW = every pixel is TWICE as wide and TWICE as tall as top row. Approximately a 128 by 128 logical grid per card displayed at exactly the SAME card dimensions. Obvious 2x square pixel blocks, reduced fine detail, clean stair-stepped edges. Keep all objects at the same positions/sizes.
BOTTOM ROW = every pixel is FOUR TIMES as wide and FOUR TIMES as tall as top row. Approximately a 64 by 64 logical grid per card displayed at exactly the SAME card dimensions. Clearly chunky 4x pixel blocks with simplified eye/hair/armor details, recognizably the same faces and clothing, same crop and frame. Coarsen the entire portrait AND its frame uniformly.
Do not fake pixelation with blur, grain, mosaic textures, smooth shading, or bigger outlines. This is a sharp sample-and-hold / nearest-neighbor raster-size comparison. The bottom row must be visibly MUCH coarser than the middle row, and middle visibly coarser than top. Do not redraw changed expressions or accessories to fill lost details. No lettering, no captions, no numbers in image; captions will be provided separately.

