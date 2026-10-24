from pathlib import Path
import json,hashlib,shutil,subprocess,re,html
import numpy as np
root=Path(__file__).resolve().parents[3];doc=root/'docs/audio/whip_cc0_20261024';pub=root/'public/encounters/whip-cc0-20261024';tmp=doc/'sources';sr=44100
items=[
 dict(id='C1',key='dimitris',title='whip.mp3',author='DimitrisM',url='https://freesound.org/people/DimitrisM/sounds/347696/',media='https://cdn.freesound.org/previews/347/347696_6321099-hq.mp3',description='제작자 설명: ZOOM으로 녹음한 채찍 소리, 효과 처리 없음.',ranges=[(1.54,.60)]),
 dict(id='C2',key='scifi',title='Whip Crack.m4a',author='SciFiSounds',url='https://freesound.org/people/SciFiSounds/sounds/529925/',media='https://cdn.freesound.org/previews/529/529925_11751070-hq.mp3',description='0.534초 단발 채찍 효과음. 제작 방식은 설명에 기재되어 있지 않음.',ranges=[(0,.5340589569)]),
 dict(id='C3',key='profispiesser',title='FX SaSc Whip Lash Hit Karbatsche.wav',author='Profispiesser',url='https://freesound.org/people/Profispiesser/sounds/583067/',media='https://cdn.freesound.org/previews/583/583067_6667441-hq.mp3',description='Karbatsche 채찍으로 표기된 43.92초 자료. 서로 다른 타격 세 개를 비교용으로 발췌.',ranges=[(9.54,.60),(19.30,.60),(37.85,.60)])]
for it in items:
 page=(tmp/(it['key']+'.html')).read_bytes();assert b'creativecommons.org/publicdomain/zero/1.0/' in page
 source=tmp/(it['id']+'-hq-preview.mp3');shutil.copy2(source,pub/'audio'/(it['id']+'-source.mp3'))
 x=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar',str(sr),'-f','f32le','pipe:1']),dtype='<f4').copy();clips=[];edits=[]
 for index,(start,duration) in enumerate(it['ranges']):
  c=x[round(start*sr):round((start+duration)*sr)].copy();gain=10**(-6/20)/max(abs(c));c*=gain;ni=min(44,len(c));no=min(1544,len(c));c[:ni]*=np.linspace(0,1,ni);c[-no:]*=np.linspace(1,0,no);clips.append(c)
  edits.append({'startSeconds':start,'durationSeconds':len(c)/sr,'gainDb':float(20*np.log10(gain))})
 def encode(c,name):
  out=pub/'audio'/name
  subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(sr),'-ac','1','-i','pipe:0','-c:a','libmp3lame','-q:a','2',str(out)],input=c.astype('<f4').tobytes(),check=True)
 encode(clips[0],it['id']+'-single.mp3')
 sequence=clips if len(clips)==3 else clips*3
 encode(np.concatenate([np.concatenate([c,np.zeros(round(.65*sr),dtype=np.float32)]) for c in sequence]),it['id']+'-three.mp3')
 it.update(license='CC0 1.0',licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/',licenseVerifiedFrom='individual sound page, not search filter alone',sourceKind='Freesound HQ MP3 preview; not original uploaded WAV/M4A',sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),pageSha256=hashlib.sha256(page).hexdigest(),originalPageSha256=(tmp/(it['key']+'.originalsha256')).read_text().strip(),pageEvidence='verified description/license excerpt; site scripts and forms omitted',edits=edits,repeatMode='three different strikes' if len(clips)==3 else 'same strike repeated three times',processing='mono 44.1 kHz, peak -6 dBFS, 1 ms fade in / 35 ms fade out, MP3 q2; no EQ, pitch or tempo change');it.pop('ranges')
report={'date':'2026-10-24','scope':'CC0 search and listening comparison only; no game audio/character voices changed, no peer message','candidates':items,'additionalChecked':[{'title':'Whipping','author':'SoundsExciting','url':'https://freesound.org/people/SoundsExciting/sounds/204358/','license':'CC0','reasonNotShortlisted':'long repeated whipping; shortlist prioritizes three distinct compact/raw/multiple-strike options'},{'title':'Whip sound','author':'Reemax','url':'https://opengameart.org/content/whip-sound','reasonNotShortlisted':'CC BY 3.0/4.0, attribution required'},{'title':'Whip Cracks / cleanup remix','url':'https://freesound.org/people/martian/sounds/529783/','license':'CC0','reasonNotShortlisted':'original contains music and mic handling; prefer cleaner origin without relying on removal'}]}
(doc/'sources.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');shutil.copy2(doc/'sources.json',pub/'sources.json');print(json.dumps({'candidates':3,'audioFiles':len(list((pub/'audio').glob('*.mp3'))),'bytes':sum(p.stat().st_size for p in (pub/'audio').glob('*.mp3'))}))
