"""Approved localized garment edit; exact head/frame and fixed22x22 low preservation."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
import json,hashlib,copy
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/art/bernardo_profile_20261024';ART=ROOT/'public/encounters/pixel-profiles-low128-20261017'
OUT=ROOT/'public/encounters/bernardo-profile-20261024';OUT.mkdir(exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
old=Image.open(ART/'black_king/original.png').convert('RGBA');gen=Image.open(DOC/'master/generated-costume.png').convert('RGBA');frame=Image.open(ART/'frame1.png').convert('RGBA')
a=np.array(old);ga=np.array(gen);fa=np.array(frame)
assert old.size==gen.size==(1254,1254)
# Draw only the two editable garment silhouettes. All other pixels retain original bytes.
cape=[(77,716),(152,691),(232,677),(280,686),(323,696),(349,673),(387,700),(427,745),(468,791),(503,829),(518,847),(486,881),(473,914),(487,974),(490,1176),(385,1176),(399,1130),(409,1067),(400,1005),(379,941),(350,902),(306,855),(250,814),(176,786),(77,768)]
chest=[(471,878),(504,858),(553,879),(628,903),(715,926),(800,940),(858,942),(896,928),(900,892),(905,871),(921,898),(942,944),(974,1010),(1006,1100),(1026,1176),(493,1176),(494,1040),(484,947)]
mask=Image.new('L',old.size);md=ImageDraw.Draw(mask);md.polygon(cape,fill=255);md.polygon(chest,fill=255)
# Preserve face, beard, hair, exposed neck, brooch, and the exact shared frame.
head=Image.new('L',old.size);hd=ImageDraw.Draw(head);hd.polygon([(260,77),(1080,77),(1080,828),(974,835),(915,850),(853,803),(758,794),(653,775),(538,749),(435,727),(381,717),(328,698),(300,680),(260,655)],fill=255)
head_a=np.array(head)>0
# Refine the coarse head outline at the cloak/hair boundary: only existing ochre fabric.
rawmask=np.array(mask)>0; rgb=a[:,:,:3].astype(int); yy,xx=np.indices(a.shape[:2])
cloth_edge=rawmask & (xx<430) & (yy>=670) & (yy<760) & (rgb[:,:,1]-rgb[:,:,2]>15) & (rgb[:,:,0]>55)
head_a[cloth_edge]=False
head=Image.fromarray((head_a*255).astype('uint8'))
md.ellipse((362,823,466,913),fill=0)
mask=mask.filter(ImageFilter.GaussianBlur(.7));ma=np.array(mask);ma[head_a]=0;ma[fa[:,:,3]>0]=0;ma[a[:,:,3]==0]=0
mask=Image.fromarray(ma);final=Image.composite(gen,old,mask);arr=np.array(final);arr[:,:,3]=a[:,:,3];final=Image.fromarray(arr);final.save(OUT/'original.png',optimize=True)
mask.save(DOC/'original-clothing-mask.png');head.save(DOC/'protected-head-mask.png')
assert np.count_nonzero(np.any(arr!=a,axis=2))>100000;assert np.array_equal(arr[head_a],a[head_a]);assert np.array_equal(arr[fa[:,:,3]>0],a[fa[:,:,3]>0]);assert np.array_equal(arr[ma==0],a[ma==0])

spec=json.loads((ROOT/'docs/art/hero_profiles_20261023/sprites.json').read_text());rec=copy.deepcopy(spec['characters']['black_king']);before=np.array([[rec['palette'][i] for i in row] for row in rec['cells']],dtype=np.uint8);rgba=before.copy();edits=[]
def put(x,y,h):
 c=[*bytes.fromhex(h),255];rgba[y,x]=c
# Warm gold replaces only the existing cloak. Preserve its shape and old brooch highlight.
cape_rows={12:{1:'A58235',2:'B8933D',3:'B18B36',4:'9B762E',5:'805D27'},13:{0:'89642A',1:'9D772F',2:'BA923A',3:'B18B36',4:'926B2C',5:'B18B36',6:'A47E32'},14:{4:'98712D',5:'BD9640',6:'A07A31',7:'87632A'},15:{5:'A68033',6:'C4A04D',7:'8F692B'},16:{5:'715025',6:'A17A30'},17:{6:'C4A04D',7:'8A6327'},18:{6:'B18B36',7:'795625'},19:{6:'A27B30',7:'B99440'},20:{6:'A88031',7:'C4A04D'},21:{6:'8B652A',7:'B18B36'}}
for y,row in cape_rows.items():
 for x,c in row.items():put(x,y,c)
# Neck/gorget row15 remains untouched. White cloth under it follows the torso angle.
cloth_rows={16:['9D8A60','D3C6AE','E6DAC4','E9DEC8','DDD1BB','CFC2AA','A89A7F'],17:['B49A62','E5D9C3','EADFCB','DDD0B8','D7CAB2','C9BCA2','BFB096','A89A7F'],18:['AC925D','E5D9C3','EEE4D1','E4D8C2','DFD2BA','D5C7AD','C5B79B','B6A68A','8F8066'],19:['B29A67','DED1B9','E9DDC7','E6D9C1','D8C9AD','D2C3A5','C2B193','B4A184','8B7A60'],20:['B19A68','D5C6AB','E5D8BE','EBDFC6','DFCFB2','CEBC9C','C4B192','B6A180','927C5C'],21:['A88D58','CBB99A','DFCCAC','E5D3B3','D9C6A5','CAB592','C2AA87','AE9674','856B4C']}
for y,colors in cloth_rows.items():
 for x,c in enumerate(colors,9):put(x,y,c)
# A tiny asymmetric crowned rampant lion: raised forepaw at left and curled tail right.
for x,y,c in [(13,17,'C5A04B'),(12,18,'302923'),(13,18,'29231F'),(11,19,'3A3027'),(13,19,'29231F'),(12,20,'302923'),(13,20,'29231F'),(14,20,'3A3027'),(15,20,'302923'),(16,20,'393029'),(11,21,'393029'),(12,21,'29231F'),(14,21,'302923'),(15,21,'393029'),(16,18,'302923'),(17,18,'3A3027'),(16,19,'393029')]:put(x,y,c)
# The head and approved eyes are immutable, including both lowered eye-corner cells.
protected=np.zeros((22,22),bool);protected[:12,:]=True;protected[12:16,8:]=True
assert np.array_equal(rgba[protected],before[protected]);assert np.array_equal(rgba[:,:,3],before[:,:,3])
for x,y in [(13,7),(16,8)]:assert rgba[y,x].tolist()==[79,56,41,255]
ys,xs=np.where(np.any(rgba!=before,axis=2))
for x,y in zip(xs.tolist(),ys.tolist()):
 c=rgba[y,x].tolist();prior=before[y,x].tolist();edits.append({'cell':[x,y],'before':prior,'after':c})
 if c not in rec['palette']:rec['palette'].append(c)
 rec['cells'][y][x]=rec['palette'].index(c)
rec['review']['status']='costume-revision-user-review-pending';rec['review']['notes']+=' Clothing-only revision: gold cloak/cream tabard/crowned black lion. Approved head, face, eyes, silhouette and crop retained.'
(DOC/'sprite.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n');(DOC/'cell-edits.json').write_text(json.dumps(edits,indent=2)+'\n')
Image.fromarray(rgba).save(DOC/'cells.png')
low=Image.new('RGBA',(1254,1254));low.alpha_composite(Image.fromarray(rgba).resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame);low.save(OUT/'low.png',optimize=True)
overlay=Image.new('RGBA',(1254,1254));dr=ImageDraw.Draw(overlay)
for i in range(23):
 p=77+50*i;dr.line([(p,77),(p,1177)],fill=(141,216,221,122),width=2);dr.line([(77,p),(1177,p)],fill=(141,216,221,122),width=2)
oa=np.array(overlay);oa[fa[:,:,3]>0]=0;Image.alpha_composite(low,Image.fromarray(oa)).save(OUT/'grid.png',optimize=True)
la=np.array(low)
for y in range(22):
 for x in range(22):
  ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);m=fa[ys,xs,3]==0;assert np.all(la[ys,xs][m]==rgba[y,x]),(x,y)
assert np.array_equal(la[fa[:,:,3]>0],np.array(Image.open(ART/'black_king/low.png'))[fa[:,:,3]>0])
# One fixed palette-cell layer; frame never coarsened.
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',25)
for name,kinds in [('comparison',['low']),('original-comparison',['original'])]:
 sheet=Image.new('RGB',(1080,604),'#25211c');sd=ImageDraw.Draw(sheet)
 for col,(label,source) in enumerate([('기존 확정본',ART/'black_king'),('복식 수정안',OUT)]):
  sd.text((28+col*540,16),label,font=font,fill='#dfd5c3');im=Image.open(source/(kinds[0]+'.png')).convert('RGBA').resize((530,530),Image.Resampling.LANCZOS);sheet.paste(im,(5+col*540,58),im)
 sheet.save(OUT/(name+'.png'))
fontsmall=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',23)
sheet=Image.new('RGB',(1080,604),'#25211c');sd=ImageDraw.Draw(sheet)
for col,(label,kind) in enumerate([('원본 · 옷 부분만 수정','original'),('low · 고정 22×22 격자','low')]):
 sd.text((28+col*540,16),label,font=fontsmall,fill='#dfd5c3');im=Image.open(OUT/(kind+'.png')).convert('RGBA').resize((530,530),Image.Resampling.LANCZOS);sheet.paste(im,(5+col*540,58),im)
sheet.save(OUT/'original-low.png')
report={'canvas':[1254,1254],'grid':{'size':[22,22],'cell':50,'origin':[77,77]},'highResolutionHeadPixelsUnchanged':True,'highResolutionOutsideMaskUnchanged':True,'framePixelsUnchanged':True,'lowHeadCellsUnchanged':True,'lowEyesUnchanged':True,'lowAlphaUnchanged':True,'highAlphaUnchanged':True,'changedLowCells':len(edits),'faceBoxCells':rec['review']['faceBoxCells'],'chinRow':rec['review']['chinRow'],'otherApprovedFilesUntouched':True,'files':{p.name:{'sha256':sha(p),'bytes':p.stat().st_size} for p in OUT.glob('*.png')}}
(DOC/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
