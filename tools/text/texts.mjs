// 게임 화면 글자 모으기 (표기 방침 검사기 name_policy.mjs · 일괄 시트 extract_texts.mjs 가 같이 쓴다)
//  ① 모듈 import — 유파(schools.js TRADITIONS·FEINTS)·자세표(guards.js·frames.js)·무기(weapons.js)·사격 자세(gun.js)·인물(characters.js)
//  ② 글자 그대로 읽기 — main.js 와 화면 글을 내는 모듈(emotions.js 등)의 문자열 리터럴, index.html 의 글·속성
//  한 줄 = { cat 분류, school 유파 열쇠(german·italian·iberian·japanese·chinese·none·'' 공용), loc 위치(파일·열쇠), text 현재 표기, note 비고 }
//  출처 칸(src)·주석·문서는 모으지 않는다 (옛 표기는 기록이라 그대로 둔다)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

// ── 글자 종류 ──
export const HAN = /[㐀-䶿一-鿿豈-﫿]/u; // 한자 (CJK 통합·확장 A·호환)
export const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u; // 히라가나·가타카나
export const HANGUL = /[가-힣]/u;
const HAN_G = /[㐀-䶿一-鿿豈-﫿]/gu;

/**
 * JS 소스의 문자열 리터럴 (주석·정규식 건너뜀). 템플릿 리터럴은 ${…} 자리를 '…' 로 바꾼 글 하나로.
 *  돌려줌: [{ text, line, raw }] — raw 는 따옴표 안 원문(이스케이프 그대로)
 */
export function jsStrings(src) {
  const out = [];
  let i = 0;
  let line = 1;
  let prev = ''; // 마지막 의미 있는 글자 (정규식/나눗셈 가르기)
  const n = src.length;
  const unescape = (s) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/gs, (m, e) => {
    if (e[0] === 'u' && e[1] === '{') return String.fromCodePoint(parseInt(e.slice(2, -1), 16));
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '', '0': '\0' }[e] ?? e;
  });
  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      const end = e < 0 ? n : e + 2;
      for (let k = i; k < end; k++) if (src[k] === '\n') line++;
      i = end;
      continue;
    }
    if (c === "'" || c === '"') {
      const start = line;
      let j = i + 1;
      let raw = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          raw += src[j] + src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '\n') break; // 닫히지 않은 따옴표 — 버린다
        raw += src[j++];
      }
      out.push({ text: unescape(raw), line: start, raw });
      i = j + 1;
      prev = 'a';
      continue;
    }
    if (c === '`') {
      const start = line;
      let j = i + 1;
      let raw = '';
      let text = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') {
          raw += src[j] + src[j + 1];
          text += unescape(src[j] + src[j + 1]);
          j += 2;
          continue;
        }
        if (src[j] === '$' && src[j + 1] === '{') {
          // ${ … } — 안쪽의 중괄호·문자열을 건너뛴다 (안쪽 문자열도 따로 모은다)
          let depth = 1;
          let k = j + 2;
          const inner0 = k;
          while (k < n && depth) {
            const d = src[k];
            if (d === '{') depth++;
            else if (d === '}') depth--;
            else if (d === "'" || d === '"' || d === '`') {
              const q = d;
              k++;
              while (k < n && src[k] !== q) {
                if (src[k] === '\\') k++;
                k++;
              }
            }
            if (depth) k++;
          }
          for (const s of jsStrings(src.slice(inner0, k))) out.push({ ...s, line: start + s.line - 1 });
          raw += src.slice(j, k + 1);
          text += '…';
          j = k + 1;
          continue;
        }
        if (src[j] === '\n') line++;
        raw += src[j];
        text += src[j];
        j++;
      }
      out.push({ text, line: start, raw, template: true });
      i = j + 1;
      prev = 'a';
      continue;
    }
    if (c === '/') {
      // 정규식: 앞 글자가 값이 아니면 (연산자·여는 괄호·줄 처음·키워드 뒤)
      const isRe = !prev || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || /\b(return|typeof|case|in|of)$/.test(src.slice(Math.max(0, i - 7), i).trimEnd());
      if (isRe) {
        let j = i + 1;
        let cls = false;
        while (j < n && src[j] !== '\n') {
          if (src[j] === '\\') {
            j += 2;
            continue;
          }
          if (src[j] === '[') cls = true;
          else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) break;
          j++;
        }
        i = j + 1;
        while (i < n && /[a-z]/i.test(src[i])) i++;
        prev = 'a';
        continue;
      }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

