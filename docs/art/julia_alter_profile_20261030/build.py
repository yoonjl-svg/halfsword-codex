from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np, json
R=Path(__file__).parent
F=Image.open(R/'frame1.png').convert('RGBA'); fa=np.array(F)
def framed(inside):
    out=Image.new('RGBA',(1254,1254)); out.alpha_composite(inside,(77,77)); out.alpha_composite(F); return out
def build():
    m=Image.open(R/'masters/selected.png').convert('RGBA').resize((1100,1100),Image.Resampling.LANCZOS)
    inside=Image.new('RGBA',(1100,1100));inside.alpha_composite(m,(0,65)); framed(inside).save(R/'original.png',optimize=True)
    if not (R/'sprites.json').exists():
        a=np.array(inside);cells=np.zeros((22,22,4),dtype='uint8')
        for y in range(22):
            for x in range(22):
                z=a[y*50:(y+1)*50,x*50:(x+1)*50];occ=z[:,:,3]>150
                if occ.mean()>.45:cells[y,x]=[*np.median(z[occ,:3],axis=0).astype('uint8'),255]
        rgb=np.array(Image.fromarray(cells[:,:,:3]).quantize(colors=30,method=Image.Quantize.MEDIANCUT).convert('RGB'))
        cells[:,:,:3]=rgb;cells[cells[:,:,3]==0,:3]=0
        data={'cells':cells.tolist(),'edits':[],'review':{}}
        (R/'draft-sprites.json').write_text(json.dumps(data,indent=2)+'\n');(R/'sprites.json').write_text(json.dumps(data,indent=2)+'\n')
    data=json.loads((R/'sprites.json').read_text());cells=np.array(data['cells'],dtype='uint8')
    Image.fromarray(cells).save(R/'cells.png')
    low=framed(Image.fromarray(cells).resize((1100,1100),Image.Resampling.NEAREST));low.save(R/'low.png',optimize=True)
    overlay=Image.new('RGBA',(1254,1254));d=ImageDraw.Draw(overlay)
    for n in range(23):
        q=77+n*50;d.line([(q,77),(q,1177)],fill=(141,216,221,125),width=2);d.line([(77,q),(1177,q)],fill=(141,216,221,125),width=2)
    oa=np.array(overlay);oa[fa[:,:,3]>0]=0;Image.alpha_composite(low,Image.fromarray(oa)).save(R/'grid.png',optimize=True)
    indexed=Image.new('RGB',(920,920),(40,39,35));indexed.paste(Image.fromarray(cells).resize((880,880),Image.Resampling.NEAREST),(40,40),Image.fromarray(cells).resize((880,880),Image.Resampling.NEAREST));d=ImageDraw.Draw(indexed)
    for n in range(22):
        d.text((45+n*40,20),str(n),fill='white');d.text((15,52+n*40),str(n),fill='white');d.line([(40+n*40,40),(40+n*40,920)],fill=(100,100,90));d.line([(40,40+n*40),(920,40+n*40)],fill=(100,100,90))
    indexed.save(R/'indexed.png')
if __name__=='__main__':build()
