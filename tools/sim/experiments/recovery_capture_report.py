#!/usr/bin/env python3
"""Read-only compact report from preserved round8/9 capture evidence."""
import json,hashlib,argparse
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--evidence-dir',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
base=args.evidence_dir;batches=[]
for model in ['legacy','projected']:
 p=base/f'q02-capture-r1-{model}.json';blob=p.read_bytes();d=json.loads(blob)
 assert not d['error'] and d['sourceStable'] and d['headStable']
 assert all(all(v is True for k,v in g.items() if k not in ['scenario','variant']) for g in d['guards'])
 prior=json.loads((base/f'q02-com-transfer-r2-{model}.json.summary.json').read_text())
 comparisons=[]
 for scenario in ['healthy_getup','hurt_getup']:
  rows={r['comTransfer']['variant']:r for r in d['rows'] if r['scenario']==scenario}
  for mode,oldmode in [('baseline','baseline'),('staticCarry','supportShiftCarry')]:
   old=next(r for r in prior['summary'] if r['scenario']==scenario and r['variant']==oldmode)
   assert rows[mode]['traceSha256']==old['traceSha256']
  r=rows['captureCarry'];b=rows['observeCapture'];fs=r['comTransfer']['frames'];bs=b['comTransfer']['frames'];first=next((dict(timeS=x['timeS'],baselineN=y['force'],candidateN=x['force']) for x,y in zip(fs,bs) if x['force']!=y['force']),None)
  assert first
  def points(row):
   frames=row['comTransfer']['frames'];t=row['firstStandS']
   return [dict(timeS=x['timeS'],COM=x['support']['com'],COMVelocity=x['support']['velocity'],COMOutsideM=x['support']['outsideM'],captureOutsideM=x['support']['captureOutsideM'],force=x['force'],KJ=x['KJ'],gapM=x['gapM']) for x in frames if t-.02<=x['timeS']<=t+.06]
  comparisons.append(dict(scenario=scenario,baselineAndStaticPriorTraceExact=True,firstActualHorizontalForceDifference=first,handover={m:points(rows[m]) for m in ['baseline','staticCarry','captureCarry']}))
 batches.append(dict(path=str(p),rawSha256=hashlib.sha256(blob).hexdigest(),bytes=len(blob),**{k:d[k] for k in ['createdUTC','command','headBefore','headAfter','headStable','sourceBefore','sourceAfter','sourceStable','cloneSha','wallSeconds','guards','protocol','summary']},comparisons=comparisons))
out=args.out
assert not out.exists();out.write_text(json.dumps(dict(schemaVersion=1,batches=batches,decision='Rejected for general or public trial adoption: legacy injury max foot-point slip worsens despite partial gap/mean improvement. Candidate retains direct horizontal/upright support; not complete reaction-driven recovery.'),indent=2,ensure_ascii=False)+'\n')
print(out)
