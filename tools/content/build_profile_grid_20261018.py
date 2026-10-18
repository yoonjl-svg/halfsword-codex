#!/usr/bin/env python3
"""Render the approved, individually edited portrait cells with one shared frame.
No downsampling or image generation is performed by this release builder.
"""
import json,hashlib
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'public/encounters/pixel-profiles-low128-20261017'
DOC=ROOT/'docs/art/pixel_profiles_strict_20261018'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 spec=json.loads((DOC/'sprites.json').read_text())
 frame=Image.open(ART/'frame1.png').convert('RGBA')
 manifest=json.loads((ART/'profiles.json').read_text())
 result=[]
 for c in manifest['characters']:
  rec=spec['characters'][c['id']]
  assert sha(ART/c['original']['file'])==c['original']['sha256'], c['id']+' original changed'
  rgba=np.array([[rec['palette'][n] for n in row] for row in rec['cells']],dtype=np.uint8)
  assert rgba.shape==(22,22,4)
  assert set(np.unique(rgba[:,:,3])).issubset({0,255})
  sprite=Image.fromarray(rgba)
  out=Image.new('RGBA',(1254,1254))
  out.alpha_composite(sprite.resize((1100,1100),Image.Resampling.NEAREST),(77,77))
  out.alpha_composite(frame)
  path=ART/c['low']['file'];out.save(path,optimize=True)
  # Independently decode the written output and reconstruct each fully visible cell.
  decoded=np.array(Image.open(path)); fa=np.array(frame)[:,:,3]
  errors=[]
  for y in range(22):
   for x in range(22):
    ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50)
    mask=fa[ys,xs]==0
    if not np.all(decoded[ys,xs][mask]==rgba[y,x]): errors.append([x,y])
  assert not errors, (c['id'],errors)
  assert np.all(decoded[fa==255]==np.array(frame)[fa==255])
  eye=rec['review']['eyes']
  if eye['policy']=='visible':
   assert eye['cells'],c['id']+' missing eyes'
   for x,y in eye['cells']: assert rgba[y,x,3]==255
  c['low'].update(sha256=sha(path),bytes=path.stat().st_size,method='fixed-grid-individually-edited-pixel-art',targetScale=128,exactFixedGrid=True,transparentBackground=True,grid={'width':22,'height':22,'cellPixels':50,'origin':[77,77]},frameSha256=sha(ART/'frame1.png'))
  c['low'].pop('alpha',None)
  result.append({'id':c['id'],'originalUnchanged':True,'exactGrid':True,'identicalFrame':True,'eyePolicy':eye['policy'],'eyeCells':eye['cells'],'gridErrors':errors,'sha256':sha(path)})
 manifest.update(version='low128-strict-grid-20261018',status='reviewed',lowMethod='22×22 authored cells, shared high-resolution frame1, alpha background',exactFixedGrid=True,grid=spec['grid'],frameFile='frame1.png')
 (ART/'profiles.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 (DOC/'asset-validation.json').write_text(json.dumps({'count':len(result),'frameSha256':sha(ART/'frame1.png'),'characters':result},ensure_ascii=False,indent=2)+'\n')
 print('Rendered and verified',len(result),'portraits; original hashes preserved')
if __name__=='__main__':main()
