import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { extract, planEdits, applyChanges, writeCSV, readCSV, readManifest } from './catalog.mjs';

function fixture() {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'text-catalog-test-'));
  fs.mkdirSync(path.join(root,'src')); fs.mkdirSync(path.join(root,'public'));
  const files={
    'index.html':'<html><head><title>Stillness</title><style>.x { color:red; }</style></head><body><button aria-label="시작 &amp; 메뉴">시작 <b>준비</b></button><!-- 비밀 주석 --></body></html>',
    'sounds.html':'<html><body>소리</body></html>',
    'src/main.js':"const x = '출혈'; const settings = {}; function showHint(x) {}\nshowHint('Battle');\nconst info = {}; info.textContent = `승리 ${settings.mode === 'code' ? 'A' : 'B'} · ${3}`;\ninfo.innerHTML = '<b>게임</b>';\nconsole.log('디버그');\nfunction onWound(){ const tag = `심각도 ${3}`; console.log(tag); }\n",
    'src/guards.js':"const RAW = [{name:'지붕',desc:'설명'},{name:'내려찍기',desc:'마무리'}]; const ONE = {'지붕':{hand:3}};",
    'src/motion_library.js':"const FRAME_GUARDS = {'지붕':{name:'기존 동작',desc:'내부 설명'}}; const o={}; o['지붕']=3;",
    'src/weapons.js':"const W = {nameKo:'무기',nameEn:'Weapon',motionSkip:['지붕']}; const TIER_LABEL={mystery:'???'};",
    'src/fighter.js':"const name='내려찍기'; function die(x){} die('내려찍기');",
    'src/revive.js':"const reason='내려찍기';",
    'src/gravity_v2_trial.js':"function mountGravityV2Trial(info){const label={base:'기준',plus15:'+15%',plus25:'+25%'}[info.level];}",
    'src/characters.js':"const CHARACTERS=[{id:'one',name:'이름',school:'서사',ai:{persona:{school:'internal-id'}},lines:{intro:['인사'],hurt:['아야']}}];",
    'src/soundlab.js':"const ROWS=[['하나','설명',[],()=>{},['A']],['둘','설명',[],()=>{},['B']],['셋','60 / 110 / 180 J',['기절','출혈','목'],()=>{},['기절','출혈','목']]]; const AB_LABELS=['A 150','B 150'];",
  };
  for(const [p,s] of Object.entries(files))fs.writeFileSync(path.join(root,p),s);
  const m=extract(root);
  return {root,m,dispose:()=>fs.rmSync(root,{recursive:true,force:true})};
}
function withFixture(fn){return()=>{const f=fixture();try{return fn(f)}finally{f.dispose()}}}
function row(m,text){const r=m.rows.find(r=>r.current_text===text);assert.ok(r,`Expected catalog text: ${text}`);return {...r};}

