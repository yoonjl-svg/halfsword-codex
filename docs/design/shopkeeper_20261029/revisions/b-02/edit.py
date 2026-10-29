from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,numpy as np,hashlib
R=Path(__file__).parent;B=R.parent.parent
base=json.loads((B/'sprites.json').read_text())['b'];a=np.array(base['cells'],dtype=np.uint8);old=a.copy();edits=[]
def p(x,y,c,reason):
 v=[*bytes.fromhex(c.removeprefix('#')),255] if c else [0,0,0,0]
 if list(a[y,x])!=v:edits.append({'x':x,'y':y,'before':a[y,x].tolist(),'after':v,'reason':reason});a[y,x]=v
# Eyes move up one cell. A horizontal lid replaces the stacked brow/pupil block.
for x,y,c in [(12,7,'71503a'),(13,7,'dca480'),(11,8,'bb8464'),(12,8,'73513b'),(13,8,'3f2b22'),(14,8,'fbd0ae'),(12,9,'f4c6a3'),(13,9,'efb991'),(15,8,'c79571'),(16,8,'c58e69'),(15,9,'493025'),(16,9,'dca480'),(15,10,'e5ac86'),(16,10,'ce9874')]:p(x,y,c,'Lift and shorten eye/brow mass; keep two distinct pupils')
# Break the flat cheek plane; taper the rear jaw and retain the turned face.
for x,y,c in [(11,10,'dda784'),(11,11,'cc946f'),(12,11,'efb991'),(10,12,'59402f'),(11,12,'bd805e'),(12,12,'efb991'),(13,12,'c98d71'),(14,12,'b67a60'),(15,12,'85513c'),(10,13,'402c22'),(11,13,'805538'),(12,13,'d39f7d'),(13,13,'efb991'),(14,13,'f4c6a3'),(11,14,'59402f'),(12,14,'a66f50'),(13,14,'d29b79')]:p(x,y,c,'Taper cheek and jaw with warm side planes; soften smile')
# Slim the shoulder silhouette above the shared full-width bust crop.
for x,y,c in [(3,17,None),(4,17,'6a2c21'),(19,17,None),(18,17,'6a2c21'),(1,18,None),(2,18,'6a2c21'),(20,18,None),(19,18,'88392a'),(1,19,'6a2c21'),(2,19,'8e4937'),(3,19,'d4a480'),(4,19,'e6bea0'),(5,19,'edcbb0'),(3,20,'d4a480'),(4,20,'e6bea0'),(5,20,'efd3b9')]:p(x,y,c,'Narrow upper shoulder contour and shade linen sleeve volume')
frame=Image.open(B/'frame1.png').convert('RGBA');fa=np.array(frame)
low=Image.new('RGBA',(1254,1254));low.alpha_composite(Image.fromarray(a).resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame);low.save(R/'low.png')
Image.fromarray(a).save(R/'cells.png');Image.open(B/'b/original.png').save(R/'original.png')
grid=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(grid)
for n in range(23):
 q=77+n*50;d.line([(q,77),(q,1177)],fill=(141,216,221,125),width=2);d.line([(77,q),(1177,q)],fill=(141,216,221,125),width=2)
g=np.array(grid);g[fa[:,:,3]>0]=0;Image.alpha_composite(low,Image.fromarray(g)).save(R/'grid.png')
font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',26)
sheet=Image.new('RGB',(1300,710),(34,32,28));d=ImageDraw.Draw(sheet)
for i,(label,path)in enumerate([('이전',B/'b/low.png'),('수정',R/'low.png')]):
 im=Image.open(path).convert('RGBA').resize((625,625),Image.Resampling.LANCZOS);sheet.paste(im,(12+i*650,65),im);d.text((30+i*650,20),label,font=font,fill=(223,213,195))
sheet.save(R/'before-after.png')
(R/'sprites.json').write_text(json.dumps({'cells':a.tolist(),'edits':edits,'review':{'eyes':[[13,8],[15,9]],'faceWidth':7,'chinRow':14}},indent=2)+'\n')
print('changed cells',np.count_nonzero(np.any(old!=a,axis=2)))
