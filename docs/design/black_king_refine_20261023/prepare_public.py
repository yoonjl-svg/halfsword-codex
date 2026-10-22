from pathlib import Path
import shutil, json, subprocess, hashlib

root=Path(__file__).resolve().parents[3]; doc=Path(__file__).resolve().parent
preview=Path('/workspace/halfsword-weapons-preview/public/encounters/black-king-20261023')
preview.mkdir(parents=True,exist_ok=True)
shutil.copytree(root/'dist',preview/'game',dirs_exist_ok=True,ignore=lambda path,names:[n for n in names if Path(path)==root/'dist' and n in {'corr','r2p','support','wb','encounters'}])
for name in ['corr','r2p','support','wb','encounters']:
    if (preview/'game'/name).is_dir(): shutil.rmtree(preview/'game'/name)
isolate='''<script>(()=>{
const prefix='stillness.preview.black-king.20261023:';let native;try{native=window.localStorage}catch{}
const memory=new Map(),keys=()=>native?Object.keys(native).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length)):[...memory.keys()];
const store={getItem(k){try{return native?native.getItem(prefix+String(k)):(memory.get(String(k))??null)}catch{return memory.get(String(k))??null}},setItem(k,v){k=String(k);v=String(v);memory.set(k,v);try{native?.setItem(prefix+k,v)}catch{}},removeItem(k){memory.delete(String(k));try{native?.removeItem(prefix+String(k))}catch{}},clear(){for(const k of keys())this.removeItem(k)},key(i){return keys()[i]??null},get length(){return keys().length}};
Object.defineProperty(window,'localStorage',{value:store});
})();</script>'''
p=preview/'game/index.html';p.write_text(p.read_text().replace('<head>','<head>\n'+isolate,1))
for kind in ['front','angle','rear']:
    shutil.copy2(doc/kind/'black_king.png',preview/(kind+'.png'))
    shutil.copy2(root/'docs/design/royal_models_20261022'/kind/'black_king.png',preview/('before-'+kind+'.png'))
for name in ['game-model-close','game-detail','foe-gameplay','hero-gameplay']:
    shutil.copy2(doc/'black_king'/(name+'.png'),preview/(name+'.png'))
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
source={'featureCommit':'87d510baa36a3b4d9f53f9c2091a1f885b0cd36d','snapshotCommit':sha,'look':'black_king:v2','files':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'src').rglob('*.js'))}}
(preview/'source.json').write_text(json.dumps(source,indent=2)+'\n');(doc/'source.json').write_text(json.dumps(source,indent=2)+'\n')
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>검은 왕 · Stillness</title>
<style>@font-face{font-family:p;src:url('./game/fonts/Pretendard-Regular.subset.woff2')}*{box-sizing:border-box}body{margin:0;background:#211d1c;color:#dfd1b8;font:16px/1.8 p,serif}main{max-width:1100px;margin:auto;padding:28px 18px 60px}h1{font-size:38px;font-weight:500;margin:4px 0}h2{font-size:22px;font-weight:500}p{color:#bfb09c}a{color:inherit}nav{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}nav a{background:#352b29;border:1px solid #a18b60;padding:10px 18px;text-decoration:none;text-align:center}figure{margin:22px 0}img{display:block;width:100%;height:auto;border:1px solid #65564a}figcaption{font-size:13px;color:#bfb09c;margin-top:6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.palette{display:flex;flex-wrap:wrap;gap:18px;margin:20px 0}.palette span{display:flex;align-items:center;gap:8px;font-size:14px}.palette i{display:inline-block;width:24px;height:24px;border:1px solid #8d806d;background:var(--c)}summary{cursor:pointer;color:#cfba97;padding:12px 0}.kicker{color:#b19b74;font-size:13px;letter-spacing:.14em}@media(max-width:600px){main{padding:20px 14px}.pair{gap:8px}nav a{flex:1 0 42%;padding:10px 8px}h1{font-size:30px}.palette{gap:12px}.pair figcaption{font-size:12px}}</style>
<main><div class="kicker">STILLNESS · 왕실 갑주</div><h1>검은 왕</h1><p>먹빛 갑옷과 자수정색 망토. 흰 깃과 오래된 금빛 문장을 남긴 젊은 왕입니다.</p>
<figure><a href="game-model-close.png"><img src="game-model-close.png" alt="자수정색 망토를 입은 검은 왕 실제 게임 장면"></a><figcaption>실제 게임 화면 · 전투 중 카메라를 가까이 옮겨 촬영했습니다.</figcaption></figure>
<nav><a href="game/?test=1&weapon=longsword&foe=black_king&stage=cathedral&uniqueStage=5&nosw=1">상대로 만나기</a><a href="game/?test=1&hero=black_king&weapon=tizona&foe=bran&foeWeapon=tree_branch&stage=cathedral&uniqueStage=5&nosw=1">직접 조작하기</a></nav>
<p>티소나와 기존 이베리아 검술을 사용하는 외형 검토판입니다. 대성당은 임시 대련장입니다.</p>
<div class="palette"><span><i style="--c:#353237"></i>먹빛 철갑</span><span><i style="--c:#59445f"></i>자수정색 천</span><span><i style="--c:#a18b60"></i>낡은 금</span><span><i style="--c:#e2ddd0"></i>상아색 깃</span></div>
<h2>이전과 지금</h2><p>가슴 문장에 시선을 모으고, 하체의 반복 금장은 어둡게 눌렀습니다. 목의 천깃과 얼굴을 다듬고, 판금 이음선·리벳·망토 브로치를 보강했습니다.</p>
<div class="pair"><figure><a href="before-front.png"><img src="before-front.png" alt="이전 청록 망토의 검은 왕 정면"></a><figcaption>이전 · 청록과 밝은 반복 금장</figcaption></figure><figure><a href="front.png"><img src="front.png" alt="수정한 자수정색 검은 왕 정면"></a><figcaption>수정 · 동일 축척·조명의 모델 관찰 사진</figcaption></figure></div>
<figure><a href="game-detail.png"><img src="game-detail.png" alt="검은 왕 투구와 상체 확대" loading="lazy"></a><figcaption>실제 게임 확대 · 깃대 결, 투구 테두리, 다섯 방패와 망토 고정 장식</figcaption></figure>
<details><summary>사선과 뒤쪽 보기</summary><div class="pair"><figure><a href="angle.png"><img src="angle.png" alt="검은 왕 사선" loading="lazy"></a><figcaption>모델 관찰 사진 · 사선</figcaption></figure><figure><a href="rear.png"><img src="rear.png" alt="검은 왕 뒤쪽 망토" loading="lazy"></a><figcaption>모델 관찰 사진 · 뒤쪽</figcaption></figure></div></details>
<nav><a href="../royal-concepts-20261022/#black_king">이전 검은 왕 보기</a><a href="../returned-king-20261022/">세바스티앙과 비교</a></nav>
</main></html>'''
(preview/'index.html').write_text(html)
print(preview)
