"""Build only the three new profiles; preserve all 34 approved existing portraits."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/art/hero_profiles_20261023'
ART=ROOT/'public/encounters/pixel-profiles-low128-20261017'
IDS=['sebastian','white_scale','black_king']
NAMES={'sebastian':'롤랑','white_scale':'백린의 전사','black_king':'올리비에'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def asset(p):return {'file':str(p.relative_to(ART)),'sha256':sha(p),'bytes':p.stat().st_size,'width':1254,'height':1254}

def main():
    spec=json.loads((DOC/'sprites.json').read_text())
    protected=json.loads((DOC/'protected-before.json').read_text())
    for p,h in protected.items():assert sha(ROOT/p)==h,p+' changed before build'
    frame=Image.open(ART/'frame1.png').convert('RGBA');fa=np.array(frame);report=[]
    overlay=Image.new('RGBA',(1254,1254));dr=ImageDraw.Draw(overlay)
    for q in range(23):
        v=77+q*50
        dr.line([(v,77),(v,1177)],fill=(141,216,221,122),width=2)
        dr.line([(77,v),(1177,v)],fill=(141,216,221,122),width=2)
    oa=np.array(overlay);oa[fa[:,:,3]>0]=0;overlay=Image.fromarray(oa)
    manifest=json.loads((ART/'profiles.json').read_text())
    manifest['characters']=[c for c in manifest['characters'] if c['id'] not in IDS]
    assert manifest['characters']==json.loads((DOC/'approved-characters.json').read_text()), 'Existing approved manifest records changed'
    for id in IDS:
        dst=ART/id;dst.mkdir(exist_ok=True)
        # Full-quality artwork is preserved separately; frame is the exact shared layer.
        master_file='black_king-clean.png' if id=='black_king' else f'{id}.png'
        master=Image.open(DOC/'master-figures'/master_file).convert('RGBA')
        assert master.width==master.height and master.width>=1024
        interior=Image.new('RGBA',(1100,1100))
        interior.alpha_composite(master.resize((1100,1100),Image.Resampling.LANCZOS),(0,70 if id=='sebastian' else 0))
        original=Image.new('RGBA',(1254,1254));original.alpha_composite(interior,(77,77));original.alpha_composite(frame)
        original.save(dst/'original.png',optimize=True)
        rec=spec['characters'][id]
        rgba=np.array([[rec['palette'][n] for n in row] for row in rec['cells']],dtype=np.uint8)
        assert rgba.shape==(22,22,4)
        assert set(np.unique(rgba[:,:,3])).issubset({0,255})
        sprite=Image.fromarray(rgba);sprite.save(DOC/(id+'-cells.png'))
        low=Image.new('RGBA',(1254,1254));low.alpha_composite(sprite.resize((1100,1100),Image.Resampling.NEAREST),(77,77));low.alpha_composite(frame)
        low.save(dst/'low.png',optimize=True)
        Image.alpha_composite(low,overlay).save(dst/'grid.png',optimize=True)
        decoded=np.array(Image.open(dst/'low.png'));assert np.array_equal(decoded[fa[:,:,3]==255],fa[fa[:,:,3]==255])
        errors=[]
        for y in range(22):
            for x in range(22):
                ys=slice(77+y*50,127+y*50);xs=slice(77+x*50,127+x*50);mask=fa[ys,xs,3]==0
                if not np.all(decoded[ys,xs][mask]==rgba[y,x]):errors.append([x,y])
        assert not errors,(id,errors)
        eyes=rec['review']['eyes'];box=rec['review']['faceBoxCells'];chin=rec['review']['chinRow']
        assert 6<=box[2]-box[0]+1<=10 and 13<=chin<=15
        assert np.count_nonzero(rgba[21,:,3])>=21
        if eyes['policy']=='visible':
            assert len(eyes['cells'])==2
            for x,y in eyes['cells']:assert rgba[y,x,3]==255
        for kind in ['original','grid']:
            arr=np.array(Image.open(dst/(kind+'.png')))
            assert np.array_equal(arr[fa[:,:,3]==255],fa[fa[:,:,3]==255])
        row={'id':id,'name':NAMES[id],'epithet':'','lookVersion':{'sebastian':'v2','white_scale':'v1','black_king':'v4'}[id],
             'group':'base','baseId':id,'added':'2026-10-23','status':'user-approved','frame':1,
             'angleLabel':{'sebastian':'왼쪽 3/4','white_scale':'오른쪽 3/4','black_king':'오른쪽 3/4'}[id],
             'original':asset(dst/'original.png'),
             'low':{**asset(dst/'low.png'),'method':'fixed-grid-individually-edited-pixel-art','targetScale':128,'exactFixedGrid':True,
                    'transparentBackground':True,'grid':{'width':22,'height':22,'cellPixels':50,'origin':[77,77]},'frameSha256':sha(ART/'frame1.png')},
             'gridPreview':{**asset(dst/'grid.png'),'reviewOnly':True,'grid':{'width':22,'height':22,'cellPixels':50,'origin':[77,77]}}}
        manifest['characters'].append(row)
        report.append({'id':id,'frameIdentical':True,'gridErrors':errors,'transparentBackground':True,'eyes':eyes,
                       'faceBoxCells':box,'chinRow':chin,'bottomOpaqueCells':int(np.count_nonzero(rgba[21,:,3])),
                       'original':row['original'],'low':row['low'],'gridPreview':row['gridPreview']})
    manifest['counts']={'total':len(manifest['characters']),'base':sum(c['group']=='base' for c in manifest['characters']),'alter':sum(c['group']=='alter' for c in manifest['characters'])}
    manifest['status']='all-37-user-approved'
    manifest['version']='low128-strict-grid-20261023'
    manifest['originalPolicy']='existing 34 original masters preserved; new 3 transparent masters with identical shared frame'
    (ART/'profiles.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    for p,h in protected.items():assert sha(ROOT/p)==h,p+' changed after build'
    (DOC/'asset-validation.json').write_text(json.dumps({'count':3,'existingAssetsPreserved':len(protected),'frameSha256':sha(ART/'frame1.png'),'characters':report},ensure_ascii=False,indent=2)+'\n')
    # A contact sheet is for review only; the portrait files stay transparent.
    for kind in ['original','low','grid']:
        sheet=Image.new('RGB',(1050,380),(34,32,28));d=ImageDraw.Draw(sheet)
        for j,id in enumerate(IDS):
            im=Image.open(ART/id/(kind+'.png')).convert('RGBA').resize((350,350),Image.Resampling.LANCZOS)
            sheet.paste(im,(350*j,0),im);d.text((350*j+14,356),id,fill=(223,213,195))
        sheet.save(DOC/(kind+'-sheet.png'))
    # User-facing comparison, separate from the square transparent assets.
    font_path='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
    font=ImageFont.truetype(font_path,22)
    preview=Image.new('RGB',(1080,850),(34,32,28));pd=ImageDraw.Draw(preview)
    for j,id in enumerate(IDS):pd.text((24+j*354,8),NAMES[id],font=font,fill=(223,213,195))
    for row,kind in enumerate(['original','low']):
        y=46+row*400;pd.text((24,y), '원본' if kind=='original' else 'low · 128',font=font,fill=(185,174,155))
        for j,id in enumerate(IDS):
            im=Image.open(ART/id/(kind+'.png')).convert('RGBA').resize((350,350),Image.Resampling.LANCZOS)
            preview.paste(im,(12+j*354,y+35),im)
    review=ROOT/'public/encounters/hero-profiles-20261023';review.mkdir(exist_ok=True)
    preview.save(review/'comparison.png')
    print('Built 3 originals/lows/grids; preserved',len(protected),'existing files.')

if __name__=='__main__':main()
