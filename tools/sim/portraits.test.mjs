// 캐릭터 프로필 표 시험 (src/portraits.js — docs/import/portraits_px_2026-10-18.md · 전 판 docs/import/portraits_2026-10-17.md §5)
//  기본(pixel) = 샛별 새 투명 배경 도트판 33 장(얼터 16 명도 자기 그림 · 플레이어 = player2) + 손님 인물 3 장(10/24 샛별 손그림 확정본 — 10/23 임시 그림을 바꿈 ·
//  docs/import/hero_profiles_import_2026-10-24.md) · 예비 hd / low = 10/17 판 17 장(얼터는 바탕 인물 그림)
//  node --test tools/sim/portraits.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { PORTRAIT_IDS, BACKUP_PORTRAIT_IDS, GUEST_PORTRAIT_IDS, TEMP_PORTRAIT_IDS, JULIA_PORTRAIT_IDS, portraitIdOf, portraitSrc, portraitMode, portraitGrid, PORTRAIT_GRID_SRC } = await import('../../src/portraits.js');
const pub = (src) => new URL(`../../public/${src}`, import.meta.url);
const root = (path) => new URL(`../../${path}`, import.meta.url);
const NO_BACKUP = [...GUEST_PORTRAIT_IDS, ...TEMP_PORTRAIT_IDS, ...JULIA_PORTRAIT_IDS]; // 예비 판(hd · low)에 그림이 없는 id — 기본 판 그림을 쓴다

test('기본 판(pixel): 모든 인물 · 얼터가 자기 그림 (사장님 10/18 16:3x — 얼터까지 모두) · 그림 없는 상대는 null', () => {
  const ids = Object.keys(CHARACTERS_BY_ID);
  assert.ok(ids.length >= 32, `${ids.length}`);
  for (const id of ids) assert.equal(portraitIdOf(id), id, id);
  assert.equal(portraitIdOf('player'), 'player');
  for (const none of ['default', 'bear', '', null, undefined]) assert.equal(portraitIdOf(none), null, String(none)); // 기본 상대(?foe=default) · 동물 · 빈 값
});

test('예비 판(hd · low): 얼터는 바탕 인물 그림 (10/18 01:0x 판 그대로) · 손님 인물 셋은 예비 판에 없어 기본 판 그림', () => {
  for (const mode of ['hd', 'low']) {
    for (const id of Object.keys(CHARACTERS_BY_ID)) {
      if (NO_BACKUP.includes(id)) {
        assert.equal(portraitIdOf(id, mode), null, `${mode} ${id}`);
        assert.equal(portraitSrc(id, mode), `ui/portraits/${id}.webp`, `${mode} ${id}`);
      } else assert.equal(portraitIdOf(id, mode), CHARACTERS_BY_ID[id].variantOf || id, `${mode} ${id}`);
    }
  }
});

test('그림 파일: 기본 36 장(768² WebP · 마스터 art/portraits-px-20261018 · 손님 셋은 art/hero-profiles-20261024/<id>/low) · 예비 hd / low 17 장 · 칸 줄 SVG — 주소 ?portrait=hd|low · ?portraitGrid=1', () => {
  assert.equal(PORTRAIT_IDS.length, 38); assert.equal(BACKUP_PORTRAIT_IDS.length, 17);
  assert.deepEqual([...GUEST_PORTRAIT_IDS], ['roland', 'white_scale', 'bernardo']); assert.deepEqual([...TEMP_PORTRAIT_IDS], []); // 10/24 사장님 '모두 적용해' — 임시 그림 없음
  for (const id of PORTRAIT_IDS) {
    assert.ok(fs.existsSync(pub(portraitSrc(id, 'pixel'))), id);
    const master = JULIA_PORTRAIT_IDS.includes(id) ? `julia-profiles-20261030/${id}/low` : GUEST_PORTRAIT_IDS.includes(id) ? `hero-profiles-20261024/${id}/low` : TEMP_PORTRAIT_IDS.includes(id) ? `portraits-temp-20261023/${id}` : `portraits-px-20261018/${id === 'player' ? 'player2' : id}`;
    assert.ok(fs.existsSync(new URL(`../../art/${master}.png`, import.meta.url)), id);
  }
  for (const id of BACKUP_PORTRAIT_IDS) for (const mode of ['hd', 'low']) assert.ok(fs.existsSync(pub(portraitSrc(id, mode))), `${mode} ${id}`);
  assert.ok(fs.existsSync(pub(PORTRAIT_GRID_SRC)));
  assert.equal(portraitSrc('heinrich_mad'), 'ui/portraits/heinrich_mad.webp'); // 주소 없음(노드) = 기본
  assert.equal(portraitSrc('player'), 'ui/portraits/player.webp');
  assert.equal(portraitSrc('heinrich_mad', 'hd'), 'encounters/portraits-hd-20261017/heinrich.webp');
  assert.equal(portraitSrc('artoria_mad', 'low'), 'encounters/portraits-frame1-20261017/low/artoria.png');
  assert.equal(portraitSrc('default'), null);
  assert.deepEqual(['?portrait=low', '?portrait=hd', '?portrait=original', '?x=1', ''].map(portraitMode), ['low', 'hd', 'pixel', 'pixel', 'pixel']);
  assert.deepEqual(['?portraitGrid=1', '?portraitGrid=0', ''].map(portraitGrid), [true, false, false]);
});

