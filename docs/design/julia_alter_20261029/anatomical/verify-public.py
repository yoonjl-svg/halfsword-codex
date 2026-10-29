from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request
root=Path(__file__).resolve().parents[4];doc=Path(__file__).resolve().parent;pub=root/'public/encounters/julia-alter-20261029';base='https://yoonjl-svg.github.io/halfsword-codex/encounters/julia-alter-20261029/'
files=[p for p in pub.iterdir() if p.is_file()]+list((pub/'game/assets').rglob('*'))+[pub/'game/index.html',pub/'game/test.html']
files=[p for p in files if p.is_file()]
def get(p):
 rel=p.relative_to(pub).as_posix();data=urllib.request.urlopen(base+rel+'?verify=5ada7771',timeout=45).read();h=hashlib.sha256(data).hexdigest();assert h==hashlib.sha256(p.read_bytes()).hexdigest(),rel;return {'path':rel,'bytes':len(data),'sha256':h}
with concurrent.futures.ThreadPoolExecutor(8) as pool:rows=list(pool.map(get,files))
(doc/'publication.json').write_text(json.dumps({'source':'f51d7820162bd89ee8148e16ea4b3844a704d75d','published':'5ada777127a6d71a27f49ed45c610d564c8ff8b8','pagesRun':40917984662,'url':base,'scope':'Gallery images/html and compiled game JS/CSS/fonts plus entry pages; static asset folders exercised by browser separately.','files':len(rows),'bytes':sum(x['bytes'] for x in rows),'hashMatches':True,'assets':rows},indent=2)+'\n');print('Verified',len(rows),'published files')