test('extract display text, English, dormant content; exclude comments, code IDs and sound event codes',withFixture(({m})=>{
  assert.ok(row(m,'Battle')); assert.ok(row(m,'???')); assert.ok(row(m,'60 / 110 / 180 J')); assert.ok(row(m,'A 150'));
  assert.ok(row(m,'+15%')); assert.ok(row(m,'+25%'));
  assert.equal(row(m,'아야').scope,'dormant-content');
  assert.equal(m.rows.filter(r=>r.current_text==='출혈'&&r.source_path==='src/soundlab.js').length,1);
  for(const text of ['internal-id','비밀 주석','디버그','code','내부 설명'])assert.ok(!m.rows.some(r=>r.current_text===text),text);
}));
test('blank proposals are no-ops and planning never writes',withFixture(({m,root})=>{
  assert.deepEqual(planEdits(m,m.rows,root),[]);
  const r=row(m,'Battle');r.proposed_text='결투';const before=fs.readFileSync(path.join(root,r.source_path),'utf8');
  const plan=planEdits(m,[r],root);assert.equal(plan.length,1);assert.equal(fs.readFileSync(plan[0].full,'utf8'),before);
  applyChanges(plan);assert.match(fs.readFileSync(plan[0].full,'utf8'),/결투/);
}));
test('CSV round-trip preserves commas, quotes, Unicode, CRLF and multiline values',withFixture(({m,root})=>{
  const r=row(m,'Battle');r.proposed_text='"검",\r\n다음 행 😀';const file=path.join(root,'test.csv');writeCSV([r],file);
  assert.equal(readCSV(fs.readFileSync(file,'utf8'))[0].proposed_text,r.proposed_text);
}));
test('quoted and script-like proposed text remains a string literal',withFixture(({m,root})=>{
  const r=row(m,'Battle');r.proposed_text='"; globalThis.attack=1; //\n${danger} `한글`';
  const plan=planEdits(m,[r],root);applyChanges(plan);const refreshed=extract(root);assert.ok(refreshed.rows.some(x=>x.current_text===r.proposed_text));
}));
test('nested template edits compose without reverting either edit',withFixture(({m,root})=>{
  const outer=m.rows.find(r=>r.kind==='js-template'&&r.current_text.startsWith('승리'));
  const a=row(m,'A');a.proposed_text='기준';const r={...outer,proposed_text:outer.current_text.replace('승리','결과')};
  const p=planEdits(m,[a,r],root);assert.match(p[0].after,/결과/);assert.match(p[0].after,/기준/);assert.match(p[0].after,/=== 'code'/);
}));
test('reject missing and reordered placeholders',withFixture(({m,root})=>{
  const r={...m.rows.find(r=>r.kind==='js-template'&&r.current_text.startsWith('승리'))};
  for(const proposed_text of ['문구', '{{expr:2}} · {{expr:1}}'])assert.throws(()=>planEdits(m,[{...r,proposed_text}],root),/Placeholder/);
}));
test('reject changed tags, attributes and injected markup',withFixture(({m,root})=>{
  const r=row(m,'<b>게임</b>');for(const proposed_text of ['게임','<b onclick="attack()">게임</b>','<b>게임</b><script>bad</script>'])assert.throws(()=>planEdits(m,[{...r,proposed_text}],root),/markup/);
}));
test('reject source conflicts before writing any file',withFixture(({m,root})=>{
  const a=row(m,'Battle'),b=row(m,'무기');a.proposed_text='결투';b.proposed_text='검';const before=fs.readFileSync(path.join(root,a.source_path),'utf8');fs.appendFileSync(path.join(root,b.source_path),'\n// changed');
  assert.throws(()=>planEdits(m,[a,b],root),/Source conflict/);assert.equal(fs.readFileSync(path.join(root,a.source_path),'utf8'),before);
}));
test('reject duplicate IDs, unknown IDs, edited base text and hashes',withFixture(({m,root})=>{
  const r=row(m,'Battle');r.proposed_text='결투';assert.throws(()=>planEdits(m,[r,r],root),/Duplicate ID/);assert.throws(()=>planEdits(m,[{...r,id:'bad'}],root),/Unknown ID/);
  for(const field of ['current_text','base_text_sha256','base_file_sha256'])assert.throws(()=>planEdits(m,[{...r,[field]:'bad'}],root),/Read-only/);
}));
test('explicit clear empties text while blank proposal preserves it',withFixture(({m,root})=>{
  const r=row(m,'Battle');r.action='clear';const p=planEdits(m,[r],root);assert.match(p[0].after,/showHint\(""\)/);assert.throws(()=>planEdits(m,[{...r,proposed_text:'other'}],root),/clear action/);
}));
test('HTML text and attribute replacements escape structural characters',withFixture(({m,root})=>{
  const r=row(m,'시작 & 메뉴');r.proposed_text='준비 "확인" & 진행';const p=planEdits(m,[r],root);assert.match(p[0].after,/준비 &quot;확인&quot; &amp; 진행/);
}));
test('guard rename synchronizes explicit lookup references and retains death codes',withFixture(({m,root})=>{
  const r=row(m,'지붕');r.proposed_text='상단';const plan=planEdits(m,[r],root);assert.equal(plan.length,3);applyChanges(plan);
  assert.ok(!fs.readFileSync(path.join(root,'src/motion_library.js'),'utf8').includes('지붕'));
  const f=extract(root),finish=row(f,'내려찍기');finish.proposed_text='마무리 자세';const p=planEdits(f,[finish],root);assert.deepEqual(p.map(c=>c.source_path),['src/guards.js']);assert.match(fs.readFileSync(path.join(root,'src/fighter.js'),'utf8'),/die\('내려찍기'\)/);
}));
test('reject empty or colliding guard names',withFixture(({m,root})=>{
  const r=row(m,'지붕');for(const proposed_text of ['내려찍기',''])assert.throws(()=>planEdits(m,[{...r,proposed_text,action:'replace'}],root),/unique and nonempty/);
}));
test('IDs survive line insertions and ordinary wording edits',withFixture(({m,root})=>{
  const r=row(m,'Battle');fs.writeFileSync(path.join(root,r.source_path),'// insert line\n'+fs.readFileSync(path.join(root,r.source_path),'utf8').replace("'Battle'","'결투'"));const updated=extract(root);assert.equal(row(updated,'결투').id,r.id);
}));
test('apply refuses a change since dry-run validation',withFixture(({m,root})=>{
  const r=row(m,'Battle');r.proposed_text='결투';const plan=planEdits(m,[r],root);fs.appendFileSync(plan[0].full,'\n// changed');assert.throws(()=>applyChanges(plan),/after validation/);
}));
test('gzip and plain manifests produce identical patch plans',withFixture(({m,root})=>{
  const plain=path.join(root,'manifest.json'),gz=plain+'.gz';fs.writeFileSync(plain,JSON.stringify(m));fs.writeFileSync(gz,gzipSync(JSON.stringify(m)));
  assert.deepEqual(readManifest(gz),readManifest(plain));const r=row(m,'Battle');r.proposed_text='결투';assert.deepEqual(planEdits(readManifest(gz),[r],root),planEdits(readManifest(plain),[r],root));
}));
