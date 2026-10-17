import hashlib,json,shutil,struct,datetime
from pathlib import Path
p=Path('/workspace/portrait-alter-originals-frame1-v2-20261017');repo=Path('/workspace/halfsword-codex');doc=repo/'docs/art/pixel_profiles_alter_frame1_v2_20261017';pub=repo/'public/encounters/pixel-profiles-alter-frame1-v2-20261017'
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
read=lambda f:json.loads(Path(f).read_text())
write=lambda f,obj:Path(f).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
records=read(p/'completed-records.json');roster=read(p/'canonical-roster.json');jobs=read(p/'generation-jobs.json');attempts=read(p/'generation-attempts.json');manifest=read(pub/'profiles.json')
assert len(records)==len(roster)==len(manifest['characters'])==16 and manifest['complete']
assert {r['id'] for r in records}=={r['id'] for r in roster}
checks=[]
for r in records:
 o=r['original']
 for f in [r['generatedOriginal'],r['workingOriginal'],pub/o['file']]:
  b=Path(f).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';assert struct.unpack('>II',b[16:24])==(1254,1254);assert len(b)==o['bytes'];assert sha(f)==o['sha256']
 assert r['baseFacing']!=r['alterFacing']
 checks.append({'id':r['id'],'width':1254,'height':1254,'sha256':o['sha256'],'bytes':o['bytes'],'generatedWorkingPublicBytesIdentical':True,'individualImageViewed':True,'baseFacing':r['baseFacing'],'alterFacing':r['alterFacing']})
protected=read(p/'protected-before.json');unchanged={f:sha(f)==h for f,h in protected.items()};assert len(unchanged)==33 and all(unchanged.values())
low=[str(f) for f in pub.rglob('*') if f.is_file() and (f.name.lower().startswith('low') or 'low.png' in f.name.lower())];assert not low
inputs=sorted({f for j in [*jobs,*attempts] for f in j['referenced_image_paths']})
input_records=[{'file':f,'sha256':sha(f),'bytes':Path(f).stat().st_size} for f in inputs]
for a in attempts:
 a['sha256']=sha(a['generatedOriginal']);a['bytes']=Path(a['generatedOriginal']).stat().st_size
write(p/'generation-attempts.json',attempts)
notes={
 'eira_mad':'Composition and face scale retained; two expression-only corrections produced only a small change. A faint upturn remains on close inspection, so full emotional neutrality is not claimed.',
 'heinrich_mad':'Removed the incorrectly mirrored scar from the near anatomical-left cheek; the right-cheek scar is substantially hidden by the new angle.',
 'artoria_mad':'Following pilot review, face enlarged naturally and crown separately reduced; high black waist cord is below this upper-chest crop.',
 'tome_mad':'Head/bust lowered after pilot review. Single monocle remains on anatomical left eye, the far screen-right eye in this view. Waist keys are outside this bust crop.',
 'samira_mad':'Face enlarged to series bust scale. Approved waist document pouch remains below crop; no pouch was moved to chest.',
 'renji_mad':'Face scale prioritized. Wrapped Hwang Yak-sa sword is outside the close bust crop, not redesigned or replaced.',
 'minami_mad':'Twig on anatomical left, matching engine source rather than erroneous v1 painted side.',
 'ratna_mad':'One iguana remains on anatomical left shoulder, screen right.',
 'omari_mad':'Single earring follows engine anatomical right side; tired, non-smiling expression retained.',
 'chanda_mad':'Thin short white gauze and anatomical-left teal sash retained.',
 'bran_mad':'Low kettle hat continues to hide both eyes. No attempt made to expose eyes for matching landmarks.',
 'terracotta_mad':'Pale mature human apparition rather than the base clay statue; thin white Chinese commander cloak retained.'}
