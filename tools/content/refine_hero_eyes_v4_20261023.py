"""Remove only the two downward eye pixels requested by the user."""
from pathlib import Path
import json,subprocess

ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/art/hero_profiles_20261023'
REV=DOC/'eyes-v4';REV.mkdir(exist_ok=True)
spec=json.loads(subprocess.check_output(['git','show','abf380d5:docs/art/hero_profiles_20261023/sprites.json'],cwd=ROOT))
rec=spec['characters']['black_king'];edits=[]
for x,y,color in [(12,8,'A67553'),(15,9,'C18A5F')]:
    c=[*bytes.fromhex(color),255]
    before=rec['palette'][rec['cells'][y][x]]
    assert before==[36,30,28,255]
    if c not in rec['palette']:rec['palette'].append(c)
    rec['cells'][y][x]=rec['palette'].index(c)
    edits.append({'cell':[x,y],'before':before,'after':c})
rec['review']['eyes']={'policy':'visible','cells':[[12,7],[15,8]],'note':'Horizontal dark eye marks retained; the two downward pupil extensions removed by explicit user request.'}
rec['review']['notes']+=' v4: remove the two pixels directly below the horizontal eye marks.'
(DOC/'sprites.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
(REV/'changes.json').write_text(json.dumps({'base':'abf380d5','id':'black_king','edits':edits,'allOtherCellsUnchanged':True},indent=2)+'\n')
print('Removed only (12,8) and (15,9); horizontal eye marks retained.')
