"""Deterministic Stillness sound drafts. Python + NumPy/SciPy + FFmpeg.
No game code is changed. Source recordings and licensing are in sources/evidence.json.
"""
from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from scipy import signal

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'exports'; OUT.mkdir(exist_ok=True)
SR=48000
def decode(path):
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(path)]))['streams'][0]
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-f','f32le','-'])
    # Average the native channels, avoiding ffmpeg's energy-preserving +3 dB downmix.
    return np.frombuffer(raw,'<f4').reshape(-1,info['channels']).mean(axis=1).astype(float)
def band(x,lo=180,hi=6500):
    return signal.sosfilt(signal.butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),x)
def fade(x,attack=.001,release=.04):
    x=x.copy();a=min(len(x),round(attack*SR));r=min(len(x),round(release*SR))
    if a:x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
    if r:x[-r:]*=np.cos(np.linspace(0,np.pi/2,r))**2
    return x
def norm(x,db=-8):
    return x/(max(abs(x))+1e-12)*10**(db/20)
def length(x,seconds):
    n=round(seconds*SR);return np.pad(x[:n],(0,max(0,n-len(x))))
def place(dst,src,offset=0,gain=1):
    i=round(offset*SR);n=min(len(src),len(dst)-i)
    if n>0:dst[i:i+n]+=src[:n]*gain
def rate(x,r):
    return signal.resample_poly(x,1000,round(r*1000))
def tempo(x,r):
    p=subprocess.run(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-af',f'atempo={r}','-f','f32le','pipe:1'],input=x.astype('<f4').tobytes(),capture_output=True,check=True)
    return np.frombuffer(p.stdout,'<f4').astype(float)
def segment(name,start,end):
    return decode(ROOT/'sources'/name)[round(start*SR):round(end*SR)]

rng=np.random.default_rng(20261025)
# S1: a restrained breath/inharmonic metal signature; no imported sample.
t=np.arange(round(.48*SR))/SR
air=band(rng.normal(size=len(t)),500,3100)
air=norm(air,0)*(1-np.exp(-t/.003))*np.exp(-t/.070)
hit_t=np.maximum(0,t-.018);gate=(t>=.018)*(1-np.exp(-hit_t/.0015))
modal=np.zeros(len(t))
for f,amp,decay in [(370,1,.060),(615,.5,.070),(1035,.24,.092),(1690,.16,.056),(2480,.07,.034)]:
    modal+=amp*np.sin(2*np.pi*(f*hit_t+8*.012*(1-np.exp(-hit_t/.012))))*np.exp(-hit_t/decay)*gate
common=norm(fade(band(modal*.70+air*.95,220,4600),.002,.075),-10)

# G1: a short release/clack + steel friction, lower register, no long fantasy ring.
release=fade(band(segment('seax-unsheathe-02.wav',.247,.330),220,5000),.001,.025)
metal=fade(band(rate(segment('581594-hq-preview.mp3',.400,.680),.93),350,5800),.001,.075)
pull=fade(band(tempo(segment('772113-hq-preview.mp3',.150,.405),1.65),350,6000),.003,.035)
g1=np.zeros(round(.34*SR));place(g1,norm(release,0),0,.46);place(g1,norm(metal,0),.016,.87);place(g1,norm(pull,0),.010,.19)
# Quiet the steel tail after 120 ms so it leaves space for the actual hit.
g1*=np.exp(-np.maximum(0,np.arange(len(g1))/SR-.12)/.065)
g1=norm(fade(g1,.001,.065),-8)

# G2: a drier alternative, keeping more of the studio sword/leather draw.
g2=np.zeros(round(.32*SR));place(g2,norm(release,0),0,.6)
natural=fade(band(tempo(segment('772113-hq-preview.mp3',.155,.555),1.4),250,5600),.002,.050)
place(g2,norm(natural,0),.010,.72);place(g2,norm(metal,0),.010,.19)
g2*=np.exp(-np.maximum(0,np.arange(len(g2))/SR-.19)/.05)
g2=norm(fade(g2,.001,.055),-8)

# Recommended game trigger for Gono Sen: one prepared file rather than two full cues.
# The same S1 onset is present at -9.1 dB relative to its standalone gain.
merged=np.zeros(round(.36*SR));place(merged,g1);signature=fade(common[:round(.13*SR)],.001,.045);place(merged,signature,0,.35)
merged=fade(merged,.001,.035)

def pcm(path,x):
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-c:a','pcm_s24le',str(path)],input=x.astype('<f4').tobytes(),check=True)
def export(name,x):
    wav=OUT/(name+'.wav');pcm(wav,x)
    for suffix,codec in [('mp3',['-c:a','libmp3lame','-q:a','2']),('ogg',['-c:a','libvorbis','-q:a','6'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),*codec,str(OUT/(name+'.'+suffix))],check=True)

assets={'secret-common-s1':common,'gonosen-g1-clank':g1,'gonosen-g2-dry':g2,'gonosen-g1-with-signature':merged}
for name,x in assets.items():export(name,x)

# Review fixtures: repeat, a mono band-limit proxy, and a fixed-time hit overlay.
# This is a listening test arrangement, not captured game combat / phone hardware.
for name,x in assets.items():
    repeated=np.zeros(round(3.7*SR))
    for offset in [.20,1.40,2.60]:place(repeated,x,offset)
    pcm(OUT/(name+'-repeat.wav'),repeated)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/(name+'-repeat.wav')),'-c:a','libmp3lame','-q:a','2',str(OUT/(name+'-repeat.mp3'))],check=True)
    (OUT/(name+'-repeat.wav')).unlink()

