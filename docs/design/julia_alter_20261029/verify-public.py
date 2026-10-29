from pathlib import Path
import concurrent.futures,hashlib,json,urllib.request
root=Path(__file__).resolve().parents[3];doc=Path(__file__).resolve().parent;pub=root/'public/encounters/julia-alter-20261029';base='https://yoonjl-svg.github.io/halfsword-codex/encounters/julia-alter-20261029/'
files=[p for p in pub.iterdir() if p.is_file()]+list((pub/'game/assets').rglob('*'))+[pub/'game/index.html',pub/'game/test.html']
files=[p for p in files if p.is_file()]
def get(p):
 rel=p.relative_to(pub).as_posix();data=urllib.request.urlopen(base+rel+'?verify=ddcfdb7c',timeout=45).read();h=hashlib.sha256(data).hexdigest();assert h==hashlib.sha256(p.read_bytes()).hexdigest(),rel;return {'path':rel,'bytes':len(data),'sha256':h}
with concurrent.futures.ThreadPoolExecutor(8) as pool:rows=list(pool.map(get,files))
(doc/'publication.json').write_text(json.dumps({'source':'40bb8097','published':'ddcfdb7cb074fdc42cd33354b9cf6baada217495','pagesRun':40890810312,'url':base,'scope':'Gallery images/html and compiled game JS/CSS/fonts plus entry pages; static asset folders exercised by browser separately.','files':len(rows),'bytes':sum(x['bytes'] for x in rows),'hashMatches':True,'assets':rows},indent=2)+'\n');print('Verified',len(rows),'published files')
