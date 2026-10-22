from pathlib import Path
import shutil,json,subprocess
root=Path(__file__).resolve().parents[3]; doc=Path(__file__).resolve().parent
preview=Path('/workspace/halfsword-weapons-preview/public/encounters/wander-20261023'); preview.mkdir(parents=True,exist_ok=True)
shutil.copytree(root/'review-dist',preview/'game',dirs_exist_ok=True, ignore=lambda path, names: [n for n in names if Path(path) == root/'review-dist' and n in {'corr','r2p','support','wb','encounters'}])
for unused in ['corr','r2p','support','wb','encounters']:
 if (preview/'game'/unused).is_dir(): shutil.rmtree(preview/'game'/unused)
# This classic head script executes before any game module. All writes, including
# skill books, equipment, campaign and auth state, use a separate preview prefix.
setup=r'''<script>
(()=>{
  const prefix='stillness.preview.wander.20261023:';
  let native; try {native=window.localStorage;} catch {}
  const memory=new Map(), keys=()=>native?Object.keys(native).filter(k=>k.startsWith(prefix)).map(k=>k.slice(prefix.length)):[...memory.keys()];
  const isolated={
    getItem(k){try{return native?native.getItem(prefix+String(k)):(memory.get(String(k))??null)}catch{return memory.get(String(k))??null}},
    setItem(k,v){k=String(k);v=String(v);memory.set(k,v);try{native?.setItem(prefix+k,v)}catch{}},
    removeItem(k){memory.delete(String(k));try{native?.removeItem(prefix+String(k))}catch{}},
    clear(){for(const k of keys())this.removeItem(k)},
    key(i){return keys()[i]??null},get length(){return keys().length}
  };
  Object.defineProperty(window,'localStorage',{value:isolated});
  const key='stillness.lobby.progress.v1';
  const bosses={artoria:'excalibur',sebastian:'tizona',white_scale:'muramasa'};
  const selected=new URLSearchParams(location.search).get('opponent');
  let value;try{value=JSON.parse(isolated.getItem(key))}catch{}
  if(!value){value={version:1,coins:100,heads:0,acquisitions:[],titles:[],title:'여행자',wander:{unlocked:true,legacyChecked:true,cleared:__STAGES__,run:null}};
    isolated.setItem('stillness.journey.checkpoint.v1',JSON.stringify({version:1,stage:'poseidon'}));
  }
  if(bosses[selected])value.wander.run={id:crypto.randomUUID(),round:1,wins:0,stage:'poseidon',foe:selected,foeWeapon:bosses[selected],weapon:null,cards:null,lastWeapon:null,status:'active',headTaken:false,reward:null};
  isolated.setItem(key,JSON.stringify(value));
  history.replaceState(null,'',location.pathname+'?title=1&nosw=1');
})();
</script>'''
stages=subprocess.check_output(['node','--input-type=module','-e',"import {STAGE_ORDER} from './src/stages.js';console.log(JSON.stringify(STAGE_ORDER))"],cwd=root,text=True).strip()
setup=setup.replace('__STAGES__',stages)
p=preview/'game/index.html';p.write_text(p.read_text().replace('<head>','<head>\n'+setup,1))
for name in ['unlocked-lobby-844','boss-reward','wander-sebastian','locked-lobby']:
 shutil.copy2(doc/(name+'.png'),preview/(name+'.png'))
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>방랑 · Stillness</title>
<style>@font-face{font-family:p;src:url('./game/fonts/Pretendard-Regular.subset.woff2')}*{box-sizing:border-box}body{margin:0;background:#211d18;color:#ddcfb1;font:16px/1.8 p,serif}main{max-width:1100px;margin:auto;padding:28px 18px 60px}h1{font-size:38px;font-weight:500;margin:6px 0}h2{font-size:21px;font-weight:500}p{color:#beaf95}a{color:inherit}nav{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}nav a{background:#352c21;border:1px solid #a68c58;padding:10px 18px;text-decoration:none;text-align:center}figure{margin:24px 0}img{display:block;width:100%;height:auto;border:1px solid #6f5c3c}figcaption{font-size:13px;color:#beaf95}ul{padding-left:22px}@media(max-width:600px){nav a{flex:1 0 42%}h1{font-size:30px}}</style>
<main><p>STILLNESS · 전체 클리어 이후</p><h1>방랑</h1><p>익숙한 장소에서, 뜻밖의 검객과 마주합니다.<br>무대와 상대를 각각 무작위로 골라 대면을 이어갑니다. 이름은 아직 작업명입니다.</p>
<nav><a href="game/">방랑 체험하기</a></nav>
<p>체험판은 방랑이 열린 대기실에서 시작합니다. 본래 게임의 금화·아이템·스테이지 기록과 별도로 저장됩니다.</p>
<figure><a href="unlocked-lobby-844.png"><img src="unlocked-lobby-844.png" alt="대기실의 Stage 입장과 방랑 버튼"></a><figcaption>실제 모바일 화면 · 기존 Stage 입장 아래에 방랑을 따로 배치했습니다.</figcaption></figure>
<h2>대면과 보상</h2><ul><li>일반 무대 전체 클리어 후 개방됩니다.</li><li>승리 금화 10~30, 참수 재화 2개. 패배 차감은 기존 1~5금화입니다.</li><li>아르토리아·세바스티앙 승리 시 금화 200 추가.</li><li>몽골 장수 ‘백린의 전사’ 승리 시 목 5개 추가. 참수 여부와 무관합니다.</li><li>이기면 다음 대면, 패배하면 방랑 종료. 도중에 대기실로 돌아오면 이어갈 수 있습니다.</li></ul>
<figure><a href="boss-reward.png"><img src="boss-reward.png" alt="세바스티앙 승리와 특별 보상 표시"></a><figcaption>보상 표시 확인 화면 · 승리 상태를 재현해 지급·저장 연결을 검증했습니다.</figcaption></figure>
<h2>특별한 상대부터 만나기</h2><p>첫 대면만 지정한 상대로 시작합니다. 그다음부터는 무작위입니다. 각 버튼은 체험용 연속 대전을 새로 시작합니다.</p>
<nav><a href="game/?opponent=artoria">아르토리아</a><a href="game/?opponent=sebastian">세바스티앙</a><a href="game/?opponent=white_scale">몽골 장수</a></nav>
<figure><a href="wander-sebastian.png"><img src="wander-sebastian.png" alt="포세이돈 신전에서 만난 세바스티앙"></a><figcaption>실제 게임 장면 · 전용 무대에 묶이지 않는 대면입니다.</figcaption></figure>
</main></html>'''
(preview/'index.html').write_text(html)
print(preview)
