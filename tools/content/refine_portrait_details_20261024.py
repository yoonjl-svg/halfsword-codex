"""User-requested helmet volume and exact outer-eye pixel movements."""
from pathlib import Path
from copy import deepcopy
from PIL import Image,ImageDraw,ImageFont
import json,subprocess,io,shutil,numpy as np,hashlib

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/art/hero_profiles_20261023'
DOC=BASE/'details-20261024';DOC.mkdir(exist_ok=True)
ART=ROOT/'public/encounters/pixel-profiles-low128-20261017'
OUT=ROOT/'public/encounters/hero-profiles-20261023/details-20261024';OUT.mkdir(exist_ok=True)
spec=json.loads(subprocess.check_output(['git','show','fea908b0:docs/art/hero_profiles_20261023/sprites.json'],cwd=ROOT))
def setcell(rec,x,y,c):
    old=rec['palette'][rec['cells'][y][x]]
    if c not in rec['palette']:rec['palette'].append(c)
    rec['cells'][y][x]=rec['palette'].index(c)
    return {'cell':[x,y],'before':old,'after':c}
r=spec['characters']['sebastian'];edits=[]
for x,y,c in [(13,4,'B1A38C'),(12,4,'A69B87'),(11,4,'938C7E'),(10,4,'898679'),(9,5,'9D9685'),(8,6,'AAA18F'),(7,8,'978E7D'),(7,9,'8E8778'),(7,10,'7A7468')]:
    edits.append(setcell(r,x,y,[*bytes.fromhex(c),255]))
assert r['palette'][r['cells'][7][7]]==[24,27,28,255]
r['review']['notes']+=' Left helmet dome/side shading refined in a single-cell contour; previous visor pixels retained.'
(BASE/'sprites.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
(DOC/'roland-changes.json').write_text(json.dumps({'base':'fea908b0','edits':edits,'specifiedBlackEyeTipPreserved':True},indent=2)+'\n')
subprocess.run(['python3','tools/content/build_hero_profiles_20261023.py'],cwd=ROOT,check=True)

rec=deepcopy(json.loads((BASE/'eye-alternative-up2/sprite.json').read_text()))
before=np.array([[rec['palette'][i] for i in row] for row in rec['cells']],dtype=np.uint8)
edits=[]
for x,y in [(13,6),(16,7)]:
    color=rec['palette'][rec['cells'][y][x]]
    assert color==[110,80,59,255]
    edits.append(setcell(rec,x,y,[166,117,83,255]))
    edits.append(setcell(rec,x,y+1,color))
for x,y in [(13,7),(16,8)]:
    edits.append(setcell(rec,x,y,[79,56,41,255]))
rec['review']['notes']+=' Last raised-eye candidate: only the rightmost pixel of each eye moved down one row.'
rec['review']['notes']+=' Follow-up: darken only those two lowered pixels from #6E503B to #4F3829.'
(DOC/'olivier-sprite.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
(DOC/'olivier-changes.json').write_text(json.dumps({'base':'eye-alternative-up2','edits':edits},indent=2)+'\n')
rgba=np.array([[rec['palette'][i] for i in row] for row in rec['cells']],dtype=np.uint8)
ys,xs=np.where(np.any(before!=rgba,axis=2))
assert set(zip(xs.tolist(),ys.tolist()))=={(13,6),(13,7),(16,7),(16,8)}
frame=Image.open(ART/'frame1.png').convert('RGBA');fa=np.array(frame)
sprite=Image.fromarray(rgba);sprite.save(DOC/'olivier-cells.png')
low=Image.new('RGBA',(1254,1254));low.alpha_composite(sprite.resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame)
dst=OUT/'olivier';dst.mkdir(exist_ok=True);low.save(dst/'low.png',optimize=True)
overlay=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(overlay)
for i in range(23):
    p=77+50*i;d.line([(p,77),(p,1177)],fill=(141,216,221,122),width=2);d.line([(77,p),(1177,p)],fill=(141,216,221,122),width=2)
oa=np.array(overlay);oa[fa[:,:,3]>0]=0
Image.alpha_composite(low,Image.fromarray(oa)).save(dst/'grid.png',optimize=True)
shutil.copy2(ART/'black_king/original.png',dst/'original.png')
arr=np.array(low);assert np.array_equal(arr[fa[:,:,3]==255],fa[fa[:,:,3]==255])
for y in range(22):
    for x in range(22):
        ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);mask=fa[ys,xs,3]==0
        assert np.all(arr[ys,xs][mask]==rgba[y,x])
assert np.array_equal(before[:,:,3],rgba[:,:,3])
oldroland=Image.open(io.BytesIO(subprocess.check_output(['git','show','fea908b0:public/encounters/pixel-profiles-low128-20261017/sebastian/low.png'],cwd=ROOT))).convert('RGBA')
oldolivier=Image.open(ROOT/'public/encounters/hero-profiles-20261023/olivier-eye-alternative-up2/low.png').convert('RGBA')
f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',24)
sheet=Image.new('RGB',(1000,1110),'#22201c');d=ImageDraw.Draw(sheet)
d.text((28,15),'이전',font=f,fill='#b9ae9b');d.text((520,15),'이번 수정',font=f,fill='#dfd5c3')
for row,(name,old,new) in enumerate([('롤랑 · 투구 왼쪽 양감',oldroland,Image.open(ART/'sebastian/low.png').convert('RGBA')),('올리비에 · 양쪽 눈 오른쪽 끝 한 칸 아래',oldolivier,low)]):
    y=57+row*520;d.text((28,y),name,font=f,fill='#dfd5c3')
    for col,img in enumerate([old,new]):
        tile=img.resize((490,490),Image.Resampling.LANCZOS);sheet.paste(tile,(5+col*500,y+30),tile)
sheet.save(OUT/'comparison.png')
(DOC/'validation.json').write_text(json.dumps({'rolandContourCells':9,'rolandEyeTipPreserved':True,'olivierMovedPixels':[[13,6,13,7],[16,7,16,8]],'olivierOnlyFourCellsChanged':True,'frameAndGridValidated':True,'alphaUnchanged':True,'originalPreserved':True,'files':{str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*.png')}},indent=2)+'\n')
print('Roland contour and both Olivier outer corners updated; requested scope verified.')
