"""Package actual production output unchanged; no mastering/gain adjustment."""
from pathlib import Path
import hashlib,json,re,subprocess,sys
import numpy as np
from scipy.io import wavfile
root=Path(sys.argv[1]); target=Path('docs/sound/samples/2026-10-02-selected-short')
target.mkdir(parents=True,exist_ok=True)
render=json.loads((root/'render.json').read_text());assert render['pass'] and render['sourceStable']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def energy(x,sr):
 assert np.isfinite(x).all()
 z=x.astype(float)**2; total=z.sum();assert total>0
 c=np.cumsum(z)/total
 ts=[float(np.searchsorted(c,q)/sr) for q in [.05,.5,.95,.999]]
 return dict(zip(['t05S','t50S','t95S','t999S'],ts))|{'peakAbs':float(np.abs(x).max()),'rms':float(np.sqrt(np.mean(z)))}
def measure(p):
 r=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-af','loudnorm=I=-21:TP=-2:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
 return json.loads(re.findall(r'\{\s*"input_i".*?\}',r.stderr,re.S)[-1])
rows=[]
for r in render['rows']:
 p=root/r['filename'];assert sha(p)==r['sha256'];x=np.fromfile(p,dtype='<f4');assert len(x)==r['samples']
 rows.append({**r,'output':energy(x,r['sr'])})
clips=[]
for id,name in [('listening-weak','01-A2-short-weak'),('listening-strong','02-B2-short-strong'),('listening-weak-strong','03-weak-strong-comparison')]:
 r=next(r for r in rows if r['id']==id);x=np.fromfile(root/r['filename'],dtype='<f4');sr=r['sr']
 p=root/(name+'.wav');wavfile.write(p,sr,x) # Floating WAV preserves the production render.
 q=target/(name+'.mp3');assert not q.exists(),'Do not overwrite listening files'
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p),'-c:a','libmp3lame','-b:a','192k',str(q)],check=True)
 decoded=subprocess.run(['ffmpeg','-v','error','-i',str(q),'-f','f32le','-ac','1','-ar',str(sr),'pipe:1'],capture_output=True,check=True).stdout
 y=np.frombuffer(decoded,dtype='<f4');m=measure(q)
 assert len(y)==len(x) and np.isfinite(y).all() and np.abs(y).max()<1
 assert float(m['input_tp']) < -1.5,m
 clips.append({'file':str(q),'sha256':sha(q),'bytes':q.stat().st_size,'durationS':len(y)/sr,'gainDbAdded':0,'LUFS':float(m['input_i']),'truePeakDbTP':float(m['input_tp']),'raw':energy(x,sr),'decoded':energy(y,sr),'events':r['timeline']})
comparisons=[]
for sr in [44100,48000]:
 for seed in [71,172,273]:
  a=next(r for r in rows if r['id']==f'cut-90-{seed}-{sr}')
  b=next(r for r in rows if r['id']==f'cut-140-{seed}-{sr}')
  olda=next(r for r in rows if r['id']==f'original-draw-{seed}-{sr}')
  oldb=next(r for r in rows if r['id']==f'original-fiber-{seed}-{sr}')
  vals=[r['output']['t95S'] for r in [a,b,olda,oldb]]
  assert vals[0]<vals[1] and vals[0]<vals[2] and vals[1]<vals[3],vals
  comparisons.append({'sr':sr,'seed':seed,'weakT95S':vals[0],'strongT95S':vals[1],'originalA2T95S':vals[2],'originalB2T95S':vals[3]})
report={**render,'rows':rows,'renderPath':str(root/'render.json'),'renderSHA256':sha(root/'render.json'),'clips':clips,'durationComparisons':comparisons,'limitations':['Production render unchanged before MP3 encoding; no post-render gain/normalization.','Reference A2/B2 renders retain old event path; shortening and energy selection change output, not byte-exact timbre proof.','Time/loudness checks do not establish subjective naturalness or phone speaker approval.','The 48-hit simultaneous overlap rows are synthetic stress, not 48 independently played combat events.'],'packagerSHA256':sha(Path(__file__))}
Path('docs/sound/slash_selected_short_metrics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'rows':len(rows),'clips':clips,'durationComparisons':comparisons},ensure_ascii=False,indent=2))