reference=ROOT/'sources'/'game-edge1-reference.mp3'
if reference.exists():
    hit=norm(fade(length(decode(reference),.28),.001,.035),-5)
    for name,cue in [('common',common),('gonosen',merged)]:
        context=np.zeros(round(3.6*SR))
        for start,with_cue in [(.20,False),(1.40,True),(2.60,True)]:
            if with_cue:place(context,cue,start)
            place(context,hit,start+.16)
        # Preserve the relative loudness; use one safety scale only if necessary.
        if max(abs(context))>10**(-2/20):context*=10**(-2/20)/max(abs(context))
        pcm(OUT/(name+'-then-hit.wav'),context)
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/(name+'-then-hit.wav')),'-c:a','libmp3lame','-q:a','2',str(OUT/(name+'-then-hit.mp3'))],check=True)
        (OUT/(name+'-then-hit.wav')).unlink()

def preview_mp3(name,x):
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-c:a','libmp3lame','-q:a','2',str(OUT/(name+'.mp3'))],input=x.astype('<f4').tobytes(),check=True)
comparison=np.zeros(3*SR);place(comparison,g1,.20);place(comparison,g2,1.65)
preview_mp3('gonosen-a-b',comparison)
for name,x in [('secret-common-s1',common),('gonosen-g1-clank',g1)]:
    preview_mp3(name+'-phone-band',band(x,350,4500))

manifest={}
for name,x in assets.items():
    energies=x*x; cumulative=np.cumsum(energies)/sum(energies)
    phone=band(x,350,4500)
    row={'durationSeconds':len(x)/SR,'sampleRate':SR,'channels':1,'pcmPeakDbFS':float(20*np.log10(max(abs(x))+1e-12)),
         'energy90ms':round(np.searchsorted(cumulative,.9)/SR*1000,2),'energy99ms':round(np.searchsorted(cumulative,.99)/SR*1000,2),
         'phoneBandEnergyFraction':float(sum(phone*phone)/sum(energies)),'files':{}}
    for ext in ['wav','mp3','ogg']:
        f=OUT/(name+'.'+ext);decoded=decode(f);tp=max(abs(signal.resample_poly(decoded,4,1)))
        row['files'][ext]={'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'decodedSeconds':len(decoded)/SR,'truePeak4xDbFS':float(20*np.log10(tp+1e-12))}
        assert np.isfinite(decoded).all() and tp<10**(-2/20)
    assert abs(x[0])<1e-8 and abs(x[-1])<1e-8
    manifest[name]=row
(ROOT/'measurements.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({n:{k:v for k,v in r.items()if k!='files'}for n,r in manifest.items()},indent=2))
