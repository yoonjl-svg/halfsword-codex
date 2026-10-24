"""Rebuild the three CC0 contact samples from the preserved HQ preview. Requires numpy + ffmpeg."""
from pathlib import Path
import subprocess, json, numpy as np
root = Path(__file__).resolve().parents[2]
d = root / 'docs/design/whip_ghost_20261025/audio'
spec = json.loads((d / 'source.json').read_text())
x = np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(d/'leather-belt-hq.mp3'),'-ac','1','-ar','44100','-f','f32le','-']),dtype=np.float32)
for item in spec['edits']:
    start = item['startSeconds']; end = start + item['durationSeconds']
    samples = x[int(start*44100):int(end*44100)]
    filtered = np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-f','f32le','-ar','44100','-ac','1','-i','-','-af','highpass=f=60,lowpass=f=11000,afade=t=in:d=0.001,afade=t=out:st=0.31:d=0.05','-f','f32le','-'],input=samples.tobytes()),dtype=np.float32)
    gain = 10**(item['targetPeakDbFS']/20) / float(np.max(np.abs(filtered)))
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','44100','-ac','1','-i','-','-c:a','libmp3lame','-q:a','2',str(root/item['file'])],input=(filtered*gain).astype(np.float32).tobytes(),check=True)
