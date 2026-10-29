from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,hashlib
R=Path(__file__).parent
F=Image.open(R/'frame1.png').convert('RGBA'); fa=np.array(F)
OFFSETS={'a':20,'b':65,'c':70}
NAMES={'a':'1 · 온화한 노장','b':'2 · 활달한 상인','c':'3 · 차분한 상인'}
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
def make_original(k):
 m=Image.open(R/'masters'/f'{k}.png').convert('RGBA').resize((1100,1100),Image.Resampling.LANCZOS)
 inside=Image.new('RGBA',(1100,1100));inside.alpha_composite(m,(0,OFFSETS[k]))
 out=Image.new('RGBA',(1254,1254));out.alpha_composite(inside,(77,77));out.alpha_composite(F)
 (R/k).mkdir(exist_ok=True);out.save(R/k/'original.png')
 return inside

def draft_cells(im):
 a=np.array(im); small=np.zeros((22,22,4),dtype='uint8')
 for y in range(22):
  for x in range(22):
   z=a[y*50:(y+1)*50,x*50:(x+1)*50]; occupied=z[:,:,3]>150
   if occupied.mean()>.45:small[y,x]=[*np.median(z[occupied,:3],axis=0).astype('uint8'),255]
 rgb=Image.fromarray(small[:,:,:3]).quantize(colors=25,method=Image.Quantize.MEDIANCUT).convert('RGB')
 small[:,:,:3]=np.array(rgb);small[small[:,:,3]==0,:3]=0
 return small

def output(k,rgba):
 Image.fromarray(rgba).save(R/k/'cells.png')
 interior=Image.fromarray(rgba).resize((1100,1100),Image.Resampling.NEAREST)
 low=Image.new('RGBA',(1254,1254));low.alpha_composite(interior,(77,77));low.alpha_composite(F);low.save(R/k/'low.png',optimize=True)
 overlay=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(overlay)
 for n in range(23):
  q=77+n*50;d.line([(q,77),(q,1177)],fill=(141,216,221,125),width=2);d.line([(77,q),(1177,q)],fill=(141,216,221,125),width=2)
 oa=np.array(overlay);oa[fa[:,:,3]>0]=0
 Image.alpha_composite(low,Image.fromarray(oa)).save(R/k/'grid.png',optimize=True)

def sheet(kind):
 out=Image.new('RGB',(1500,570),(34,32,28));d=ImageDraw.Draw(out);f=ImageFont.truetype(font,24)
 for i,k in enumerate('abc'):
  im=Image.open(R/k/(kind+'.png')).convert('RGBA').resize((480,480),Image.Resampling.LANCZOS)
  out.paste(im,(10+i*500,52),im);d.text((25+i*500,12),NAMES[k],font=f,fill=(223,213,195))
 out.save(R/(kind+'-comparison.png'))

if __name__=='__main__':
 specs={}
 if (R/'sprites.json').exists():specs=json.loads((R/'sprites.json').read_text())
 for k in 'abc':
  orig=make_original(k)
  rgba=np.array(specs[k]['cells'],dtype='uint8') if k in specs else draft_cells(orig)
  if k not in specs:specs[k]={'cells':rgba.tolist(),'manualEdits':[]}
  output(k,rgba)
 (R/'sprites.json').write_text(json.dumps(specs,ensure_ascii=False,indent=2)+'\n')
 for kind in ['original','low','grid']:sheet(kind)
