import hashlib,json,shutil,struct,datetime
from pathlib import Path
p=Path('/workspace/portrait-alter-originals-frame1-20261017')
repo=Path('/workspace/halfsword-codex')
doc=repo/'docs/art/pixel_profiles_alter_frame1_20261017'
pub=repo/'public/encounters/pixel-profiles-alter-frame1-20261017'
source=Path('/workspace/halfsword-icon-handoff')
prior=Path('/workspace/halfsword-night-handoff')
sha=lambda path:hashlib.sha256(Path(path).read_bytes()).hexdigest()
write=lambda path,obj:Path(path).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
records=json.loads((p/'completed-records.json').read_text())
roster=json.loads((p/'canonical-roster.json').read_text())
manifest=json.loads((pub/'profiles.json').read_text())
report=json.loads((p/'references/character-report.json').read_text())
assert len(records)==len(roster)==len(manifest['characters'])==16 and manifest['complete']
assert {r['id'] for r in records}=={r['id'] for r in roster}
assert all(r['id']!='player_mad' for r in roster)
checks=[]
for r in records:
 original=Path(r['generatedOriginal']); working=Path(r['workingOriginal']); deployed=pub/r['original']['file']; o=r['original']
 for target in [original,working,deployed]:
  b=target.read_bytes(); assert b[:8]==b'\x89PNG\r\n\x1a\n'; assert struct.unpack('>II',b[16:24])==(1254,1254); assert len(b)==o['bytes']; assert sha(target)==o['sha256']
 checks.append({'id':r['id'],'square':True,'width':1254,'height':1254,'generatedWorkingPublicBytesIdentical':True,'sha256':o['sha256'],'bytes':o['bytes'],'visualReview':True})
before=json.loads((p/'base-original-hashes-before.json').read_text())
unchanged={n:sha(Path('/workspace/portrait-originals-frame1-20261017')/n)==h for n,h in before.items()}
assert len(unchanged)==17 and all(unchanged.values())
lowfiles=[str(f) for f in pub.rglob('*') if f.is_file() and f.name.lower().startswith('low')];assert not lowfiles
refs=doc/'references';refs.mkdir(exist_ok=True)
reference_records=[]
for cid in [r['id'] for r in roster]:
 f=p/'references'/f'{cid}-bust.png'; dst=refs/f.name;shutil.copyfile(f,dst)
 reference_records.append({'id':cid,'file':str(dst.relative_to(doc)),'sha256':sha(dst),'bytes':dst.stat().st_size})
for name in ['contact-sheet.png','character-report.json']:
 shutil.copyfile(p/'references'/name,refs/name)
weapon=repo/'public/encounters/night-fifth-refinement-20261016/qinglan_night-renji_mad-weapon.webp'
shutil.copyfile(weapon,refs/'renji_mad-weapon.webp')
for name in ['capture-alters.mjs','register.py','generation-attempts.json','samira-correction-job.json']:
 shutil.copyfile(p/name,doc/name)
comparison=[]
for f in source.joinpath('src').glob('*.js'):
 if f.name.startswith(('looks','outfit','characters','mad_eyes')):
  old=prior/'src'/f.name
  comparison.append({'file':str(f.relative_to(source)),'currentSha256':sha(f),'priorSha256':sha(old) if old.exists() else None,'same':old.exists() and sha(f)==sha(old)})
assert all(r['same'] for r in comparison)
provenance={
 'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':'All 16 registered alter NPCs, original-only. No player alter is registered.',
 'sourceRoot':str(source),'sourceHeadAtCapture':report['sourceHead'],'sourceFoundation':'e92b5a6f',
 'priorAppearanceReference':'15e18adf','appearanceComparison':comparison,
 'sourceHashesAtCapture':report['sourceHashes'],'servedSourceMatches':report['servedSourceMatches'],'sourceStableDuringCapture':report['sourceStable'],
 'captureScope':{'expectedAlterIds':[r['id'] for r in roster],'capturedAlterIds':report['capturedIds'],'complete':set(report['capturedIds'])=={r['id'] for r in roster},'errors':report['errors']},
 'rawReportNote':'Raw character-report.json retains the generic helper full 33-character expected list and complete:false; this task intentionally captured only all 16 alters. Its inherited method sentence says Heinrich eyes only, but capture-alters.mjs line 111 applies registered madGlow/clothGlow to every alter, including the veiled and sheltered variants. The explicit 16-ID scope above is the task completeness check.',
 'referenceMethod':'Source production Fighter/LOOKS in neutral studio lighting, native geometry/materials unedited, weapons omitted except a separate Kim weapon reference. Shared lowered resting arm mesh pose, no physics stepping. Front orthographic busts are engine inspection images, not gameplay screenshots or the generated portraits.',
 'references':reference_records,
 'weaponReference':{'file':'references/renji_mad-weapon.webp','source':str(weapon),'sha256':sha(weapon)},
 'generationTool':'image_gen.imagegen','frame':1,'quality':'original-only','generatedOriginalsPreserved':True,'postprocessing':'Byte-for-byte file copy only; no raster resize, pixelation, recoloring or low output.',
 'supersededGeneratedOriginals':[{'id':'samira_mad','path':'/workspace/generated_images/exec-53a2f330-eaab-4b2a-8194-d8a08588cdb9.png','reason':'Document pouch moved from chest to approved waist using image_gen; prior original retained.'}],
 'gameSourceChangedByThisTask':False,'remoteWritesByThisTask':False,'uiWiringByThisTask':False
}
verification={'createdAt':provenance['createdAt'],'completed':16,'expected':16,'allSquare1254':True,'allGeneratedWorkingPublicCopiesIdentical':True,'allVisuallyReviewed':True,'originals':checks,'baseOriginalsUnchanged':unchanged,'lowFilesInAlterDirectory':lowfiles,'manifestQuality':manifest['quality'],'captureScopeComplete':provenance['captureScope']['complete']}
write(doc/'provenance.json',provenance);write(doc/'verification.json',verification);write(p/'verification.json',verification)
print(json.dumps({'count':16,'dimensions':'1254x1254','bytes':sum(r['original']['bytes'] for r in records),'baseOriginalsUnchanged':len(unchanged),'noLow':not lowfiles,'sourceAppearanceMatchFiles':len(comparison),'docs':str(doc)},ensure_ascii=False))
