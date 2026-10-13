from pathlib import Path
import subprocess, numpy as np
p=Path(__file__).resolve().parent
sr=44100
for name,start,end,fi,fo in [('isolde_bleed2_candidate',7.87,8.62,.035,.24),('isolde_short_exhale_reserve',.64,1.32,.025,.22)]:
    filters=f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,highpass=f=70,lowpass=f=6500'
    a=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p/'mv855463-full-hq.mp3'),'-af',filters,'-ar',str(sr),'-ac','1','-f','f32le','-']),np.float32).copy()
    a*=.62/max(float(abs(a).max()),1e-9)
    ni=round(fi*sr);no=round(fo*sr)
    a[:ni]*=np.linspace(0,1,ni);a[-no:]*=np.linspace(1,0,no)
    subprocess.run(['ffmpeg','-y','-v','error','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','96k',str(p/(name+'.mp3'))],input=a.tobytes(),check=True)