test('손님 인물 셋 확정본 (사장님 10/24 "샛별이가 프로필 사진 보냈대. 모두 적용해."): manifest 해시 그대로 · 게임 WebP 768² · 옛 임시 마스터는 기록으로 남음', () => {
  const manifest = JSON.parse(fs.readFileSync(root('art/hero-profiles-20261024/manifest.json'), 'utf8'));
  assert.equal(manifest.source.commit, '0aef88d4a7397dc727641f0d773b8a49d2878533');
  assert.deepEqual(manifest.characters.map((c) => [c.id, c.sourceId]), [['roland', 'sebastian'], ['white_scale', 'white_scale'], ['bernardo', 'black_king']]);
  const sha = (path) => crypto.createHash('sha256').update(fs.readFileSync(root(path))).digest('hex');
  for (const rec of [manifest.frame, manifest.sprites, ...manifest.characters.flatMap((c) => [...Object.values(c.files), c.game])]) assert.equal(sha(rec.path), rec.sha256, rec.path);
  for (const c of manifest.characters) {
    assert.equal(c.game.path, `public/${portraitSrc(c.id)}`, c.id); // 화면이 부르는 파일 = 확정본에서 만든 파일
    const b = fs.readFileSync(root(c.game.path));
    assert.deepEqual([b.toString('ascii', 0, 4), b.toString('ascii', 8, 16), 1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3), !!(b[20] & 0x10)], ['RIFF', 'WEBPVP8X', 768, 768, true], c.id); // 768² · 투명도 있음
    assert.ok(fs.existsSync(root(`art/portraits-temp-20261023/${c.id}.png`)), c.id); // 10/23 임시 그림 마스터는 지우지 않는다
    assert.notEqual(sha(c.files.low.path), sha(`art/portraits-temp-20261023/${c.id}.png`), c.id);
  }
  const eyes = manifest.characters.find((c) => c.id === 'bernardo').eyeCells; // 받은 최종본의 지정 눈끝 두 칸 (중간 시안이 아님)
  assert.deepEqual([eyes.cells, eyes.color], [[[13, 7], [16, 8]], '#4F3829']);
});

test('베르나르도 복식 수정본 (10/24 · 샛별 저장소 100a5971 — docs/import/bernardo_whip_import_2026-10-24.md): 새 옷 그림 · 출처 기록 · 전 판 해시 · 얼굴 칸 그대로 · 롤랑 · 백린 칸 자료 그대로', () => {
  const manifest = JSON.parse(fs.readFileSync(root('art/hero-profiles-20261024/manifest.json'), 'utf8'));
  const spec = JSON.parse(fs.readFileSync(root('art/hero-profiles-20261024/sprites.json'), 'utf8'));
  const b = manifest.characters.find((c) => c.id === 'bernardo');
  assert.deepEqual([b.revision.from, b.revision.commit, b.revision.previous.commit], ['샛별 저장소', '100a5971', '0aef88d4']);
  for (const k of ['original', 'low', 'grid']) assert.notEqual(b.files[k].sha256, b.revision.previous.files[k].sha256, k);
  assert.equal(b.game.sha256, '4c58ad9e84293dd22d117537da36812e10750a3249278b312a0c34137f819f35'); // low.png 에서 우리 도구로 다시 만든 WebP (전달본 WebP 와 같은 바이트)
  assert.equal(b.revision.previous.files.game.sha256, '1584f9d5d9bdc4ec91000f09226ba914fa29a5ac8b8b093ebd1468a4060a66c9');
  // 칸 색 묶음의 해시 앞 16 자 — 처음 받은 판(0aef88d4)의 sprites.json 에서 잰 값과 같아야 한다
  const sha = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
  const bk = spec.characters.black_king, [x0, y0, x1, y1] = bk.review.faceBoxCells, colors = (ys, xs) => ys.flatMap((y) => xs.map((x) => bk.palette[bk.cells[y][x]]));
  const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  assert.equal(sha(colors(span(y0, y1), span(x0, x1))), '58c2ebc06e91aa75'); // 얼굴 칸 (10, 6) ~ (17, 14) 그대로
  assert.equal(sha(colors(span(0, 11), span(0, 21))), '85d89e16cb79a853'); // 위 12 줄(머리 · 얼굴 · 수염) 그대로 — 바뀐 82 칸은 12 ~ 21 줄 옷
  assert.deepEqual([sha(spec.characters.sebastian), sha(spec.characters.white_scale)], ['227ae7cc9f8e22be', '6e614ead0ec5aabb']); // 롤랑 · 백린 그대로
});
