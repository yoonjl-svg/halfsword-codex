from pathlib import Path
from PIL import Image
import numpy as np,json,hashlib
R=Path(__file__).parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
approved_frame_sha='8d6ec8d1290906183aabf1ab03db477d12a0cf922dece76f2e0053efc1b41a54'
fa=np.array(Image.open(R/'frame1.png').convert('RGBA'))
S=json.loads((R/'sprites.json').read_text())
out={'date':'2026-10-29','status':'technical-and-visual-review-complete; awaiting-user-selection','canvas':[1254,1254],'grid':{'width':22,'height':22,'cellPixels':50,'origin':[77,77]},'frameSha256':sha(R/'frame1.png'),'frameMatchesApprovedAsset':sha(R/'frame1.png')==approved_frame_sha,'characters':[]}
assert out['frameMatchesApprovedAsset']
for k in 'abc':
 arr=np.array(S[k]['cells'],dtype=np.uint8);low=np.array(Image.open(R/k/'low.png').convert('RGBA'))
 errors=[]
 for y in range(22):
  for x in range(22):
   ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);uncovered=fa[ys,xs,3]==0
   if not np.all(low[ys,xs][uncovered]==arr[y,x]):errors.append([x,y])
 assert not errors
 files=[]
 for kind in ['original','low','grid']:
  p=R/k/(kind+'.png');im=Image.open(p).convert('RGBA');d=np.array(im)
  assert im.size==(1254,1254)
  assert np.array_equal(d[fa[:,:,3]==255],fa[fa[:,:,3]==255])
  assert np.count_nonzero(d[:,:,3]==0)>0
  files.append({'file':str(p.relative_to(R)),'sha256':sha(p),'bytes':p.stat().st_size})
 review=S[k]['review'];bbox=review['faceBoxCells'];eyes=review['eyes']['cells']
 assert 6<=bbox[2]-bbox[0]+1<=10
 assert 13<=review['chinRow']<=15
 assert np.count_nonzero(arr[21,:,3])>=21
 assert len(eyes)==2 and eyes[0]!=eyes[1]
 for x,y in eyes:
  assert arr[y,x,3]==255 and sum(int(v) for v in arr[y,x,:3])/3 < 85
  assert 4<=review['chinRow']-y<=6
 assert set(np.unique(arr[:,:,3]))=={0,255}
 out['characters'].append({'id':k,'files':files,'rawMaster':{'file':'masters/'+k+'.png','sha256':sha(R/'masters'/(k+'.png'))},'frameIdentical':True,'gridErrors':errors,'binarySpriteAlpha':True,'backgroundTransparent':True,'reviewCoordinatesAreManualNotFaceDetection':True,'review':review,'faceWidthCells':bbox[2]-bbox[0]+1,'bottomOpaqueCells':int(np.count_nonzero(arr[21,:,3])),'manualCellEditOperations':len(S[k]['manualEdits'])})
(R/'qa.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pass':True,'portraits':3,'files':9,'frame':out['frameSha256'],'manualEditOperations':sum(c['manualCellEditOperations'] for c in out['characters'])}))
