from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,hashlib,shutil
R=Path(__file__).parent; B=R.parent.parent
base=np.array(json.loads((B/'sprites.json').read_text())['b']['cells'],dtype=np.uint8)
previous=np.array(json.loads((R.parent/'b-04/sprites.json').read_text())['cells'],dtype=np.uint8)
a=previous.copy();base=previous.copy(); edits=[]
def p(x,y,c,reason):
 v=[*bytes.fromhex(c),255] if c else [0,0,0,0]
 if list(a[y,x])!=v:edits.append({'x':x,'y':y,'before':a[y,x].tolist(),'after':v,'reason':reason});a[y,x]=v
# Only eyes and mouth change. All approved silhouette and other facial cells remain.
for x,y,c in [(15,8,'fbcdab'),(15,9,'fbcdab'),(15,10,'4a3027'),(13,11,'e9b795'),(13,12,'b67f63'),(14,12,'9b5e47'),(15,12,'b47a5b')]:
 p(x,y,c,'Restore one-row eye stagger; far eye only row10; subtle smile corner without hooked mouth')
frame=Image.open(B/'frame1.png').convert('RGBA');fa=np.array(frame)
low=Image.new('RGBA',(1254,1254));low.alpha_composite(Image.fromarray(a).resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame);low.save(R/'low.png')
Image.fromarray(a).save(R/'cells.png');shutil.copyfile(B/'b/original.png',R/'original.png')
grid=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(grid)
for n in range(23):
 q=77+n*50;d.line([(q,77),(q,1177)],fill=(141,216,221,125),width=2);d.line([(77,q),(1177,q)],fill=(141,216,221,125),width=2)
g=np.array(grid);g[fa[:,:,3]>0]=0;Image.alpha_composite(low,Image.fromarray(g)).save(R/'grid.png')
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',26)
sheet=Image.new('RGB',(1300,710),(34,32,28));d=ImageDraw.Draw(sheet)
for i,(label,path)in enumerate([('직전 시안',R.parent/'b-04/low.png'),('쥘리아 크리스테바 · 수정',R/'low.png')]):
 im=Image.open(path).convert('RGBA').resize((625,625),Image.Resampling.LANCZOS);sheet.paste(im,(12+i*650,65),im);d.text((30+i*650,20),label,font=font,fill=(223,213,195))
sheet.save(R/'before-after.png')
review={'eyes':[[13,9],[15,10]],'faceWidthCellsManual':8,'chinRow':14,'faceSource':'b-04 except requested eye and smile cells','otherBodySource':'b-04','editedSide':'eyes and mouth only'}
(R/'sprites.json').write_text(json.dumps({'name':'쥘리아 크리스테바','cells':a.tolist(),'edits':edits,'review':review},ensure_ascii=False,indent=2)+'\n')
# Verify requested restoration, fixed grid, frame and retained original, not combat behavior.
mask=np.ones((16,22),dtype=bool)
for e in edits:
 if e['y']<16:mask[e['y'],e['x']]=False
assert np.array_equal(a[:16][mask],base[:16][mask])
assert np.array_equal(a[16:,10:],previous[16:,10:])
out=np.array(low)
for y in range(22):
 for x in range(22):
  ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);clear=fa[ys,xs,3]==0
  assert np.all(out[ys,xs][clear]==a[y,x])
assert np.array_equal(out[fa[:,:,3]==255],fa[fa[:,:,3]==255])
assert set(np.unique(a[:,:,3]))=={0,255}
assert np.count_nonzero(a[21,:,3])>=21
for x,y in review['eyes']:assert a[y,x,3]==255 and a[y,x,:3].mean()<85
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(R/'original.png')==sha(B/'b/original.png')
(R/'qa.json').write_text(json.dumps({'passed':True,'name':'쥘리아 크리스테바','grid':[22,22],'cellPixels':50,'origin':[77,77],'canvas':[1254,1254],'originalSha256':sha(R/'original.png'),'frameSha256':sha(B/'frame1.png'),'approvedAppearancePreservedOutsideEyeMouthMask':True,'eyeHeightDifferenceCells':1,'viewerRightBodyUnchanged':True,'bottomOpaqueCells':int(np.count_nonzero(a[21,:,3])),'review':review,'manualEditOperations':len(edits),'changedCellsFromPrevious':int(np.count_nonzero(np.any(a!=previous,axis=2)))},ensure_ascii=False,indent=2)+'\n')
print('pass',len(edits),'edits, one-row eye stagger, far eye one row; all other cells unchanged')
