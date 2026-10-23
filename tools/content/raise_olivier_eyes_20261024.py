"""Translate the alternative's two eye regions up exactly two fixed cells."""
from pathlib import Path
from copy import deepcopy
from PIL import Image,ImageDraw,ImageFont
import json,numpy as np,shutil,hashlib

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/art/hero_profiles_20261023/eye-alternative'
DOC=ROOT/'docs/art/hero_profiles_20261023/eye-alternative-up2'
ART=ROOT/'public/encounters/pixel-profiles-low128-20261017'
BEFORE=ROOT/'public/encounters/hero-profiles-20261023/olivier-eye-alternative'
OUT=ROOT/'public/encounters/hero-profiles-20261023/olivier-eye-alternative-up2'
DOC.mkdir(exist_ok=True);OUT.mkdir(exist_ok=True)
rec=deepcopy(json.loads((BASE/'sprite.json').read_text()))
before=np.array([[rec['palette'][i] for i in row] for row in rec['cells']],dtype=np.uint8)
after=before.copy()
regions=[(11,6,14,9),(15,7,17,10)] # x0,y0,x1,y1, exclusive bounds
# Fill vacated cells first; paste from the saved original, never in place.
for x0,y0,x1,y1 in regions:
    after[y0:y1,x0:x1]=[166,117,83,255]
after[9,15]=[193,138,95,255]
after[9,16]=[128,83,53,255]
for x0,y0,x1,y1 in regions:
    after[y0-2:y1-2,x0:x1]=before[y0:y1,x0:x1]
    assert np.array_equal(after[y0-2:y1-2,x0:x1],before[y0:y1,x0:x1])
allowed=np.zeros((22,22),dtype=bool)
for x0,y0,x1,y1 in regions:allowed[y0-2:y1,x0:x1]=True
assert np.array_equal(after[~allowed],before[~allowed])
for y in range(22):
    for x in range(22):
        c=after[y,x].tolist()
        if c not in rec['palette']:rec['palette'].append(c)
        rec['cells'][y][x]=rec['palette'].index(c)
rec['review']['eyes']['cells']=[[12,6],[15,7]]
rec['review']['eyes']['note']='Same alternative eye regions, including eyebrows and lids, translated up exactly two cells.'
rec['review']['status']='user-review-pending'
(DOC/'sprite.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
frame=Image.open(ART/'frame1.png').convert('RGBA');fa=np.array(frame)
sprite=Image.fromarray(after);sprite.save(DOC/'cells.png')
low=Image.new('RGBA',(1254,1254));low.alpha_composite(sprite.resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame)
low.save(OUT/'low.png',optimize=True)
overlay=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(overlay)
for i in range(23):
    p=77+50*i;d.line([(p,77),(p,1177)],fill=(141,216,221,122),width=2);d.line([(77,p),(1177,p)],fill=(141,216,221,122),width=2)
oa=np.array(overlay);oa[fa[:,:,3]>0]=0
Image.alpha_composite(low,Image.fromarray(oa)).save(OUT/'grid.png',optimize=True)
shutil.copy2(BEFORE/'original.png',OUT/'original.png')
arr=np.array(low);assert np.array_equal(arr[fa[:,:,3]==255],fa[fa[:,:,3]==255])
for y in range(22):
    for x in range(22):
        ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);mask=fa[ys,xs,3]==0
        assert np.all(arr[ys,xs][mask]==after[y,x])
assert np.array_equal(before[:,:,3],after[:,:,3])
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',24)
sheet=Image.new('RGB',(1000,550),'#22201c');d=ImageDraw.Draw(sheet)
for col,(label,img) in enumerate([('새 시안 · 이동 전',Image.open(BEFORE/'low.png').convert('RGBA')),('눈 부위 두 칸 위로',low)]):
    d.text((24+col*500,11),label,font=font,fill='#dfd5c3');tile=img.resize((490,490),Image.Resampling.LANCZOS);sheet.paste(tile,(5+col*500,55),tile)
sheet.save(OUT/'comparison.png')
ys,xs=np.where(np.any(before!=after,axis=2))
report={'translationCells':[0,-2],'translationPixels':[0,-100],'regions':regions,'eyeShapeTranslatedExactly':True,'changedCells':list(zip(xs.tolist(),ys.tolist())),'outsideEyeRegionsUnchanged':True,'frameIdentical':True,'alphaIdentical':True,'grid':[22,22],'cellPixels':50,'originalRetained':True,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.png')}}
(DOC/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('Both complete eye regions shifted exactly 2 cells / 100 pixels upward; outside regions unchanged.')
