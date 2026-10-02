"""Package the isolated browser renders; requires numpy, scipy and ffmpeg.

One linear gain per candidate, measured by EBU R128 over the same three hits.
No compressor/limiter added for mastering. Raw renders remain available.
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

root = Path(sys.argv[1] if len(sys.argv)>1 else '/workspace/halfsword-sound-review/2026-10-02')
sr=48000
variants=['current','edge','cleave']
names={'current':'00-current','edge':'01-A-sharp-cut','cleave':'02-B-deep-cleave'}
def measure(p):
    proc=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(p),'-af',
        'loudnorm=I=-20:TP=-2:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    block=re.findall(r'\{\s*"input_i".*?\}',proc.stderr,re.S)[-1]
    return json.loads(block)
def floatwav(p,x): wavfile.write(p,sr,np.asarray(x,dtype=np.float32))
def wav(p,x):
    assert np.isfinite(x).all() and np.max(np.abs(x))<1
    wavfile.write(p,sr,np.round(x*32767).astype(np.int16))
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

mixes={}; raw={}
for v in variants:
    x=np.zeros(round(5.8*sr),dtype=np.float64)
    for t,seed in zip([.25,2.05,3.85],[71,172,273]):
        a=np.fromfile(root/f'{v}-heavy-{seed}.f32',dtype='<f4')
        assert len(a)==74400 and np.isfinite(a).all()
        i=round(t*sr); x[i:i+len(a)]+=a
    mixes[v]=x
    p=root/f'{v}-unmastered.wav'; floatwav(p,x); raw[v]=measure(p)
target=min(-20.,*[float(raw[v]['input_i'])-float(raw[v]['input_tp'])-2.5 for v in variants])
report={'sampleRate':sr,'targetLUFS':target,'method':'EBU R128 integrated over three spaced 140 J hits; one constant linear gain per variant; no added dynamics processor','onsetsS':[.25,2.05,3.85],'rows':[]}
gains={}
for v in variants:
    gain_db=target-float(raw[v]['input_i'])
    p=root/f'{names[v]}.wav'; mp3=p.with_suffix('.mp3')
    # Lossy encoding changes noise energy slightly. Correct constant gain against
    # the delivered MP3, without adding compression to any candidate.
    for attempt in range(3):
        gain=10**(gain_db/20); x=mixes[v]*gain; wav(p,x)
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p),'-c:a','libmp3lame','-b:a','192k',str(mp3)],check=True)
        final=measure(mp3)
        error=target-float(final['input_i'])
        if abs(error)<.15: break
        if attempt<2: gain_db+=error
    gains[v]=gain
    assert abs(float(final['input_i'])-target)<.15, final
    assert float(final['input_tp'])< -1.5, final
    a=np.fromfile(root/f'{v}-heavy-71.f32',dtype='<f4').astype(float)*gain
    energies={}
    for lo,hi in [(35,300),(300,2500),(2500,12000)]:
        filtered=sosfilt(butter(3,[lo,hi],btype='bandpass',fs=sr,output='sos'),a[:round(.15*sr)])
        energies[f'{lo}-{hi}Hz']=float(np.sum(filtered**2))
    report['rows'].append({'variant':v,'file':mp3.name,'rawLUFS':float(raw[v]['input_i']),'gainDb':gain_db,
        'finalLUFS':float(final['input_i']),'truePeakDbTP':float(final['input_tp']),
        'first150msBandEnergy':energies,'wavSHA256':sha(p),'mp3SHA256':sha(mp3),'bytes':mp3.stat().st_size})
# One three-way comparison, same seeded 140 J event in current -> A -> B order.
x=np.zeros(round(6.8*sr)); slots=[]
for t,v in zip([.25,2.45,4.65],variants):
    a=np.fromfile(root/f'{v}-heavy-71.f32',dtype='<f4')*gains[v]
    i=round(t*sr); x[i:i+len(a)]+=a; slots.append({'variant':v,'onsetS':t})
p=root/'03-current-A-B.wav'; wav(p,x)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p),'-c:a','libmp3lame','-b:a','192k',str(p.with_suffix('.mp3'))],check=True)
report['comparison']={'file':'03-current-A-B.mp3','order':slots,'sha256':sha(p.with_suffix('.mp3'))}
# Optional normal / heavy / pass-through context, not presented as a gameplay recording.
for v in variants:
    x=np.zeros(round(5.8*sr))
    for t,k in zip([.25,2.05,3.85],['cut','heavy','through']):
        a=np.fromfile(root/f'{v}-{k}-71.f32',dtype='<f4')*gains[v]
        i=round(t*sr); x[i:i+len(a)]+=a
    wav(root/f'{v}-normal-heavy-through.wav',x)
(root/'listening-metrics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
