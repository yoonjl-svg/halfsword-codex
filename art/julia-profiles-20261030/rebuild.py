"""Rebuild the two approved portrait layers. --check compares RGBA pixels without modifying originals."""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,sys,hashlib
R=Path(__file__).parent;check='--check' in sys.argv;F=Image.open(R/'frame1.png').convert('RGBA');fa=np.array(F)
assert hashlib.sha256((R/'frame1.png').read_bytes()).hexdigest()=='8d6ec8d1290906183aabf1ab03db477d12a0cf922dece76f2e0053efc1b41a54'
def framed(im):
 out=Image.new('RGBA',(1254,1254));out.alpha_composite(im,(77,77));out.alpha_composite(F);return out
rows=[]
for id in ['julia','julia_mad']:
 p=R/id;s=json.loads((p/'sprites.json').read_text());a=np.array(s['cells'],dtype='uint8');assert a.shape==(22,22,4);assert set(np.unique(a[:,:,3]))=={0,255}
 m=Image.open(p/'master.png').convert('RGBA').resize((1100,1100),Image.Resampling.LANCZOS);inside=Image.new('RGBA',(1100,1100));inside.alpha_composite(m,(0,65))
 original=framed(inside);low=framed(Image.fromarray(a).resize((1100,1100),Image.Resampling.NEAREST))
 overlay=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(overlay)
 for n in range(23):
  q=77+n*50;d.line([(q,77),(q,1177)],fill=(141,216,221,125),width=2);d.line([(77,q),(1177,q)],fill=(141,216,221,125),width=2)
 oa=np.array(overlay);oa[fa[:,:,3]>0]=0;grid=Image.alpha_composite(low,Image.fromarray(oa))
 for name,im in [('original',original),('low',low),('grid',grid)]:
  if check:assert np.array_equal(np.array(im),np.array(Image.open(p/(name+'.png')).convert('RGBA'))),(id,name)
  else:im.save(p/(name+'.png'),optimize=True)
  assert np.array_equal(np.array(im)[fa[:,:,3]==255],fa[fa[:,:,3]==255])
 review=s['review'];eyes=review['eyes'] if isinstance(review['eyes'],list) else review['eyes']['cells']
 for x,y in eyes:assert a[y,x,3]==255 and a[y,x,:3].mean()<110 and 4<=review['chinRow']-y<=6
 assert np.count_nonzero(a[21,:,3])>=21
 rows.append({'id':id,'originalLowGridPixelExact':check,'eyes':eyes,'chinRow':review['chinRow'],'transparent':True,'fixedGrid':True,'frameIdentical':True})
print(json.dumps(rows,indent=2))
