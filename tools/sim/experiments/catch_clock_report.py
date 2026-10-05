"""Summarize exposure and controller/physical contact evidence without simulation."""
import argparse,json,hashlib,math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--push',required=True);p.add_argument('--combat',required=True);p.add_argument('--out',required=True);a=p.parse_args()
runs=[]
for name,fp in [('controlled_lateral',a.push),('natural_combat',a.combat)]:
 b=Path(fp).read_bytes();r=json.loads(b);assert r['measurementValid']
 rows=[]
 for row in r['rows']:
  steps=[]
  for s in row['steps']:
   if s['kind']!='catch' or 'controllerEndTick' not in s:continue
   h=s['heading'];dx=s['endAnkle']['x']-s['ankle']['x'];dz=s['endAnkle']['z']-s['ankle']['z'];k=s['foot'];end=s['controllerEndTick']
   after=row['samples'][end:];window=row['samples'][s['startTick']:end+1]
   steps.append({'startTick':s['startTick'],'controllerEndTick':end,'controllerSeconds':s['controllerSeconds'],'worldTravelM':{'x':dx,'z':dz},'bodyForwardTravelM':dx*math.cos(h)-dz*math.sin(h),'bodySideTravelM':dx*math.sin(h)+dz*math.cos(h),'maxTiltDeg':max(x['tilt'] for x in window),'maxLevC':max(x['levC'] for x in window),'firstPostControllerPositiveGroundImpulseTick':next((x['tick'] for x in after if x['legs'][k]['rawImpulseNs']>0),None)})
  rows.append({'mode':row['mode'],'sign':row['sign'],'steps':len(row['frames']),'catchTargetCalls':len(row['targets']),'eligibleClockCalls':sum(t['rate']>1 for t in row['targets']),'maxObservedCatchTargetRate':max([t['rate'] for t in row['targets']],default=None),'maxObservedCatchTargetOffBalance':max([t['offBalance'] for t in row['targets']],default=None),'catchSteps':steps})
 pairs=[]
 for i in range(0,len(r['rows']),2):
  x,y=r['rows'][i:i+2];pairs.append({'sign':x['sign'],'allNativeExact':x['frames']==y['frames'],'allInputsExact':x['inputs']==y['inputs']});assert pairs[-1]['allNativeExact'] and pairs[-1]['allInputsExact']
 runs.append({'name':name,'head':r['head'],'raw':{'path':fp,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()},'sourceStable':r['sourceStable'],'sourceBefore':r['sourceBefore'],'command':r['command'],'protocol':r['protocol'],'executions':len(rows),'steps':sum(x['steps'] for x in rows),'wallSeconds':r['wallSeconds'],'rows':rows,'comparisons':pairs})
o={'measurementAccepted':True,'effectAccepted':False,'runtimeChange':False,'judgment':'HOLD: target-time mismatch is statically real only when hurry>0; no candidate exposure in either selected fixture. No efficacy or exposed-safety inference. Stop strength/seed search. User lateral near-fall scene remains unreproduced.','rawMetadataErrata':['combat01 protocol mistakenly says fresh reentry both arms; implementation sets player-only stance/friction memory, no arm memory. Frozen raw remains unchanged.'],'runs':runs,'totals':{'executions':sum(r['executions'] for r in runs),'steps':sum(r['steps'] for r in runs),'wallSeconds':sum(r['wallSeconds'] for r in runs),'candidateChangedTargetCalls':0},'next':'Use actual phone input/replay when capturing integrated fight. Preserve diagnosed clock issue; do not claim it causes the current slow-step perception or ask user to play an identical B.'}
out=Path(a.out);assert not out.exists();out.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n');print(json.dumps(o['totals']))