/** HTML 의 화면 글 (주석·<style>·<script> 밖의 글 마디 + aria-label·title·placeholder·alt 속성) */
export function htmlTexts(src) {
  const out = [];
  const lineAt = (idx) => src.slice(0, idx).split('\n').length;
  const body = src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' ')).replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, (m) => m.replace(/[^\n]/g, ' '));
  const tagRe = /<[^>]+>/g;
  let last = 0;
  let m;
  const pushText = (s, idx) => {
    const t = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    if (t) out.push({ text: t, line: lineAt(idx), kind: 'text' });
  };
  while ((m = tagRe.exec(body))) {
    pushText(body.slice(last, m.index), last + (body.slice(last, m.index).length - body.slice(last, m.index).trimStart().length));
    const id = /\bid="([^"]+)"/.exec(m[0])?.[1];
    for (const a of m[0].matchAll(/\b(aria-label|title|placeholder|alt)="([^"]*)"/g)) out.push({ text: a[2], line: lineAt(m.index), kind: `@${a[1]}`, id });
    last = m.index + m[0].length;
  }
  pushText(body.slice(last), last);
  return out;
}

// ── 판정 ──
/**
 * 중국 꼴: 한자는 모두 괄호 안에만. 새 꼴(10/19) '뜻 (漢字 독음)' — 괄호 안 한자 뒤에 그 한글 독음 · 옛 꼴 '독음 (漢字)' — 괄호 바로 앞(빈칸 하나 허용) 낱말이 독음. 둘 다 음절 수가 한자 수와 같아야 한다.
 *  괄호 안에 허용하는 것: 한자·'→'·'·'·빈칸. 돌려줌: null(맞음) 또는 까닭
 */
export function chineseFormProblem(s) {
  if (!HAN.test(s)) return null;
  const groups = [...s.matchAll(/\(([^()]*)\)/g)];
  let covered = 0;
  for (const g of groups) {
    const inner = g[1];
    if (!HAN.test(inner)) continue;
    // 10/19 글 방침 2판 (docs/text/text_style_v2_2026-10-19.md): '뜻 (漢字 독음)' — 괄호 안에 한자 뒤 빈칸 하나, 한국 한자음 (음절 수 = 한자 수)
    const nu = /^(\S+) ([가-힣→·]+)$/u.exec(inner);
    if (nu && HAN.test(nu[1]) && nu[1].replace(HAN_G, '').replace(/[→·]/g, '') === '') {
      const hanN = nu[1].match(HAN_G).length;
      const sylN = nu[2].replace(/[→·]/g, '').length;
      if (sylN !== hanN) return `독음 '${nu[2]}' 의 음절 수(${sylN})와 한자 수(${hanN})가 다르다: (${inner})`;
      covered += hanN;
      continue;
    }
    if (/[^㐀-䶿一-鿿豈-﫿→·\s]/u.test(inner)) return `괄호 안에 한자 말고 다른 글자: (${inner})`;
    const hanCount = inner.match(HAN_G).length;
    covered += hanCount;
    const before = s.slice(0, g.index).replace(/\s$/, '');
    const word = /([가-힣→·]+)$/u.exec(before)?.[1] ?? '';
    const syl = word.replace(/[→·]/g, '').length;
    if (!syl) return `한자 앞에 한글 독음이 없다: (${inner})`;
    if (syl !== hanCount) return `독음 '${word}' 의 음절 수(${syl})와 한자 수(${hanCount})가 다르다: (${inner})`;
  }
  const total = s.match(HAN_G).length;
  if (covered !== total) return '괄호 밖에 한자가 있다 (한자가 앞에 오거나 한자만 쓴 꼴)';
  return null;
}

/** 방침 판정: 돌려줌 null(맞음) 또는 까닭. school = 이 글을 쓰는 유파 열쇠들 (Set) */
export function policyProblem(text, schools) {
  if (KANA.test(text)) return '가나가 있다 (일본 말은 한글 독음만)';
  if (!HAN.test(text)) return null;
  if (schools.has('japanese')) return '일본 유파 글에 한자가 있다 (한글 독음만, 한자 병기 없음)';
  const p = chineseFormProblem(text);
  if (p) return schools.has('chinese') ? `중국 유파 꼴 아님 — ${p}` : `한자가 '한글 (漢字)' 꼴이 아님 — ${p}`;
  return null;
}

