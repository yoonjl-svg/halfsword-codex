from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request
root=Path(__file__).resolve().parents[3];doc=Path(__file__).resolve().parent;pub=root/'public/encounters/julia-native-20261029';base='https://yoonjl-svg.github.io/halfsword-codex/encounters/julia-native-20261029/'
files=[p for p in pub.iterdir() if p.is_file()]+list((pub/'game/assets').rglob('*'))+[pub/'game/index.html',pub/'game/test.html']
files=[p for p in files if p.is_file()]
def get(p):
 rel=p.relative_to(pub).as_posix();data=urllib.request.urlopen(base+rel+'?verify=0b840bb3',timeout=45).read();h=hashlib.sha256(data).hexdigest();assert h==hashlib.sha256(p.read_bytes()).hexdigest(),rel;return {'path':rel,'bytes':len(data),'sha256':h}
with concurrent.futures.ThreadPoolExecutor(8) as pool:rows=list(pool.map(get,files))
(doc/'publication.json').write_text(json.dumps({'source':'46fa690c','published':'0b840bb3f9338cbf96bfb117a06fde2d07a7429f','pagesRun':40880752978,'url':base,'scope':'Gallery images/html and compiled game JS/CSS/fonts plus entry pages; static asset folders exercised by browser separately.','files':len(rows),'bytes':sum(x['bytes'] for x in rows),'hashMatches':True,'assets':rows},indent=2)+'\n');print('Verified',len(rows),'published files')
