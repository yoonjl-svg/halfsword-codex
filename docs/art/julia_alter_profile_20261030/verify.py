from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
R=Path(__file__).parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
frame=R/'frame1.png';fa=np.array(Image.open(frame).convert('RGBA'))
assert sha(frame)=='8d6ec8d1290906183aabf1ab03db477d12a0cf922dece76f2e0053efc1b41a54'
s=json.loads((R/'sprites.json').read_text());a=np.array(s['cells'],dtype='uint8');assert a.shape==(22,22,4)
assert set(np.unique(a[:,:,3]))=={0,255}
low=np.array(Image.open(R/'low.png').convert('RGBA'))
for y in range(22):
    for x in range(22):
        ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);mask=fa[ys,xs,3]==0
        assert np.all(low[ys,xs][mask]==a[y,x]),(x,y)
files=[]
for kind in ['original','low','grid']:
    p=R/(kind+'.png');im=Image.open(p);v=np.array(im)
    assert im.size==(1254,1254) and im.mode=='RGBA'
    assert np.array_equal(v[fa[:,:,3]==255],fa[fa[:,:,3]==255])
    assert np.count_nonzero(v[:,:,3]==0)>300000
    files.append({'file':p.name,'sha256':sha(p),'bytes':p.stat().st_size})
r=s['review'];box=r['faceBoxCells'];assert 6<=box[2]-box[0]+1<=10
assert 13<=r['chinRow']<=15
for x,y in r['eyes']['cells']:
    assert a[y,x,3]==255 and a[y,x,0]>a[y,x,1]*1.5 and a[y,x,:3].mean()<110
    assert 4<=r['chinRow']-y<=6
assert np.count_nonzero(a[21,:,3])>=21
base=R.parents[1]/'design/shopkeeper_20261029/revisions/b-05'
checks={'pass':True,'canvas':[1254,1254],'grid':{'cells':[22,22],'cellPixels':50,'origin':[77,77]},'frameSha256':sha(frame),'frameIdentical':True,'gridUniform':True,'binarySpriteAlpha':True,'transparentBackground':True,'manualCellEdits':len(s['edits']),'review':r,'manualVisualCoordinatesNotAutomaticFaceDetection':True,'files':files,'basePreservedFiles':{k:sha(base/(k+'.png')) for k in ['original','low','grid']},'generationMasters':{p.name:sha(p) for p in (R/'masters').glob('*.png')}}
(R/'qa.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks))
