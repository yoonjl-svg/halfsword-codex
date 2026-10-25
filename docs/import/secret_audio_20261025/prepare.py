"""User-approved Stillness G1/G2 sound reproduction. Python + NumPy/SciPy + FFmpeg.
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

def pcm(path,x):
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','pipe:0','-c:a','pcm_s24le',str(path)],input=x.astype('<f4').tobytes(),check=True)
def export(name,x):
    wav=OUT/(name+'.wav');pcm(wav,x)
    for suffix,codec in [('mp3',['-c:a','libmp3lame','-q:a','2']),('ogg',['-c:a','libvorbis','-q:a','6'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),*codec,str(OUT/(name+'.'+suffix))],check=True)

assets={'g1-clank':g1,'g2-dry':g2}
for name,x in assets.items():export(name,x)

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
