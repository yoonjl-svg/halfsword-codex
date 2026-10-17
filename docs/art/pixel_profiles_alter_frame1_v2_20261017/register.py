import sys,json,hashlib,struct,shutil
from pathlib import Path
p=Path('/workspace/portrait-alter-originals-frame1-v2-20261017'); repo=Path('/workspace/halfsword-codex'); pub=repo/'public/encounters/pixel-profiles-alter-frame1-v2-20261017'; doc=repo/'docs/art/pixel_profiles_alter_frame1_v2_20261017'
roster=json.loads((p/'canonical-roster.json').read_text()); jobs=json.loads((p/'generation-jobs.json').read_text()); by={c['id']:c for c in roster}; jb={j['id']:j for j in jobs}
records_path=p/'completed-records.json'; records=json.loads(records_path.read_text()) if records_path.exists() else []
for i in range(1,len(sys.argv),2):
 id,src=sys.argv[i:i+2]; source=Path(src); data=source.read_bytes(); width,height=struct.unpack('>II',data[16:24]); assert width==height and width>=1024
 sha=hashlib.sha256(data).hexdigest(); out=p/f'{id}.png'; asset=pub/id/'original.png'; asset.parent.mkdir(parents=True,exist_ok=True); out.write_bytes(data); asset.write_bytes(data)
 record={**by[id],'original':{'file':f'{id}/original.png','sha256':sha,'bytes':len(data),'width':width,'height':height},'generatedOriginal':src,'workingOriginal':str(out),'inputFiles':jb[id]['referenced_image_paths'],'prompt':jb[id]['prompt'],'reviewed':True,'lowCreated':False}
 records=[r for r in records if r['id']!=id]+[record]
records.sort(key=lambda r:[c['id'] for c in roster].index(r['id']))
records_path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
manifest={'version':'20261017-alter-frame1-v2','frame':1,'quality':'original-only','expectedCount':len(roster),'complete':len(records)==len(roster),'characters':[{k:r[k] for k in ['id','baseId','name','lookVersion','baseFacing','alterFacing','expressionNote','original']} for r in records]}
(pub/'profiles.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
doc.mkdir(parents=True,exist_ok=True)
for n in ['canonical-roster.json','generation-jobs.json','protected-before.json','completed-records.json']:
 shutil.copyfile(p/n,doc/n)
(doc/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'Completed {len(records)}/{len(roster)}: '+', '.join(r['id'] for r in records))
