from pathlib import Path
import shutil,json,subprocess,hashlib
root=Path(__file__).resolve().parents[3];doc=Path(__file__).resolve().parent
preview=Path('/workspace/halfsword-weapons-preview');base=preview/'public/encounters';new=base/'royal-concepts-20261022';king=base/'returned-king-20261022';v='00ef69df'
new.mkdir(exist_ok=True)
for dest in [new,king]:shutil.copytree(root/'dist',dest/'game',dirs_exist_ok=True)
for id in ['bernardo','black_king']:
 for angle in ['front','angle','rear']:shutil.copy2(doc/angle/(id+'.png'),new/(id+'-'+angle+'.png'))
 for filename in ['game-model-close.png','game-detail.png','foe-gameplay.png','hero-gameplay.png']:shutil.copy2(doc/id/filename,new/(id+'-'+filename))
for angle,name in [('front','front'),('angle','side'),('rear','rear')]:shutil.copy2(doc/angle/'sebastian.png',king/(name+'.png'))
# Preserve the immediately preceding lion model in the same gameplay camera.
shutil.copy2(root/'docs/design/warrior_refine_20261022/king/game-detail.png',king/'before-detail.png')
for filename in ['game-model-close.png','game-detail.png','foe-gameplay.png','hero-gameplay.png']:shutil.copy2(doc/'sebastian'/filename,king/filename)
style='''@font-face{font-family:p;src:url('./game/fonts/Pretendard-Regular.subset.woff2')}*{box-sizing:border-box}body{margin:0;background:#201d19;color:#ddcfb1;font-family:p,serif;line-height:1.8}main{max-width:1200px;margin:auto;padding:28px 20px 60px}h1{font-size:clamp(28px,5vw,42px);font-weight:500;margin:0 0 8px}h2{font-weight:500;font-size:24px;margin:0}p{color:#bdb096;margin:10px 0 20px}.kicker{color:#a88c55;font-size:14px;letter-spacing:.12em}nav{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}nav a{border:1px solid #a68d5d;box-shadow:inset 0 0 0 3px #211d18;background:#342c23;padding:9px 16px;text-decoration:none;color:inherit}figure{margin:18px 0}img{width:100%;height:auto;display:block;border:1px solid #5b4d39}figcaption{font-size:13px;color:#bdb096;margin-top:6px}.cards,.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}.cards section{min-width:0;border-top:1px solid #66563c;padding-top:20px}.portrait{max-width:540px;margin:20px auto}.label{border-bottom:1px solid #66563c;padding-bottom:10px;margin-top:28px;font-size:19px}a{color:inherit}summary{cursor:pointer;color:#c9b68f;padding:10px 0}blockquote{border-left:2px solid #977743;margin:24px 0;padding:10px 16px;background:#29221b}@media(max-width:700px){main{padding:20px 14px}.cards{grid-template-columns:1fr;gap:32px}.pair{gap:10px}nav a{flex:1;text-align:center}.pair figcaption{font-size:12px}}'''
def img(path,alt,cap,cls=''):
 return f'<figure class="{cls}"><a href="{path}?v={v}"><img src="{path}?v={v}" alt="{alt}" loading="lazy"></a><figcaption>{cap}</figcaption></figure>'
def buttons(id):
 return f'<nav><a href="game/?test=1&weapon=longsword&foe={id}&stage=cathedral&uniqueStage=5&nosw=1&review={v}">상대로 만나기</a><a href="game/?test=1&hero={id}&weapon=tizona&foe=bran&foeWeapon=tree_branch&stage=cathedral&uniqueStage=5&nosw=1&review={v}">직접 조작하기</a></nav>'
