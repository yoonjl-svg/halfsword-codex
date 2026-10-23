"""A separate eye treatment; never overwrite the current gallery candidate."""
from pathlib import Path
from copy import deepcopy
from PIL import Image,ImageDraw,ImageFont
import json,numpy as np,shutil,hashlib

ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/art/hero_profiles_20261023/eye-alternative'
ART=ROOT/'public/encounters/pixel-profiles-low128-20261017'
OUT=ROOT/'public/encounters/hero-profiles-20261023/olivier-eye-alternative'
DOC.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
rec=deepcopy(json.loads((DOC.parent/'sprites.json').read_text())['characters']['black_king'])
edits=[]
def paint(color,coords,why):
    c=[*bytes.fromhex(color),255]
    if c not in rec['palette']:rec['palette'].append(c)
    for x,y in coords:
        before=rec['palette'][rec['cells'][y][x]]
        if before==c:continue
        rec['cells'][y][x]=rec['palette'].index(c)
        edits.append({'cell':[x,y],'before':before,'after':c,'reason':why})

paint('A67553',[(11,7),(12,7),(13,7),(15,8),(16,8)],'Separate the previous horizontal brow/eye blocks with warm skin.')
paint('5C4030',[(11,6),(12,6),(15,7)],'Warm brown eyebrows above, distinct from the darker eyes below.')
paint('805335',[(16,7)],'Taper the far eyebrow into the temple shadow.')
paint('4F3829',[(11,8)],'Soft inner corner of the near eye.')
paint('241E1C',[(12,8),(15,9)],'Small dark pupils, with no bright sclera.')
paint('A67553',[(13,7),(16,8)],'Leave a full skin row between brow and eye, avoiding connected T-shaped marks.')
paint('6E503B',[(13,8),(16,9)],'Muted brown lower-lid planes; no white squares or vertical T-shaped eye.')
rec['review']['eyes']={'policy':'visible','cells':[[12,8],[15,9]],'note':'Alternative: separate warm eyebrows and narrow dark eyes, no bright sclera.'}
rec['review']['status']='alternative-user-review-pending'
(DOC/'sprite.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
(DOC/'changes.json').write_text(json.dumps(edits,ensure_ascii=False,indent=2)+'\n')
rgba=np.array([[rec['palette'][i] for i in row] for row in rec['cells']],dtype=np.uint8)
frame=Image.open(ART/'frame1.png').convert('RGBA');fa=np.array(frame)
sprite=Image.fromarray(rgba);sprite.save(DOC/'cells.png')
low=Image.new('RGBA',(1254,1254));low.alpha_composite(sprite.resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame)
low.save(OUT/'low.png',optimize=True)
overlay=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(overlay)
for i in range(23):
    p=77+50*i;d.line([(p,77),(p,1177)],fill=(141,216,221,122),width=2);d.line([(77,p),(1177,p)],fill=(141,216,221,122),width=2)
oa=np.array(overlay);oa[fa[:,:,3]>0]=0
Image.alpha_composite(low,Image.fromarray(oa)).save(OUT/'grid.png',optimize=True)
shutil.copy2(ART/'black_king/original.png',OUT/'original.png')
arr=np.array(low)
assert np.array_equal(arr[fa[:,:,3]==255],fa[fa[:,:,3]==255])
for y in range(22):
    for x in range(22):
        ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);mask=fa[ys,xs,3]==0
        assert np.all(arr[ys,xs][mask]==rgba[y,x])
assert set(np.unique(rgba[:,:,3])).issubset({0,255})
f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',24)
sheet=Image.new('RGB',(1000,550),'#22201c');d=ImageDraw.Draw(sheet)
for col,(label,img) in enumerate([('아래 점을 뺀 버전',Image.open(ART/'black_king/low.png').convert('RGBA')),('새 시안 · 눈썹과 눈 분리',low)]):
    d.text((24+col*500,11),label,font=f,fill='#dfd5c3');tile=img.resize((490,490),Image.Resampling.LANCZOS);sheet.paste(tile,(5+col*500,55),tile)
sheet.save(OUT/'comparison.png')
(DOC/'validation.json').write_text(json.dumps({'grid':[22,22],'cellPixels':50,'frameIdentical':True,'backgroundTransparent':True,'originalRetained':True,'currentGalleryUnchanged':True,'edits':len(edits),'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.png')}},indent=2)+'\n')
print('Separate alternative saved; active portraits unchanged.')
