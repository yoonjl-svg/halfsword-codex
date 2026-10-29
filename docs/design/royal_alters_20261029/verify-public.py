from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request
root=Path(__file__).resolve().parents[3];doc=Path(__file__).resolve().parent;pub=root/'public/encounters/royal-alters-20261029';base='https://yoonjl-svg.github.io/halfsword-codex/encounters/royal-alters-20261029/'
files=[p for p in pub.iterdir() if p.is_file()]+list((pub/'game/assets').rglob('*'))+[pub/'game/index.html',pub/'game/test.html']
files=[p for p in files if p.is_file()]
def get(p):
 rel=p.relative_to(pub).as_posix();data=urllib.request.urlopen(base+rel+'?verify=a81bf031',timeout=45).read();h=hashlib.sha256(data).hexdigest();assert h==hashlib.sha256(p.read_bytes()).hexdigest(),rel;return {'path':rel,'bytes':len(data),'sha256':h}
with concurrent.futures.ThreadPoolExecutor(8) as pool:rows=list(pool.map(get,files))
(doc/'publication.json').write_text(json.dumps({'source':'ca94d4e5','published':'a81bf031cd119016138371561fd1918a4014617b','pagesRun':40886281763,'url':base,'scope':'Gallery images/html and compiled game JS/CSS/fonts plus entry pages; static asset folders exercised by browser separately.','files':len(rows),'bytes':sum(x['bytes'] for x in rows),'hashMatches':True,'assets':rows},indent=2)+'\n');print('Verified',len(rows),'published files')