visual={
 'method':'Direct visual inspection of every input base original and every generated v2 result, plus a 4x4 browser-rendered contact sheet. No automated face detection or precise equality claim.',
 'contactSheet':'review-sheet.png',
 'initialLandmarkTarget':{'foreheadY':.31,'eyesY':.44,'chinY':.70,'foreheadToChin':.39,'tolerance':.03},
 'targetRevision':'Initial numeric planning guides were superseded during first-four review. Accepted Liao and Maya close-bust visual scale became the reference; subsequent prompts used approximate forehead-to-chin .35, eyes .42, chin .64. Natural anatomy, occlusion and visible eye-to-chin proportion take precedence. These are prompt targets, not measured output claims.',
 'criteria':['Opposite head, neck and upper-torso direction from each base','Close head and upper chest rather than waist-prop-driven half body','Age and facial identity retained','Small Artoria crown; intact Schwarz horns; low Bron kettle hat','Frame 1 square-corner double border, ivory inner background, consistent fine illustration','Anatomical equipment sides checked against engine source','No raster flip, crop, resize or pixelation of portrait originals'],
 'perCharacter':[{'id':r['id'],'baseFacing':r['baseFacing'],'alterFacing':r['alterFacing'],'expressionIntent':r['expressionNote'],'note':notes.get(r['id'],'Reviewed for identity, opposite facing, approved alter costume, close-bust proportions and frame completeness.')} for r in records],
 'knownLimitations':['Tuyana retains a very slight mouth-corner lift at full size despite two expression-only corrections.','Illustrated frame rendering and natural head tilt vary slightly; no exact landmark or pixel-identical frame claim.']}
write(p/'visual-review.json',visual)
provenance={
 'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':'20261017-alter-frame1-v2','scope':'All 16 registered alter NPCs. No registered player alter. High-quality originals only.',
 'canonicalSource':'../pixel_profiles_alter_frame1_20261017/provenance.json','engineReferenceDirectory':'/workspace/portrait-alter-originals-frame1-20261017/references','engineFoundation':'e92b5a6f','engineHeadAtOriginalCapture':'c8ca9c340527de0d60e88d4117f555f248d45d7e',
 'generationTool':'image_gen.imagegen','frame':1,'quality':'original-only','method':'Each portrait was generated or edited independently using approved base identity, approved v1 alter appearance and actual engine reference. New head/neck/shoulder angles were redrawn by image_gen. Limited corrections were also image_gen edits. Every source image was visually inspected before edit.',
 'postprocessing':'Byte-for-byte file copy only. No raster mirroring, cropping, resizing, recoloring, mosaic or low output. review-sheet.png is a browser layout screenshot for QA, not a portrait original.',
 'inputFiles':input_records,'selectedGeneratedOriginals':[{'id':r['id'],'file':r['generatedOriginal'],'sha256':r['original']['sha256']} for r in records],
 'unselectedGeneratedOriginals':[{'id':a['id'],'file':a['generatedOriginal'],'sha256':a['sha256'],'reason':a.get('reason','Pilot adjustment after parent visual review')} for a in attempts],
 'allGeneratedOriginalsPreserved':True,'baseAndV1OriginalsUnchanged':all(unchanged.values()),'protectedOriginalCount':len(unchanged),
 'gameSourceChangedByThisSubtask':False,'gameUIChangedByThisSubtask':False,'remoteWritesByThisSubtask':False,'galleryOwner':'parent agent; index.html not edited by portrait designer','visualReview':'visual-review.json'}
verification={'createdAt':provenance['createdAt'],'completed':16,'expected':16,'allSquare1254':True,'allGeneratedWorkingPublicCopiesIdentical':True,'allIndividualImagesViewed':True,'wholeSheetViewed':True,'allBaseFacingOpposed':True,'originals':checks,'protectedOriginalsUnchanged':unchanged,'lowFilesInV2Directory':low,'manifestQuality':manifest['quality']}
for name,obj in [('provenance.json',provenance),('verification.json',verification)]:write(p/name,obj)
for name in ['canonical-roster.json','generation-jobs.json','generation-attempts.json','completed-records.json','protected-before.json','pilot-records.json','visual-review.json','provenance.json','verification.json','prepare.py','register.py','finalize.py','review-sheet.mjs','review-sheet.html','review-sheet.png']:
 shutil.copyfile(p/name,doc/name)
write(doc/'manifest.json',manifest)
print(json.dumps({'count':16,'dimensions':'1254x1254','totalBytes':sum(r['original']['bytes'] for r in records),'protectedOriginalsUnchanged':len(unchanged),'noLow':True,'selected':16,'unselectedPreserved':len(attempts),'inputFilesVerified':len(inputs),'docs':str(doc)},ensure_ascii=False))
