#!/usr/bin/env node
/** Source text round-trip. No game modules are imported or executed. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHA = value => crypto.createHash('sha256').update(value).digest('hex');
const COLUMNS = ['id','scope','category','context','source_path','source_line','current_text','proposed_text','action','placeholders','protected_markup','base_text_sha256','base_file_sha256','notes'];
const KOREAN = /[\uac00-\ud7a3\u3130-\u318f]/u;
const DISPLAY_KEYS = /^(name|nameKo|nameEn|title|label|text|desc|description|epithet|origin|backstory|want|school|signatureMoves|favoriteGuards|temperament|movementNotes|weaknesses|taunt|ability)$/;
const SINK = /(?:textContent|innerHTML|innerText|showToast|showHint|fillText|strokeText|alert|confirm|aria-label|setAttribute)/;
const PRESENTATION_FILES = /^(?:src\/(?:main|weapons|characters|guards|gun|soundlab|support_probe|\w+_trial)\.js|.*\.html)$/;
const EXCLUDED = ['public/wb/** and public/corr/**: archived generated comparison builds; current source is authoritative', 'public/development-plan.html: development plan, not game UI', 'tools/**, docs/**, tests/**, node_modules/**: tooling/documentation/dependencies', 'src/perfmeter.js: opt-in developer performance overlay', 'JS comments, identifiers, code-only keys/URLs, console messages and thrown errors', 'Text baked into images/audio/meshes is not OCR/transcribed by this source catalog'];
function keyName(node) { return node?.name ?? node?.value ?? ''; }
function parse(code, filename) { return parseAst(code, { sourceType: 'module' }, filename); }
function walkFiles(dir) { return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walkFiles(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
function sources(root) {
  return [...walkFiles(path.join(root,'src')).filter(p=>p.endsWith('.js')), ...['index.html','sounds.html'].map(p=>path.join(root,p)), ...fs.readdirSync(path.join(root,'public')).filter(p=>p.endsWith('.html') && p!=='development-plan.html').map(p=>path.join(root,'public',p))].map(p=>path.relative(root,p).split(path.sep).join('/')).sort();
}
function markup(text) { return [...text.matchAll(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>/g)].map(m=>m[0]); }
function tokens(text) { return [...text.matchAll(/\{\{expr:\d+\}\}/g)].map(m=>m[0]); }
function category(file, context) {
  if (/characters/.test(file)) return /lines|taunt/.test(context) ? 'dialogue' : /name|epithet/.test(context) ? 'character-name' : 'character-lore';
  if (/weapons/.test(file)) return /name/.test(context) ? 'weapon-name' : 'weapon-description';
  if (/guards|schools|ai_techniques/.test(file)) return 'stance-and-technique';
  if (/soundlab|sounds\.html/.test(file)) return 'sound-lab';
  if (/trial|support_probe|public\//.test(file)) return 'comparison-ui';
  return /\.html$/.test(file) ? 'menu-and-accessibility' : 'game-ui';
}
export function extract(root=ROOT) {
  const rows=[], files=[], pending=[], allLiterals=[];
  for(const source_path of sources(root)) {
    const source=fs.readFileSync(path.join(root,source_path),'utf8');
    const record={source_path,sha256:SHA(source),string_nodes:0,included:0,excluded:0}; files.push(record);
    const occurrences=new Map();
    function add(data) {
      if (!data.text.trim()) return;
      const context=data.context.slice(0,400);
      const identity=`${source_path}|${data.kind}|${context}`;
      const n=occurrences.get(identity)||0; occurrences.set(identity,n+1);
      const id=`txt_${SHA(`${identity}|${n}`).slice(0,20)}`;
      const cat=category(source_path,context);
      const dormant=cat==='character-lore' || source_path==='src/characters.js' && / > lines > (attack|hurt|winning|losing|lose)(?: >|$)/.test(context) || source_path==='src/weapons.js' && / > nameEn$/.test(context);
      const comparison=cat==='comparison-ui' || source_path==='src/main.js' && /^info\.textContent/.test(context);
      rows.push({id,scope:dormant?'dormant-content':comparison?'comparison':cat==='sound-lab'?'sound-lab':'game',category:cat,context,source_path,source_line:source.slice(0,data.start).split('\n').length,current_text:data.text,proposed_text:'',action:'',placeholders:tokens(data.text).join(' '),protected_markup:JSON.stringify(markup(data.text)),base_text_sha256:SHA(data.text),base_file_sha256:record.sha256,...data,notes:[data.notes,dormant?'Stored content; no current UI call site found.':''].filter(Boolean).join(' ')});
      record.included++;
    }
    function js(code, offset=0, prefix='') {
      const ast=parse(code,source_path);
      function visit(node, parents=[], semantic=[]) {
        if(!node || typeof node!=='object' || !node.type) return;
        const parent=parents.at(-1);
        let next=semantic;
        if(node.type==='VariableDeclarator' && node.id?.name) next=[...semantic,node.id.name];
        else if(/Function(?:Declaration|Expression)/.test(node.type) && node.id?.name) next=[...semantic,node.id.name];
        else if(node.type==='Property' && !node.computed) next=[...semantic,String(keyName(node.key))];
        else if(node.type==='ObjectExpression') { const id=node.properties?.find(p=>p.type==='Property' && keyName(p.key)==='id' && typeof p.value?.value==='string'); if(id) next=[...semantic,`id=${id.value.value}`]; }
        else if(node.type==='AssignmentExpression') next=[...semantic,code.slice(node.left.start,node.left.end).replace(/\s+/g,' ').slice(0,120)];
        else if(node.type==='CallExpression') next=[...semantic,code.slice(node.callee.start,node.callee.end).replace(/\s+/g,' ').slice(0,100)];
        const isString=node.type==='Literal' && typeof node.value==='string';
        const isTemplate=node.type==='TemplateLiteral';
        if(isString || isTemplate) {
          record.string_nodes++;
          const context=prefix+next.join(' > ');
          const isKey=parent?.type==='Property' && parent.key===node || parent?.type==='MemberExpression' && parent.property===node || /Import|Export/.test(parent?.type||'');
          const debug=source_path==='src/perfmeter.js' || parents.some(p=>p.type==='ThrowStatement' || p.type==='CallExpression' && /^console\./.test(code.slice(p.callee.start,p.callee.end)) || p.type==='NewExpression' && /Error$/.test(p.callee?.name||''));
          const prop=parents.findLast(p=>p.type==='Property');
          const property=String(keyName(prop?.key));
          const internal=parents.some((p,i)=>p.type==='BinaryExpression' && p.operator!=='+' || p.type==='ConditionalExpression' && node.start>=p.test.start && node.end<=p.test.end || p.type==='CallExpression' && /^(?:params\.get|randomLine|document\.(?:querySelector|createElement|getElementById)|.*\.querySelector)$/.test(code.slice(p.callee.start,p.callee.end)) && !parents.slice(i+1).some(x=>/Function/.test(x.type)));
          const visibleSink=!internal && parents.some(p=>p.type==='AssignmentExpression' && /\.(textContent|innerHTML|innerText)$/.test(code.slice(p.left.start,p.left.end)) && p.right.start<=node.start || p.type==='CallExpression' && /^(showToast|showHint|alert|confirm)$|\.(fillText|strokeText)$/.test(code.slice(p.callee.start,p.callee.end)) || p.type==='CallExpression' && /\.setAttribute$/.test(code.slice(p.callee.start,p.callee.end)) && /^(aria-label|title|alt|placeholder)$/.test(p.arguments[0]?.value||'') && node!==p.arguments[0]);
          const text=isString ? node.value : node.quasis.map((q,i)=>(q.value.cooked??q.value.raw)+(i<node.expressions.length?`{{expr:${i+1}}}`:'')).join('');
          const guardReference=source_path==='src/guards.js' && isKey || source_path==='src/motion_library.js' && isKey || source_path==='src/weapons.js' && property==='motionSkip';
          if(isString && guardReference) allLiterals.push({source_path,start:node.start+offset,end:node.end+offset,raw:code.slice(node.start,node.end),text,base_file_sha256:record.sha256});
          const knownInternal=source_path==='src/main.js' && /^(onWound > tag|perf|newRound > player > name)(?: >|$)/.test(context) || source_path==='src/weapons.js' && property==='motionSkip' || source_path==='src/characters.js' && / > ai >/.test(context) || source_path==='src/soundlab.js' && parents.some(p=>p.type==='ArrayExpression' && (typeof p.elements[0]?.value==='string' || p.elements[0]?.type==='TemplateLiteral') && p.elements[2]?.type==='ArrayExpression' && node.start>=p.elements[2].start && node.end<=p.elements[2].end);
          const soundEnglish=source_path==='src/soundlab.js' && (/^AB_LABELS$/.test(context) || /^\d+(?:\.\d+)?(?: \/ \d+(?:\.\d+)?)* J$/.test(text) || ['0.3','0.7','1.0'].includes(text));
          const formatting=/^EMO_TEXT >/.test(context) && isTemplate || parents.some(p=>p.type==='CallExpression' && code.slice(p.callee.start,p.callee.end)==='document.createTextNode') || source_path==='src/gravity_v2_trial.js' && /(?:^| > )label(?: >|$)/.test(context);
          const candidate=PRESENTATION_FILES.test(source_path) && !isKey && !debug && !internal && !knownInternal && text.trim() && (KOREAN.test(text) || DISPLAY_KEYS.test(property) || visibleSink || soundEnglish || formatting || source_path==='src/weapons.js' && context.startsWith('TIER_LABEL >'));
          if(candidate) add({kind:isString?'js-string':'js-template',start:node.start+offset,end:node.end+offset,text,context,raw:code.slice(node.start,node.end),expressions:isTemplate?node.expressions.map(e=>({start:e.start+offset,end:e.end+offset,raw:code.slice(e.start,e.end)})):[],notes:isTemplate?'Keep every {{expr:N}} exactly once and in its existing order; expression text is in manifest. Nested expression strings have their own rows.':parents.some(p=>p.type==='BinaryExpression' && p.operator==='+')?'Part of concatenated text; preserve adjoining spaces.':''});
          else { record.excluded++; if(KOREAN.test(text) && !isKey) pending.push({source_path,line:source.slice(0,node.start+offset).split('\n').length,reason:debug?'debug-only':!PRESENTATION_FILES.test(source_path)?'not-a-presentation-module':knownInternal||internal?'logic-or-debug':'not-display-candidate',text:text.length>400?'[long source string; excluded]':text}); }
        }
        for(const [field,value] of Object.entries(node)) {
          if(['loc','range','comments','tokens'].includes(field)) continue;
          if(Array.isArray(value)) for(const item of value) if(item?.type) visit(item,[...parents,node],next);
          else {} // keep the loop's else separate from the field test
          if(!Array.isArray(value) && value?.type) visit(value,[...parents,node],next);
        }
      }
      visit(ast);
    }
    if(source_path.endsWith('.js')) js(source);
    else {
      // HTML lexical scanner: comments and raw script/style bodies never become UI text.
      const parts=/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+|</g;
      let match, hidden=null, stack=[], scriptIndex=0;
      while((match=parts.exec(source))) {
        const s=match[0], start=match.index;
        if(hidden) {
          const close=new RegExp(`</${hidden}\\s*>`,'ig'); close.lastIndex=start; const end=close.exec(source);
          if(!end) throw Error(`Unclosed ${hidden}: ${source_path}`);
          if(hidden==='script' && !stack.at(-1)?.external) js(source.slice(start,end.index),start,`inline-script-${scriptIndex++} > `);
          parts.lastIndex=end.index+end[0].length; stack.pop(); hidden=null; continue;
        }
        if(/^<!/.test(s)) continue;
        if(/^<\//.test(s)) { stack.pop(); continue; }
        if(/^<[A-Za-z]/.test(s)) {
          const tag=s.match(/^<([\w:-]+)/)[1].toLowerCase();
          const id=s.match(/\bid\s*=\s*(['"])(.*?)\1/i)?.[2];
          const ctx=[...stack.map(x=>x.context),`${tag}${id?'#'+id:''}`].join(' > ');
          for(const a of s.matchAll(/\b(aria-label|title|alt|placeholder)\s*=\s*(['"])([\s\S]*?)\2/gi)) {
            const rel=a.index+a[0].indexOf(a[2])+1;
            add({kind:'html-attribute',start:start+rel,end:start+rel+a[3].length,text:decodeHTML(a[3]),raw:a[3],quote:a[2],context:`${ctx} @${a[1]}`,notes:'Accessibility/tooltip text; HTML entities are decoded for editing.'});
          }
          if(!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !/\/>$/.test(s)) stack.push({context:`${tag}${id?'#'+id:''}`,external:/\bsrc\s*=/.test(s)});
          if(tag==='script' || tag==='style') hidden=tag;
          continue;
        }
        if(s.trim()) {
          const left=s.length-s.trimStart().length, right=s.trimEnd().length;
          add({kind:'html-text',start:start+left,end:start+right,text:decodeHTML(s.slice(left,right)),raw:s.slice(left,right),context:stack.map(x=>x.context).join(' > '),notes:'HTML text node; adjacent inline elements are separate rows.'});
        }
      }
    }
  }
  for(const row of rows.filter(r=>r.source_path==='src/guards.js' && / > name$/.test(r.context))) {
    row.linked_references=allLiterals.filter(r=>r.text===row.current_text && !(r.source_path===row.source_path && r.start===row.start));
    if(row.linked_references.length)row.notes+=' Guard name is also a lookup key: importer synchronizes '+row.linked_references.length+' linked literal references.';
  }
  return {format:'halfsword-game-text-v1',created_at:new Date().toISOString(),repository:'yoonjl-svg/halfsword-codex',source_commit:gitHead(root),columns:COLUMNS,exclusions:EXCLUDED,files,rows,pending_review:pending};
}
function gitHead(root) {try{return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{return 'unknown'}}
function decodeHTML(text) { const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',middot:'·',mdash:'—',ndash:'–',hellip:'…'}; return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(all,key)=>key[0]==='#'?String.fromCodePoint(parseInt(key.slice(key[1].toLowerCase()==='x'?2:1),key[1].toLowerCase()==='x'?16:10)):named[key]??all); }
function csvCell(value) { return '"'+String(value??'').replaceAll('"','""')+'"'; }
export function writeCSV(rows, filename) {fs.writeFileSync(filename,'\ufeff'+[COLUMNS,...rows.map(r=>COLUMNS.map(c=>r[c]))].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n');}
export function readCSV(source) {
  source=source.replace(/^\ufeff/,''); const table=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted && source[i+1]==='"'){cell+='"';i++;}else if(quoted)quoted=false;else if(cell==='')quoted=true;else throw Error('Malformed CSV quote');}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))table.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw Error('Unclosed CSV quote');if(cell||row.length){row.push(cell);table.push(row);}const header=table.shift()||[];if(new Set(header).size!==header.length)throw Error('Duplicate CSV columns');for(const required of ['id','current_text','proposed_text','base_text_sha256','base_file_sha256'])if(!header.includes(required))throw Error(`Missing CSV column: ${required}`);
  return table.map((r,i)=>{if(r.length!==header.length)throw Error(`CSV row ${i+2}: wrong column count`);return Object.fromEntries(header.map((h,j)=>[h,r[j]]));});
}
export function readManifest(filename) {const data=fs.readFileSync(filename);return JSON.parse((filename.endsWith('.gz')?gunzipSync(data):data).toString('utf8'));}
function encodeString(value) { return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'); }
function encodeTemplate(value) { return value.replaceAll('\\','\\\\').replaceAll('`','\\`').replaceAll('${','\\${').replace(/<\/script/gi,'<\\/script'); }
function encodeHTML(value, quote) {let out=value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');return quote?out.replaceAll(quote,quote==='"'?'&quot;':'&#39;'):out;}
function safePath(root, relative) { const full=path.resolve(root,relative);if(!full.startsWith(path.resolve(root)+path.sep))throw Error(`Unsafe source path: ${relative}`);const real=fs.realpathSync(full);if(!real.startsWith(fs.realpathSync(root)+path.sep))throw Error(`Source symlink escapes root: ${relative}`);return full;}
export function planEdits(manifest, sheetRows, root=ROOT) {
  if(manifest.format!=='halfsword-game-text-v1')throw Error('Unsupported manifest');
  const base=new Map(manifest.rows.map(r=>[r.id,r])), seen=new Set(), edits=[];
  for(const r of sheetRows){if(seen.has(r.id))throw Error(`Duplicate ID: ${r.id}`);seen.add(r.id);const b=base.get(r.id);if(!b)throw Error(`Unknown ID: ${r.id}`);for(const c of ['current_text','base_text_sha256','base_file_sha256'])if(r[c]!==b[c])throw Error(`Read-only ${c} changed: ${r.id}`);if(r.action && r.action!=='replace' && r.action!=='clear')throw Error(`Invalid action: ${r.id}`);const proposed=r.action==='clear'?'':r.proposed_text;if(r.action==='clear' && r.proposed_text)throw Error(`clear action requires a blank proposed_text: ${r.id}`);if(!r.action && proposed==='')continue;if(proposed===b.current_text)continue;
    if(JSON.stringify(tokens(proposed))!==JSON.stringify(tokens(b.current_text)))throw Error(`Placeholder mismatch: ${r.id}`);
    if(JSON.stringify(markup(proposed))!==JSON.stringify(markup(b.current_text)))throw Error(`Protected markup changed: ${r.id}`);
    if(/\{\{expr:/.test(proposed.replace(/\{\{expr:\d+\}\}/g,'')))throw Error(`Malformed placeholder: ${r.id}`);
    edits.push({...b,proposed});
    for(const linked of b.linked_references||[])edits.push({...linked,id:`${b.id}:linked:${linked.source_path}:${linked.start}`,kind:'js-string',current_text:linked.text,proposed,source_line:0});
  }
  const guardRows=manifest.rows.filter(r=>r.source_path==='src/guards.js' && / > name$/.test(r.context));
  const guardNames=guardRows.map(r=>edits.find(e=>e.id===r.id)?.proposed??r.current_text);if(new Set(guardNames).size!==guardNames.length || guardNames.some(s=>!s.trim()))throw Error('Guard names must stay unique and nonempty because they are lookup keys');
  const byFile=new Map();for(const e of edits){if(!byFile.has(e.source_path))byFile.set(e.source_path,[]);byFile.get(e.source_path).push(e);}
  const changes=[];
  for(const [source_path,list] of byFile){const full=safePath(root,source_path),before=fs.readFileSync(full,'utf8');for(const e of list){if(SHA(before)!==e.base_file_sha256)throw Error(`Source conflict: ${source_path}; re-export and reconcile edits`);if(before.slice(e.start,e.end)!==e.raw)throw Error(`Source span mismatch: ${e.id}`);}
    function patchRange(start,end,skip=null){const eligible=list.filter(e=>e!==skip && e.start>=start && e.end<=end);const top=eligible.filter(e=>!eligible.some(o=>o!==e && o.start<=e.start && o.end>=e.end));let value=before.slice(start,end);for(const e of top.sort((a,b)=>b.start-a.start))value=value.slice(0,e.start-start)+replacement(e)+value.slice(e.end-start);return value;}
    function replacement(e){if(e.kind==='js-string')return encodeString(e.proposed);if(e.kind==='js-template'){let next='`';const pieces=e.proposed.split(/(\{\{expr:\d+\}\})/g);for(const p of pieces){const m=p.match(/^\{\{expr:(\d+)\}\}$/);if(m){const x=e.expressions[Number(m[1])-1];next+='${'+patchRange(x.start,x.end,e)+'}';}else next+=encodeTemplate(p);}return next+'`';}return encodeHTML(e.proposed,e.quote);}
    const after=patchRange(0,before.length);if(source_path.endsWith('.js'))parse(after,source_path);else {for(const m of after.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi))if(!/\bsrc\s*=/.test(m[1]))parse(m[2],source_path);}
    changes.push({source_path,full,before,after,edits:list.map(e=>({id:e.id,line:e.source_line,before:e.current_text,after:e.proposed}))});
  }
  return changes;
}
export function applyChanges(changes){for(const c of changes)if(fs.readFileSync(c.full,'utf8')!==c.before)throw Error(`Source changed after validation: ${c.source_path}`);for(const c of changes)fs.writeFileSync(c.full,c.after);}
function arg(name, fallback) {const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1];}
function usage(){console.log('Export: node tools/text/catalog.mjs export --out DIR\nReview: node tools/text/catalog.mjs import --manifest DIR/manifest.json --csv edited.csv [--report report.json] [--patch edits.patch]\nApply only when requested: same import command plus --apply\nOptional --root PATH targets an isolated fixture or checkout. CSV proposed_text is editable; action=clear explicitly empties a string.');}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const command=process.argv[2], root=path.resolve(arg('--root',ROOT));
  if(command==='export'){const out=path.resolve(arg('--out',path.join(ROOT,'text-export')));fs.mkdirSync(out,{recursive:true});const m=extract(root);fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(m,null,2)+'\n');writeCSV(m.rows,path.join(out,'all-text.csv'));for(const scope of new Set(m.rows.map(r=>r.scope)))writeCSV(m.rows.filter(r=>r.scope===scope),path.join(out,`${scope}.csv`));fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify({source_commit:m.source_commit,files:m.files,exclusions:m.exclusions,pending_review:m.pending_review},null,2)+'\n');console.log(JSON.stringify({out,rows:m.rows.length,files:m.files.length,scopes:Object.fromEntries([...new Set(m.rows.map(r=>r.scope))].map(s=>[s,m.rows.filter(r=>r.scope===s).length]))},null,2));}
  else if(command==='import'){const m=readManifest(arg('--manifest','')),rows=readCSV(fs.readFileSync(arg('--csv',''),'utf8')),changes=planEdits(m,rows,root);const report={mode:process.argv.includes('--apply')?'apply':'dry-run',edited_rows:changes.reduce((n,c)=>n+c.edits.length,0),files:changes.map(({source_path,edits})=>({source_path,edits}))};if(arg('--report'))fs.writeFileSync(arg('--report'),JSON.stringify(report,null,2)+'\n');if(arg('--patch')){let patch='';const temp=fs.mkdtempSync('/tmp/game-text-diff-');try{for(const c of changes){const a=path.join(temp,'before'),b=path.join(temp,'after');fs.writeFileSync(a,c.before);fs.writeFileSync(b,c.after);try{patch+=execFileSync('diff',['-u','--label',`a/${c.source_path}`,'--label',`b/${c.source_path}`,a,b],{encoding:'utf8'});}catch(e){if(e.status!==1)throw e;patch+=e.stdout;}}}finally{fs.rmSync(temp,{recursive:true,force:true});}fs.writeFileSync(arg('--patch'),patch);}if(process.argv.includes('--apply'))applyChanges(changes);console.log(JSON.stringify(report,null,2));}
  else usage();
 }catch(e){console.error(`Text catalog: ${e.message}`);process.exitCode=1;}
}