// ── 모으기 ──
/** 모든 화면 글. opts.characters false 면 인물(characters.js) 뺌 */
export async function collectTexts({ characters = true } = {}) {
  const S = await import('../../src/schools.js');
  const AT = await import('../../src/ai_techniques.js');
  const GD = await import('../../src/guards.js');
  const FR = await import('../../src/frames.js');
  const W = await import('../../src/weapons.js');
  const GUN = await import('../../src/gun.js');
  const { classifyWeapon } = await import('../../src/weapon_class.js');
  const rows = [];
  const add = (cat, school, loc, text, extra = {}) => {
    if (text == null || text === '') return;
    rows.push({ cat, school: school ?? '', loc, text: String(text), ...extra });
  };

  // 무기 → 유파·몸 틀·방식 (자세표가 어느 유파 글인지 가른다)
  const weaponInfo = {};
  for (const [id, spec] of Object.entries(W.WEAPONS)) {
    const cls = classifyWeapon(spec);
    weaponInfo[id] = { school: S.traditionOf(spec), frame: spec.frame ?? cls.frame, style: spec.style ?? cls.style };
  }
  const frameSchools = (frame, style = null) =>
    [...new Set(Object.values(weaponInfo).filter((w) => w.frame === frame && (style == null || w.style === style)).map((w) => w.school))].sort();

  // 무기
  for (const [id, spec] of Object.entries(W.WEAPONS)) {
    const sc = weaponInfo[id].school;
    add('무기', sc, `src/weapons.js ${id}.nameKo`, spec.nameKo, { field: 'weapon.nameKo', id });
    add('무기', sc, `src/weapons.js ${id}.desc`, spec.desc?.replace(/\n/g, ' / '), { field: 'weapon.desc', id });
    add('무기', sc, `src/weapons.js ${id}.ability`, spec.ability, { field: 'weapon.ability', id });
  }
  for (const [k, v] of Object.entries(W.TIER_LABEL)) add('무기', '', `src/weapons.js TIER_LABEL.${k}`, v, { field: 'tier' });

  // 유파
  for (const [tid, T] of Object.entries(S.TRADITIONS)) {
    const at = (k) => `src/schools.js TRADITIONS.${tid}.${k}`;
    add('알림', tid, at('nameKo'), T.nameKo, { field: 'school.nameKo', note: '기술 알림 꼬리표의 유파 이름' });
    const nameSets = [];
    if (T.names) nameSets.push([T.names, 'names']);
    for (const [bk, B] of Object.entries(T.branches ?? {})) {
      add('기타', tid, at(`branches['${bk}'].nameKo`), B.nameKo, { field: 'branch.nameKo', note: '유파 가지 이름표' });
      if (B.names) nameSets.push([B.names, `branches['${bk}'].names`]);
    }
    for (const [set, k] of nameSets) {
      for (const [base, o] of Object.entries(set)) {
        add('자세 이름', tid, `${at(k)}['${base}'].name`, o.name, { field: 'guard.name', base, src: o.src });
        add('자세 설명', tid, `${at(k)}['${base}'].desc`, o.desc, { field: 'guard.desc', base });
      }
    }
    for (const [t, o] of Object.entries(T.techNames ?? {})) add('기술 이름', tid, `${at('techNames')}.${t}`, o.name, { field: 'tech.name', key: t, src: o.src });
    for (const u of [...(T.unique ?? []), ...(T.spare ?? [])]) {
      const spare = (T.spare ?? []).includes(u);
      if (u.nameKo) add('고유 동작', tid, `${at(spare ? 'spare' : 'unique')}[${u.name}].nameKo`, u.nameKo, { field: 'unique.nameKo', key: u.name, src: u.src, note: spare ? '남은 후보 (ai:false — 게임엔 안 나옴)' : u.ai === false ? 'ai:false' : '' });
      if (u.feint?.name) add('속임수', tid, `${at('unique')}[${u.name}].feint.name`, u.feint.name, { field: 'feint.name', key: u.name, src: u.src, note: '열쇠로도 쓰임 (uniqueByName·feints 중복 막기 — 같은 객체에서 읽어 함께 바뀜)' });
    }
    for (const p of T.passives ?? []) add('패시브', tid, `${at('passives')}[${p.name}].nameKo`, p.nameKo, { field: 'passive.nameKo', key: p.name, src: p.src, note: p.ai === false ? 'ai:false' : '' });
    if (T.secret) add('비기', tid, `${at('secret')}.nameKo`, T.secret.nameKo, { field: 'secret.nameKo', key: T.secret.name, src: T.secret.src });
    for (const q of T.secret?.do?.seq ?? []) add('비기', tid, `${at('secret')}.do.seq[${q.name}].nameKo`, q.nameKo, { field: 'secret.seq.nameKo', key: q.name, note: '비기 안의 수 이름 (지금 화면엔 비기 이름만 뜸 — 자료)' });
  }
  // 공용 속임수 (모든 유파 — 기술 이름 모두 표시 설정에서 보임)
  for (const f of AT.FEINTS) add('속임수', '', `src/ai_techniques.js FEINTS[${f.fake}]`, f.name, { field: 'feint.name', note: '공용 (모든 유파)' });

  // 자세표 (바탕 GUARDS·한손·두손 찌르기 표 · 몸 틀·방식 덮기 · 막기)
  //  바탕 표 여럿(GUARDS·guardBaseOne·guardBaseTwo)에 같은 글이 되풀이되므로 이름·설명이 같으면 한 줄로 모으고 위치에 표 이름을 덧붙인다
  const seen = new Map();
  const guardRows = (list, file, label, schools) => {
    for (const g of list) {
      const key = `${g.name}|${g.desc}`;
      const had = seen.get(key);
      if (had) {
        had[0].loc += ` · ${label}`;
        had[1].loc += ` · ${label}`;
        continue;
      }
      add('자세 이름', schools, `${file} ${label}['${g.name}'].name`, g.name, { field: 'guard.name' });
      add('자세 설명', schools, `${file} ${label}['${g.name}'].desc`, g.desc, { field: 'guard.desc' });
      seen.set(key, rows.slice(-2));
    }
  };
  guardRows(GD.GUARDS, 'src/guards.js', 'GUARDS', '');
  for (const st of ['versatile', 'cut', 'thrust']) guardRows(GD.guardBaseOne(st), 'src/guards.js', `guardBaseOne('${st}')`, '');
  guardRows(GD.guardBaseTwo('thrust'), 'src/guards.js', "guardBaseTwo('thrust')", '');
  for (const [frame, over] of Object.entries(FR.FRAME_GUARDS)) {
    for (const [base, o] of Object.entries(over)) {
      const sc = frameSchools(frame).join(',');
      add('자세 이름', sc, `src/frames.js FRAME_GUARDS.${frame}['${base}'].name`, o.name, { field: 'frame.name', base, note: `몸 틀 ${frame} 표 — 유파 이름표가 없을 때 보임` });
      add('자세 설명', sc, `src/frames.js FRAME_GUARDS.${frame}['${base}'].desc`, o.desc, { field: 'frame.desc', base });
    }
  }
  for (const [fs_, over] of Object.entries(FR.STYLE_GUARDS)) {
    const [frame, style] = fs_.split(':');
    for (const [base, o] of Object.entries(over)) {
      const sc = frameSchools(frame, style).join(',');
      add('자세 이름', sc, `src/frames.js STYLE_GUARDS['${fs_}']['${base}'].name`, o.name, { field: 'frame.name', base });
      add('자세 설명', sc, `src/frames.js STYLE_GUARDS['${fs_}']['${base}'].desc`, o.desc, { field: 'frame.desc', base });
    }
  }
  for (const [frame, over] of Object.entries(FR.COVERS)) {
    for (const [line, o] of Object.entries(over)) {
      add('자세 이름', frameSchools(frame).join(','), `src/frames.js COVERS.${frame}.${line}.name`, o.name, { field: 'cover.name', note: '막기 덧씌우기 (보여 주기 도구용)' });
    }
  }
  add('자세 이름', 'none', 'src/gun.js GUN_STANCE.name', GUN.GUN_STANCE.name, { field: 'guard.name' });
  add('자세 설명', 'none', 'src/gun.js GUN_STANCE.desc', GUN.GUN_STANCE.desc, { field: 'guard.desc' });

  // 인물 (10/10 이식 끝 — 검사기가 다른 글과 똑같이 본다)
  if (characters) {
    const C = await import('../../src/characters.js');
    for (const ch of [...C.CHARACTERS, ...C.CHARACTER_VARIANTS, ...(C.CHARACTER_GUESTS ?? [])]) { // 여정 밖 인물(10/14 라트나)도 같은 검사
      const wid = ch.weapon;
      const sc = (wid && weaponInfo[wid]?.school) || '';
      const at = (k) => `src/characters.js ${ch.id}.${k}`;
      add('인물', sc, at('name'), ch.name, { field: 'char.name', id: ch.id, characters: true });
      add('인물', sc, at('epithet'), ch.epithet, { field: 'char.epithet', characters: true });
      add('인물', sc, at('taunt'), ch.taunt, { field: 'char.taunt', characters: true, note: '대사를 못 찾을 때' });
      for (const [k, list] of Object.entries(ch.lines ?? {})) {
        (Array.isArray(list) ? list : [list]).forEach((t, i) => add('인물', sc, at(`lines.${k}[${i}]`), t, { field: 'char.line', characters: true }));
      }
      // 대사 출처 (10/14 병마용 — 화면에 대사 아래 줄로 나온다: main.js lineSourceOf). 같은 출처는 한 번만
      for (const src of new Set(Object.values(ch.lineSources ?? {}))) add('인물', sc, at(`lineSources['${src}']`), src, { field: 'char.lineSource', characters: true });
    }
  }

  // 글자 그대로 읽는 파일 (한글·한자·가나가 든 리터럴만 — 코드 열쇠·CSS 이름 따위는 뺀다)
  //  (다른 src 파일의 한글 리터럴은 셰이더 주석·사인 열쇠·경고뿐이라 뺀다 — perfmeter.js 는 ?fps=1 개발자 표시)
  const LIT_FILES = ['src/main.js', 'src/perfmeter.js'];
  for (const f of LIT_FILES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    const lines = src.split('\n');
    for (const s of jsStrings(src)) {
      const ln = lines.slice(Math.max(0, s.line - 6), s.line).join('\n'); // 그 줄과 위 다섯 줄 (여러 줄에 걸친 호출)
      const shown = /showToast\(|showHint\(|showEmoMsg\(|textContent = /.test(lines[s.line - 1] ?? '') && /[A-Za-z]{2}/.test(s.text) && !/^[a-z][A-Za-z0-9_-]*$/.test(s.text); // 한글 없는 화면 글 (Battle 등)
      if (!(HANGUL.test(s.text) || HAN.test(s.text) || KANA.test(s.text) || shown)) continue;
      if (/^[.#][\w-]+$/.test(s.text)) continue; // CSS 고르개
      if (/console\.(log|warn|error|info|debug)|throw new|new Error\(/.test(lines[s.line - 1] ?? '')) continue; // 개발자용
      const dev = f === 'src/perfmeter.js' || /stats\.|PerfMeter|const tag = /.test(lines[s.line - 1] ?? '');
      const note = [s.template ? '… = 실행 중 채움' : '', dev ? '개발자용 (화면에 안 나오거나 ?fps=1 일 때만)' : ''].filter(Boolean).join(' · ');
      add(dev ? '기타' : litCat(f, lines[s.line - 1] ?? '', ln, s.text), '', `${f}:${s.line}`, s.text.replace(/\n/g, ' / '), { field: 'literal', note });
    }
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const t of htmlTexts(html)) {
    if (!(HANGUL.test(t.text) || HAN.test(t.text) || KANA.test(t.text))) continue;
    add(t.kind === 'text' ? htmlCat(t.text, html.split('\n')[t.line - 1]) : htmlCat(t.text, html.split('\n')[t.line - 1]), '', `index.html:${t.line}${t.kind !== 'text' ? ` ${t.kind}` : ''}`, t.text, { field: 'html' });
  }
  return rows;
}

// main.js 리터럴 분류: 그 줄(+ 글)에서 먼저 찾고, 없으면 위 다섯 줄까지 (여러 줄에 걸친 showHint( … ) 따위)
const LIT_RULES = [
  [/showHint|hint/i, '알림'],
  [/menuSub|menuTitle|btnStart|btnResume|cause|CAUSE/, '메뉴'],
  [/<li>/, '메뉴'],
  [/toast|showMsg|emoMsg|announce|banner|showFoeLine|foeIntro|josa\(|\bname: '|EMO_|fear:|anger:|grit:|currentFoe|ch\?\.name/i, '알림'],
  [/wkey|TIER_KO|card|wwho|draw/i, '무기'],
  [/TECH_CUE|techCue|GUN_STANCE|guardName|hud/i, 'HUD'],
  [/setting|DEFAULTS|toggle/i, '설정'],
];
function litCat(file, line, ctx, text) {
  if (file !== 'src/main.js') return '기타';
  for (const probe of [`${line} ${text}`, ctx]) for (const [re, cat] of LIT_RULES) if (re.test(probe)) return cat;
  return '기타';
}
function htmlCat(text, ln = '') {
  if (/data-setting|data-v=|class="row/.test(ln)) return '설정';
  if (/wcard|wwho/.test(ln)) return '무기';
  if (/btnStart|btnResume|menu|class="sub"/.test(ln)) return '메뉴';
  if (/iconBtn|moveStick|rotate/.test(ln)) return 'HUD';
  return '기타';
}

/** 열쇠 문자열 → 유파 집합 */
export const schoolSet = (s) => new Set(String(s || '').split(',').filter(Boolean));
export { rel };
