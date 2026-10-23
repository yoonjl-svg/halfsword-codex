"""Exact user pixel corrections; retain the earlier versions in Git."""
from pathlib import Path
from copy import deepcopy
import json, subprocess

ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/art/hero_profiles_20261023'
REV=DOC/'eyes-v3'
REV.mkdir(exist_ok=True)
base=json.loads(subprocess.check_output(['git','show','9c3d53d6:docs/art/hero_profiles_20261023/sprites.json'],cwd=ROOT))
original=json.loads((DOC/'eyes-v2/sprites-before.json').read_text())
spec=deepcopy(base)
spec['characters']['black_king']=deepcopy(original['characters']['black_king'])
edits=[]
for id,x,y,color,reason in [
    ('sebastian',7,7,'181B1C','Make the single grey pixel diagonally upper-left of the left visor tip black.'),
    ('black_king',13,8,'A67553','Remove the near white sclera cell using the surrounding warm skin plane.'),
    ('black_king',16,9,'805335','Remove the far white sclera cell using the shadowed skin plane.')
]:
    r=spec['characters'][id];c=[*bytes.fromhex(color),255]
    before=r['palette'][r['cells'][y][x]]
    if c not in r['palette']:r['palette'].append(c)
    r['cells'][y][x]=r['palette'].index(c)
    edits.append({'id':id,'cell':[x,y],'before':before,'after':c,'reason':reason})
for id in ['sebastian','black_king']:
    spec['characters'][id]['review']['status']='user-review-pending'
spec['characters']['sebastian']['review']['notes']+=' v3: specified grey outer visor pixel darkened.'
spec['characters']['black_king']['review']['notes']+=' v3: initial eye line/brows/pupils restored; white sclera cells removed.'
(DOC/'sprites.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
(REV/'changes.json').write_text(json.dumps({'rolandBase':'9c3d53d6','olivierBase':'eyes-v2/sprites-before.json (initial)','edits':edits},ensure_ascii=False,indent=2)+'\n')
for id,expected in [('sebastian',[[7,7]]),('black_king',[[13,8],[16,9]]),('white_scale',[])]:
    before=(original if id=='black_king' else base)['characters'][id];after=spec['characters'][id]
    changed=[[x,y] for y in range(22) for x in range(22) if before['palette'][before['cells'][y][x]]!=after['palette'][after['cells'][y][x]]]
    assert changed==expected,(id,changed)
    assert before['review']['faceBoxCells']==after['review']['faceBoxCells']
    assert before['review']['chinRow']==after['review']['chinRow']
print('Verified: Roland 1 cell; original Olivier 2 sclera cells; White Scale unchanged.')
