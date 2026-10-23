"""Redraw identifying features on blocked color planes; release builds use sprites.json."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2];DOC=ROOT/'docs/art/hero_profiles_20261023'
spec=json.loads((DOC/'blocked-planes.json').read_text());edits=[]
def paint(id, color, coordinates, why):
    r=spec['characters'][id];p=r['palette'];c=[*bytes.fromhex(color),255] if color else [0,0,0,0]
    if c not in p:p.append(c)
    n=p.index(c)
    for x,y in coordinates:
        old=r['cells'][y][x]
        if old==n:continue
        edits.append({'id':id,'cell':[x,y],'before':p[old],'after':c,'reason':why})
        r['cells'][y][x]=n

for id in spec['characters']:
    paint(id,None,[(0,0),(21,0)],'Remove frame-corner contamination from the character layer.')

id='sebastian'
paint(id,'181B1C',[(7,8),(8,8),(10,8),(11,8),(12,8),(13,8),(14,8)],'Two continuous visor slots, separated by the nose ridge; no invented eyes.')
paint(id,'C3A66A',[(10,5),(10,6),(9,7),(9,8),(9,9),(10,10),(10,11),(10,12),(10,13)],'Deliberately stepped gold nose ridge makes the three-quarter helmet readable.')
paint(id,'FBF1DC',[(12,2),(13,1),(15,2),(16,3),(18,4),(18,6),(10,6),(11,6),(8,7)],'Separate pale plume strands and helmet highlight into designed bands.')
paint(id,'A29583',[(13,3),(15,4),(17,5),(17,7),(19,6),(11,3)],'Negative grooves separate the pale plume from the bright helmet.')
paint(id,'7B705E',[(8,10),(8,12),(13,10),(12,12)],'Four selected vents replace ambiguous mottled shading.')
paint(id,'E1D4BB',[(8,9),(8,11),(11,9),(11,10),(11,11),(11,12),(12,10)],'Consolidate broad helmet planes around the vents.')
paint(id,'632B35',[(6,13),(5,14),(16,15),(17,15),(13,19),(14,19),(14,20),(14,21)],'Restore burgundy cape and shield as distinct cloth/emblem colors.')
paint(id,'C7AA6C',[(7,16),(8,17),(11,17),(14,18),(15,19),(15,20),(13,21)],'Deliberate chain, shield border and armor trim.')
paint(id,'F1E6CE',[(14,20)],'Single castle tower within the tiny chest shield.')
paint(id,'7D776C',[(0,20),(1,20),(2,20),(5,19),(6,19),(18,20),(19,21)],'Readable shoulder plate overlaps, without a noisy all-over pattern.')
spec['characters'][id]['review'].update(faceBoxCells=[7,8,14,14],chinRow=14,eyes={'policy':'covered-by-design','cells':[],'visorCells':[[7,8],[11,8]]})

id='white_scale'
paint(id,'817D6A',[(4,0),(6,0),(8,0),(9,1),(10,2),(18,2),(20,2)],'Interrupted horn highlights communicate curved dark horns against a dark UI.')
paint(id,'B19761',[(11,4),(12,3),(14,4),(15,5),(15,6),(8,7),(9,7),(10,7),(11,7),(14,8),(15,8),(16,8)],'Helmet ribs and brim, drawn as sparse whole-cell accents.')
paint(id,'101719',[(11,8),(12,8),(13,9),(16,9)],'Restore two angular dark eye openings in the opaque mask.')
paint(id,'666A63',[(12,9),(13,10),(14,10),(15,11),(16,10)],'Keep angular cheek and nose planes distinct, not a blurred black face.')
paint(id,'3A4544',[(12,10),(12,11),(13,11),(14,11),(15,12),(14,13)],'Unify the mask into large deliberate shadow planes.')
paint(id,'151C1D',[(14,12),(15,13)],'Molded mouth and chin notch, not exposed human features.')
paint(id,'E8E4D4',[(8,8),(9,10),(8,12),(6,11),(17,12),(17,14),(1,16),(3,17),(1,18),(8,16),(10,17),(12,17),(18,19),(20,18)],'Silver lamellar highlights separated into a legible scale rhythm.')
paint(id,'8C8880',[(8,9),(7,11),(8,11),(6,12),(17,11),(18,13),(3,16),(2,18),(7,18),(9,18),(19,19)],'Scale overlaps and nape silhouette.')
paint(id,'8D313D',[(7,9),(9,11),(6,12),(18,14),(3,14),(5,15),(14,14),(15,16),(16,17),(14,18),(13,19),(11,20),(10,21)],'Red cords and diagonal sash restored instead of averaging into the silver.')
paint(id,'BA5960',[(15,17),(13,18),(12,19),(10,20)],'One narrow highlight along the red diagonal sash.')
spec['characters'][id]['review'].update(faceBoxCells=[11,8,17,14],chinRow=14,eyes={'policy':'covered-by-design','cells':[],'visorCells':[[12,8],[16,9]]})

id='black_king'
paint(id,'50433C',[(9,2),(11,2),(13,3),(15,2),(17,4),(6,6),(5,9),(6,11),(15,13)],'Separated warm highlights make black curls readable without turning them grey-green.')
paint(id,'1F1C1B',[(10,3),(12,3),(14,2),(16,3),(6,7),(6,10),(5,11),(15,12)],'Deep curl grooves and connected sideburns, not flat averaged hair.')
paint(id,'A67553',[(11,7),(12,7),(13,7),(14,7),(11,8),(12,8),(13,8),(14,8),(12,9),(13,9),(14,9)],'Rebuild warm skin planes and reserve room for two distinct eyes.')
paint(id,'C18A5F',[(13,5),(14,5),(14,6),(11,8),(12,9),(13,9)],'Forehead, cheek and bridge highlights retain the brown complexion.')
paint(id,'332521',[(11,6),(12,6),(13,6),(15,7),(16,7)],'Different eyebrow lengths follow the turned head.')
paint(id,'D6BE9D',[(12,7),(16,8)],'Eye whites are single cells rather than oversized white blocks.')
paint(id,'241E1C',[(13,7),(15,8)],'Restore both pupils at the correct perspective heights.')
paint(id,'C18A5F',[(15,9),(14,10)],'Stepped nose bridge and tip define the right-facing silhouette.')
paint(id,'805335',[(16,9),(15,10),(13,10)],'Nose underside separates from the moustache.')
paint(id,'1F1C1B',[(11,10),(12,10),(14,10),(15,11),(10,11),(11,12),(12,13),(13,14),(14,14)],'Full connected beard and moustache with a deliberate angular edge.')
paint(id,'4C3C32',[(11,11),(13,12),(14,13),(15,13)],'Beard curl groups and jaw volume.')
paint(id,'9B6848',[(12,11),(13,11)],'Two-cell closed mouth remains visible within the beard.')
paint(id,'89763C',[(1,12),(2,12),(4,13),(5,14),(6,15),(6,17),(7,19),(7,20)],'Dull deep yellow mantle stays distinct from skin and metal.')
paint(id,'AF9860',[(6,15)],'Single old-brass clasp, not a bright decorative necklace.')
paint(id,'30383B',[(8,15),(10,15),(12,16),(15,17),(9,19),(12,19),(15,20)],'Continuous curved dark plate overlaps; reduce mottled noise.')
paint(id,'8C8A80',[(1,15),(3,16),(9,16),(11,17),(17,16),(19,17)],'Sparse shoulder and torso edge glints retain dimensionality.')
paint(id,'A67553',[(11,6),(12,6),(13,6),(12,7),(13,7),(15,7),(16,7),(11,8),(14,8)],'Give the forehead a clean plane and lower the eye line by one cell for the common face crop.')
paint(id,'332521',[(11,7),(12,7),(13,7),(15,8),(16,8)],'Two non-identical eyebrow contours follow the three-quarter perspective.')
paint(id,'D6BE9D',[(13,8),(16,9)],'Keep a single light cell to the same side of each pupil, avoiding a crossed gaze.')
paint(id,'241E1C',[(12,8),(15,9)],'Both dark pupils remain distinct; five to six rows from eye to chin.')
spec['characters'][id]['review'].update(faceBoxCells=[10,6,17,14],chinRow=14,eyes={'policy':'visible','cells':[[12,8],[15,9]]})

for id,r in spec['characters'].items():
    r['method']='blocked-from-master; individually-redrawn-features-and-planes'
    r['review']['status']='pending-visual-review'
    r['review']['notes']='Features, silhouette, cloth/metal planes and eyes individually redrawn on the fixed grid; see cell-edits.json.'
(DOC/'sprites.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n')
(DOC/'cell-edits.json').write_text(json.dumps({'count':len(edits),'edits':edits},ensure_ascii=False,indent=2)+'\n')
print('Applied',len(edits),'deliberate cell edits across three portraits.')
