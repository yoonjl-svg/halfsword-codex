"""User-requested eye revision, authored on the unchanged 22x22 grid."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / 'docs/art/hero_profiles_20261023'
REV = DOC / 'eyes-v2'
spec = json.loads((REV / 'sprites-before.json').read_text())
edits = []

def paint(id, color, coordinates, reason):
    rec = spec['characters'][id]
    rgba = [*bytes.fromhex(color), 255]
    if rgba not in rec['palette']:
        rec['palette'].append(rgba)
    index = rec['palette'].index(rgba)
    for x, y in coordinates:
        before = rec['palette'][rec['cells'][y][x]]
        if before == rgba:
            continue
        edits.append({'id': id, 'cell': [x, y], 'before': before, 'after': rgba, 'reason': reason})
        rec['cells'][y][x] = index

id = 'sebastian'
paint(id, '555249', [(7, 7)], 'Taper the outer end of the far visor slot.')
paint(id, '181B1C', [(8, 8), (10, 8), (11, 8), (12, 7), (13, 7)], 'Two stepped, rising visor openings rather than one long horizontal bar.')
paint(id, '8D806A', [(8, 7), (14, 7)], 'Beveled upper rim and narrow outer end, keeping the eyes covered.')
paint(id, 'B9AA98', [(7, 8)], 'Close the old flat far-eye extension with helmet metal.')
paint(id, 'E1D4BB', [(12, 8)], 'Raise the lower edge of the near slot into a shallow diagonal.')
paint(id, 'C5B29B', [(13, 8)], 'Continuous cheek metal below the diagonal slot.')
paint(id, 'A99988', [(14, 8)], 'Remove the old wide square outer end of the slot.')
spec['characters'][id]['review']['eyes'] = {
    'policy': 'covered-by-design', 'cells': [],
    'visorCells': [[8, 8], [11, 8], [12, 7]],
    'note': 'Short stepped visor slots separated by an intact gold nose bridge.'
}

id = 'black_king'
paint(id, '805335', [(11, 7), (13, 7), (16, 7)], 'Soften eyebrow ends so brow and pupil do not read as a square hole.')
paint(id, '65452F', [(12, 7), (15, 7)], 'Separate warm eyebrow accents from the darker pupils.')
paint(id, 'C3AD90', [(13, 8)], 'Muted near-eye sclera instead of a bright white square.')
paint(id, '362B24', [(12, 8), (15, 8)], 'Both pupils share one eye line and look to the same side, with softer contrast.')
paint(id, 'B09A7E', [(16, 8)], 'Far eye in deeper perspective shadow, without a pure white square.')
paint(id, 'C18A5F', [(15, 9)], 'Restore cheek and nose light under the raised far eye.')
paint(id, '805335', [(16, 9)], 'Replace the old low white eye with lower-lid shadow.')
spec['characters'][id]['review']['eyes'] = {
    'policy': 'visible', 'cells': [[12, 8], [15, 8]],
    'note': 'Aligned pupils; muted sclera; unequal brow contours and far-eye shading.'
}
for id in ['sebastian', 'black_king']:
    spec['characters'][id]['review']['status'] = 'user-review-pending'
    spec['characters'][id]['review']['notes'] += ' Eye revision v2; original artwork, face box and crop unchanged.'
(DOC / 'sprites.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2) + '\n')
(REV / 'cell-edits.json').write_text(json.dumps({'count': len(edits), 'edits': edits}, ensure_ascii=False, indent=2) + '\n')
print('Eye revision:', len(edits), 'cell changes across two portraits.')
