#!/usr/bin/env python3
"""Compact preserved memory-lifecycle screen; never rerun or overwrite evidence."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--evidence-dir',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
if a.out.exists():raise SystemExit('Refusing overwrite')
batches=[]
for tag in ['r1-legacy','r2-projected','r2-legacy-left','r2-legacy-right']:
 path=a.evidence_dir/f'q02-contact-memory-{tag}.json';blob=path.read_bytes();d=json.loads(blob)
 if d['error'] or not d['sourceStable'] or not d['headStable']:raise SystemExit('Invalid run '+tag)
 if not all(all(v is True for k,v in g.items() if k not in ['scenario','variant']) for g in d['guards']):raise SystemExit('Failed guard '+tag)
 details=[]
 for r in d['rows']:
  if r['comTransfer']['variant']=='observe':continue
  fs=r['comTransfer']['frames'];post=[f for f in fs if r['firstStandS'] is not None and f['timeS']>=r['firstStandS']]
  peak=max(post,key=lambda f:f['KJ']) if post else None
  first=r['comTransfer']['touchdown'];first=next((f for f in first if f['state']=='stand'),None)
  details.append({'scenario':r['scenario'],'variant':r['comTransfer']['variant'],'peakKFrame':peak,
   'firstStandFootMemory':first['cachedGait'] if first else None,
   'firstStandPinExplicitWorkApproxJ':sum(x['workApproxJ'] for x in first['pinPaths'].values()) if first else None})
 batches.append({'path':str(path),'rawSha256':hashlib.sha256(blob).hexdigest(),'bytes':len(blob),**{k:d[k] for k in ['createdUTC','command','headBefore','headAfter','headStable','sourceBefore','sourceAfter','sourceStable','cloneSha','wallSeconds','protocol','guards','summary']},'details':details})
audit=a.evidence_dir/'q02-contact-memory-audit.json';archive=a.evidence_dir/'recovery_contact_memory_probe_r1.mjs'
result={'schemaVersion':1,'batches':batches,'independentAudit':{'path':str(audit),'sha256':hashlib.sha256(audit.read_bytes()).hexdigest(),'report':json.loads(audit.read_text())},'originalProbeArchive':{'path':str(archive),'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()},'failedBatch':{'path':str(a.evidence_dir/'q02-contact-memory-r1-projected.json'),'sha256':hashlib.sha256((a.evidence_dir/'q02-contact-memory-r1-projected.json').read_bytes()).hexdigest(),'reason':'Guard incorrectly required later stance reentry native state to match baseline after physical intervention. First-entry-only equality corrected; original partial run retained; not independent evidence.'},'decision':'Legacy six-condition initial screen supports a lifecycle fix candidate; projected support still fails recovery. No default promotion or full physical-realism claim.'}
a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(a.out)
