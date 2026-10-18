// 표기 방침 검사기 (사장님 10/10 — docs/text/naming_policy_2026-10-10.md)
//  10/19 글 방침 2판 (docs/text/text_style_v2_2026-10-19.md): 이름은 모든 유파 '뜻 (원어)' — 일본 원어는 한글 소리, 동방 원어는 '(漢字 독음)' (옛 '독음 (漢字)' 꼴도 통과)
//  일본 유파: 일본어 발음을 한글로만 — 표시 글에 한자·가나가 있으면 위반
//  중국 유파: '한글 독음 (漢字)' 꼴 — 한자가 있는데 괄호 안 + 바로 앞 낱말이 같은 음절 수의 한글 독음이 아니면 위반
//  그 밖(독일·이탈리아·이베리아·무유파·공용): 가나가 있으면 위반, 한자가 있으면 '한글 (漢字)' 꼴이어야 한다
//  유파 소속: schools.js TRADITIONS(유파 자료) · 무기 school(traditionOf) · 몸 틀 자세표는 그 틀을 쓰는 무기들의 유파
//  인물(src/characters.js)도 본다 (10/10 이식 끝 — 앞서는 보고만 했다)
// 실행: node tools/text/name_policy.mjs
// 종료 코드: 위반 0 → 0, 있으면 1
import { collectTexts, policyProblem, schoolSet } from './texts.mjs';

const rows = await collectTexts({ characters: true });
const bad = [];
const count = {};
for (const r of rows) {
  const p = policyProblem(r.text, schoolSet(r.school));
  const k = r.school || '공용';
  count[k] = count[k] ?? { all: 0, bad: 0 };
  count[k].all++;
  if (!p) continue;
  count[k].bad++;
  bad.push({ ...r, why: p });
}

console.log(`표기 방침 검사 — 화면 글 ${rows.length} 줄`);
console.log(`  유파별 (글 수 / 위반): ${Object.entries(count).map(([k, v]) => `${k} ${v.all}/${v.bad}`).join(' · ')}`);
const show = (list) => {
  for (const r of list) console.log(`  [${r.school || '공용'}] ${r.cat} · ${r.loc}\n      "${r.text}" — ${r.why}`);
};
if (bad.length) {
  console.log(`\n위반 ${bad.length} 건:`);
  show(bad);
  process.exit(1);
}
console.log('\n위반 0');
