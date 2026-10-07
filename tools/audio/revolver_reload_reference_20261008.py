"""Rebuild the CC0 excerpts from the public HQ preview; do not substitute an unverified source.

Usage: python tools/audio/revolver_reload_reference_20261008.py /path/to/508744_1934171-hq.mp3
Source URL and license: public/sfx/revolver/README.md. Requires ffmpeg.
"""
import array,hashlib,json,math,pathlib,subprocess,sys,wave
root=pathlib.Path(__file__).resolve().parents[2]; dest=root/'public/sfx/revolver';dest.mkdir(parents=True,exist_ok=True)
src=pathlib.Path(sys.argv[1])
assert hashlib.sha256(src.read_bytes()).hexdigest() == '05bcb3971d11396050ffbe24be9f9c49b29ceecf90630f982dec61c4a9a8755a', 'Source preview checksum mismatch'
segments={'open':[(4.88,5.18),(5.83,6.40)],'insert1':[(8.85,9.28)],'insert2':[(10.69,11.02)],'insert3':[(12.55,12.92)],'insert4':[(14.28,14.70)],'insert5':[(15.91,16.48)],'insert6':[(17.99,18.29)],'close':[(19.22,19.56)]}
sr=48000;meta=[]
for name,ranges in segments.items():
 chunks=[]
 for start,end in ranges:
  raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(src),'-af',f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=9500','-ac','1','-ar',str(sr),'-f','f32le','-'])
  x=array.array('f');x.frombytes(raw)
  # Short fades remove edit boundaries; preserve recorded transient/decay, no pitch changes.
  fadein=round(.003*sr);fadeout=round(.028*sr)
  for i in range(fadein):x[i]*=i/fadein
  for i in range(fadeout):x[-1-i]*=i/fadeout
  chunks.extend(x)
 peak=max(map(abs,chunks));scale=.78/peak
 pcm=array.array('h',(round(max(-1,min(1,v*scale))*32767) for v in chunks))
 path=dest/(name+'.wav')
 with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes())
 meta.append({'file':str(path.relative_to(root)),'sourceRangesSeconds':ranges,'durationSeconds':len(pcm)/sr,'gainLinear':scale,'peak':max(map(abs,pcm))/32768,'rms':math.sqrt(sum((v/32768)**2 for v in pcm)/len(pcm)),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(dest/'provenance.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
