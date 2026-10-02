"""Round 3 listening package: one fixed gain per candidate, no added compressor.

Measurements describe the render, not perceived realism. Requires numpy/scipy/ffmpeg.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

root=Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/halfsword-sound-review/2026-10-02-round3')
sr=48000
variants=['draw','fiber','stroke','hew']
names={'draw':'00-previous-A2','fiber':'01-previous-B2','stroke':'02-A3-linked-cut','hew':'03-B3-linked-heavy'}
onsets=[.25,2.05,3.85]
def measure(p):
    proc=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-af',
        'loudnorm=I=-21:TP=-2:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    return json.loads(re.findall(r'\{\s*"input_i".*?\}',proc.stderr,re.S)[-1])
def floatwav(p,x): wavfile.write(p,sr,np.asarray(x,dtype=np.float32))
def wav(p,x):
    assert np.isfinite(x).all() and np.max(np.abs(x))<1
    wavfile.write(p,sr,np.round(x*32767).astype(np.int16))
def mp3(p):
    q=p.with_suffix('.mp3')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p),'-c:a','libmp3lame','-b:a','192k',str(q)],check=True)
    return q
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def event_metrics(x):
    energy=x*x; total=float(energy.sum()); c=np.cumsum(energy)/max(total,1e-20)
    t05,t50,t95=[float(np.searchsorted(c,q)/sr) for q in [.05,.5,.95]]
    bands={}
    for lo,hi in [(35,300),(300,1000),(1000,2500),(2500,12000)]:
        y=sosfilt(butter(3,[lo,hi],btype='bandpass',fs=sr,output='sos'),x)
        bands[f'{lo}-{hi}Hz']=float(np.sum(y*y)/max(total,1e-20))
    bins=np.sqrt(np.mean(x[:int(len(x)/480)*480].reshape(-1,480)**2,axis=1))
    phases={}
    for name,start,end in [('entry',.020,.060),('resistance',.070,.150),('clearing',.180,.280)]:
        section=x[round(start*sr):round(end*sr)]
        phases[name]={'rms':float(np.sqrt(np.mean(section**2)))}
    progression={'rms10msPeakTimeS':float(np.argmax(bins)*.01),'phases':phases,
        'entryOverClearingDb':float(20*np.log10(max(phases['entry']['rms'],1e-20)/max(phases['clearing']['rms'],1e-20))),
        'minimum10msRMSBetween20and180ms':float(bins[2:18].min())}
    # Broadband time energy, without a window that suppresses the initial hit.
    return {'progression':progression,'energyT05S':t05,'energyT50S':t50,'energyT95S':t95,'energySpan05to95S':t95-t05,
        'first20msEnergyFraction':float(energy[:round(.02*sr)].sum()/total),
        'after100msEnergyFraction':float(energy[round(.1*sr):].sum()/total),
        'filteredBandEnergyOverBroadband':bands}

render=json.loads((root/'render.json').read_text()); assert render['pass'] and render['sourceStable']
mixes={}; raw={}
for v in variants:
    x=np.zeros(round(5.8*sr),dtype=np.float64)
    for t,seed in zip(onsets,[71,172,273]):
        a=np.fromfile(root/f'{v}-heavy-{seed}.f32',dtype='<f4')
        assert len(a)==74400 and np.isfinite(a).all()
        i=round(t*sr); x[i:i+len(a)]+=a
    mixes[v]=x
    p=root/f'{v}-unmastered.wav'; floatwav(p,x); raw[v]=measure(p)
target=min(-21.,*[float(raw[v]['input_i'])-float(raw[v]['input_tp'])-2.5 for v in variants])
report={'sampleRate':sr,'targetLUFS':target,'method':'EBU R128 integrated over three spaced 140 J hits; one constant linear gain per variant; no added dynamics processor',
    'onsetsS':onsets,'rows':[],'limitations':['Loudness matching is for the whole three-hit clip, not equal subjective loudness of every moment.',
    'Time/frequency energy is not evidence of human-perceived cutting or realism.','Bandpass energies overlap at transitions and do not sum exactly to one.']}
gains={}
for v in variants:
    gain_db=target-float(raw[v]['input_i'])
    p=root/f'{names[v]}.wav'
    for attempt in range(3):
        gain=10**(gain_db/20); wav(p,mixes[v]*gain); q=mp3(p); final=measure(q)
        error=target-float(final['input_i'])
        if abs(error)<.15: break
        if attempt<2: gain_db+=error
    assert abs(float(final['input_i'])-target)<.15,final
    assert float(final['input_tp'])< -1.5,final
    gains[v]=gain
    report['rows'].append({'variant':v,'file':q.name,'rawLUFS':float(raw[v]['input_i']),'gainDb':gain_db,
        'finalLUFS':float(final['input_i']),'truePeakDbTP':float(final['input_tp']),
        'events':[{'seed':seed,**event_metrics(np.fromfile(root/f'{v}-heavy-{seed}.f32',dtype='<f4').astype(float)*gain)} for seed in [71,172,273]],
        'wavSHA256':sha(p),'mp3SHA256':sha(q),'bytes':q.stat().st_size})
for label,order in [('04-A3-B3-comparison',['stroke','hew','stroke','hew']),('05-A2-A3-B3',['draw','stroke','hew'])]:
    x=np.zeros(round((len(order)*1.9+.3)*sr)); slots=[]
    for j,v in enumerate(order):
        t=.25+j*1.9; a=np.fromfile(root/f'{v}-heavy-71.f32',dtype='<f4')*gains[v]
        i=round(t*sr); x[i:i+len(a)]+=a; slots.append({'variant':v,'onsetS':t})
    p=root/f'{label}.wav'; wav(p,x); q=mp3(p)
    report[label]={'file':q.name,'order':slots,'mp3SHA256':sha(q),'measure':measure(q)}
for v in ['stroke','hew']:
    x=np.zeros(round(5.8*sr))
    for t,k in zip(onsets,['cut','heavy','through']):
        a=np.fromfile(root/f'{v}-{k}-71.f32',dtype='<f4')*gains[v]
        i=round(t*sr); x[i:i+len(a)]+=a
    wav(root/f'{v}-normal-heavy-through.wav',x)
(root/'listening-metrics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'targetLUFS':target,'rows':[{k:r[k] for k in ['variant','file','finalLUFS','truePeakDbTP']} for r in report['rows']]},indent=2))
