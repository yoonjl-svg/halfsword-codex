#!/usr/bin/env python3
"""Export review-only grid PNGs without modifying high-resolution originals or lows."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw
import numpy as np
R=Path(__file__).resolve().parents[2];P=R/'public/encounters/pixel-profiles-low128-20261017';D=R/'docs/art/pixel_profiles_handoff_20261018'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 D.mkdir(exist_ok=True);m=json.loads((P/'profiles.json').read_text());frame=np.array(Image.open(P/'frame1.png').convert('RGBA'));overlay=Image.new('RGBA',(1254,1254));draw=ImageDraw.Draw(overlay)
 for q in range(23):
  v=77+q*50;draw.line([(v,77),(v,1177)],fill=(141,216,221,122),width=2);draw.line([(77,v),(1177,v)],fill=(141,216,221,122),width=2)
 rgba=np.array(overlay);rgba[frame[:,:,3]>0]=0;overlay=Image.fromarray(rgba);records=[]
 for c in m['characters']:
  lp=P/c['low']['file'];op=P/c['original']['file'];assert sha(lp)==c['low']['sha256'];assert sha(op)==c['original']['sha256'];im=Image.open(lp).convert('RGBA');out=Image.alpha_composite(im,overlay);target=P/c['id']/'grid.png';out.save(target,optimize=True)
  assert np.array_equal(np.array(out)[frame[:,:,3]==255],frame[frame[:,:,3]==255])
  c['gridPreview']={'file':c['id']+'/grid.png','sha256':sha(target),'bytes':target.stat().st_size,'width':1254,'height':1254,'reviewOnly':True,'grid':c['low']['grid']};records.append({'id':c['id'],'originalPreserved':True,'lowPreserved':True,'framePreserved':True,'gridSha256':sha(target)})
 m['status']='user-approved-final-20261018';m['gridPreviewPolicy']='review-only PNG; use low PNG in game';(P/'profiles.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');(D/'grid-validation.json').write_text(json.dumps({'count':len(records),'grid':[22,22],'cellPixels':50,'characters':records},ensure_ascii=False,indent=2)+'\n');print('Exported and verified 34 review-only grid PNGs; originals/lows/frame preserved.')
if __name__=='__main__':main()
