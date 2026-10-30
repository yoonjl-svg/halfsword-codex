from pathlib import Path
import json,hashlib,urllib.request,concurrent.futures,os
root=Path(__file__).resolve().parents[3];doc=Path(__file__).resolve().parent;pub=root/'public/encounters/julia-alter-profile-20261030';url='https://yoonjl-svg.github.io/halfsword-codex/encounters/julia-alter-profile-20261030/'
commit=os.environ['PROFILE_COMMIT'];run=int(os.environ['PROFILE_RUN'])
def verify(p):
    data=urllib.request.urlopen(url+p.name+'?verify='+commit[:8],timeout=45).read();h=hashlib.sha256(data).hexdigest();assert h==hashlib.sha256(p.read_bytes()).hexdigest(),p.name
    return {'file':p.name,'bytes':len(data),'sha256':h}
with concurrent.futures.ThreadPoolExecutor(6) as pool:rows=list(pool.map(verify,[p for p in pub.iterdir() if p.is_file()]))
(doc/'publication.json').write_text(json.dumps({'publishedCommit':commit,'pagesRun':run,'url':url,'hashMatches':True,'files':rows,'peerWrites':0,'gameUiConnected':False},indent=2)+'\n');print('Remote files identical:',len(rows))