def wrap(title,body):return f'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Stillness</title><style>{style}</style><main>{body}</main></html>'
body='<div class="kicker">STILLNESS · 새 중갑 기사</div><h1>두 번째와 세 번째 시안</h1><p>앞서 고른 두 외형을 실제 게임 모델로 만들었습니다.</p><div class="cards">'
for id,num,name,desc in [('bernardo','02','베르나르도 · 사슬의 영웅','청회색 갑옷과 짧은 어깨 망토. 왼팔에는 끊어진 사슬이 남았습니다.'),('black_king','03','검은 왕','검은 금장 갑옷과 청록 망토. 다섯 방패 문장과 흰 깃털이 왕실의 위엄을 드러냅니다.')]:
 body+=f'<section id="{id}"><div class="kicker">{num}</div><h2>{name}</h2><p>{desc}</p>'
 body+=img(id+'-game-model-close.png',name+' 실제 게임 모델','실제 전투 장면 · 카메라를 가까이 옮겨 촬영했습니다.')+buttons(id)
 body+=img(id+'-front.png',name+' 정면','모델 관찰 사진 · 두 인물 모두 같은 정면 축척과 중립 조명입니다.','portrait')
 body+='<details><summary>디테일과 다른 각도 보기</summary>'+img(id+'-game-detail.png',name+' 투구와 상체','실제 게임의 투구·상체 확대')+'<div class="pair">'+img(id+'-angle.png',name+' 사선','관찰 사진 · 사선')+img(id+'-rear.png',name+' 뒤','관찰 사진 · 뒤쪽')+'</div></details></section>'
body+='</div><p>두 인물 모두 티소나와 기존 이베리아 검술을 사용합니다. 대성당은 임시 대련장입니다. 정식 여정 배치와 최종 난이도는 추후 정하며, 3번의 독립 인물명은 임시로 ‘검은 왕’으로 표기했습니다.</p><nav><a href="../returned-king-20261022/?v='+v+'">수정한 세바스티앙 보기</a></nav>'
(new/'index.html').write_text(wrap('두 왕의 시안',body))
body='<div class="kicker">STILLNESS · 이베리아 중갑 기사</div><h1>세바스티앙 <small>돌아온 왕</small></h1><p>사자 머리를 덜어내고, 견갑 위에 짧은 상아색 금속 돌기를 세웠습니다.</p>'
body+=img('game-model-close.png','수정한 세바스티앙 실제 게임 모델','실제 게임 장면 · 외형을 자세히 보도록 카메라를 옮겼습니다.')+buttons('sebastian')
body+='<p>티소나 · 이베리아 유파 · 전신 판금<br>대성당은 임시 대련장입니다. 여정 저장은 바뀌지 않습니다.</p><div class="label">어깨 장식 · 같은 게임 카메라</div><div class="pair">'+img('before-detail.png','이전 사자 머리 장식','이전 · 사자 머리 조각')+img('game-detail.png','짧은 상아색 금속 돌기','수정 · 약 4cm 솟은 단순한 돌기와 금테 받침')+'</div>'
body+=img('front.png','세바스티앙 정면 전신','중립 조명과 공통 정면 축척에서 촬영한 실제 모델입니다.','portrait')
body+='<details><summary>옆·뒤 모습 보기</summary><div class="pair">'+img('side.png','세바스티앙 사선','사선 · 단순해진 어깨 실루엣')+img('rear.png','세바스티앙 뒤쪽','뒤쪽 · 상아빛 말총과 포도주색 망토')+'</div></details><blockquote>“성문을 열어라. 아직 돌아올 자들이 있다.”</blockquote><p>군대가 사라진 뒤 왕만 홀로 돌아왔습니다. 갑옷과 망토는 출정하던 날 그대로였지만, 투구는 끝내 열리지 않았습니다.</p><nav><a href="../royal-concepts-20261022/?v='+v+'">2번·3번 모델 보기</a></nav>'
(king/'index.html').write_text(wrap('돌아온 왕',body))
source={'source':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'branch':'codex/royal-models-20261022','shoulderSource':'4ab01aac','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'src').glob('*royal*.js')},'reviewGuests':['bernardo','black_king'],'existingGuest':'sebastian','uhwaHandoff':False}
for d in [king,new]:(d/'source.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
print(new,king)
