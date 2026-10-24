"""Prepare attributed audition clips; game sound routing and originals are unchanged."""
from pathlib import Path
import hashlib,json,subprocess,numpy as np
ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/'docs/audio/whip_20261024'; OUT=ROOT/'public/encounters/whip-sound-20261024/audio';OUT.mkdir(parents=True,exist_ok=True)
def run(args):subprocess.run(['ffmpeg','-y','-v','error',*map(str,args)],check=True)
def pcm(path):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar','44100','-']),np.float32)
def record(p):
 x=pcm(p);return {'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'duration':round(len(x)/44100,4),'decodedPeakDbFS':round(float(20*np.log10(max(abs(x)))),3),'peakAtSeconds':round(int(np.argmax(abs(x)))/44100,4)}
report={}
for name,src,start,duration in [('A','1150',.235,.285),('B','1375',.410,.310)]:
 original=DOC/'sources'/f'{src}.wav';target=OUT/f'{name}.mp3'
 # Source cut, 1ms entry and35ms tail fade, then peak-normalize PCM to -6dBFS.
 tmp=DOC/f'{name}-trim.wav';filt=f'atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.001,afade=t=out:st={duration-.035}:d=0.035'
 run(['-i',original,'-af',filt,'-ac','1','-ar','44100','-c:a','pcm_f32le',tmp])
 x=pcm(tmp);gain=-6-float(20*np.log10(max(abs(x))))
 run(['-i',tmp,'-af',f'volume={gain}dB','-c:a','libmp3lame','-q:a','2',target]);tmp.unlink()
 run(['-i',original,'-af','volume=-6dB','-ac','1','-ar','44100','-c:a','libmp3lame','-q:a','2',OUT/f'{name}-full.mp3'])
 run(['-i',target,'-filter_complex','[0:a]asplit=3[a][b][c];[a]apad=pad_dur=0.42[a1];[b]apad=pad_dur=0.42[b1];[a1][b1][c]concat=n=3:v=0:a=1[out]','-map','[out]','-c:a','libmp3lame','-q:a','2',OUT/f'{name}-three.mp3'])
 report[name]={'source':src,'start':start,'duration':duration,'fadeIn':.001,'fadeOut':.035,'gainDb':round(gain,5),'pitchOrTempoChanged':False,**record(target)}
 assert report[name]['decodedPeakDbFS'] < -3
for n in ['hit1','hit2','hit3','crack1','crack2','crack3']:
 src=ROOT/f'public/sfx/whip/{n}.mp3';gain=-6-float(20*np.log10(max(abs(pcm(src)))))
 run(['-i',src,'-af',f'volume={gain}dB','-c:a','libmp3lame','-q:a','2',OUT/f'current-{n}.mp3'])
 report.setdefault('current',{})[n]={'source':record(src),'previewGainDb':gain,**record(OUT/f'current-{n}.mp3')}
(DOC/'audio-processing.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
