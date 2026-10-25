"""Compare every packaged review/game asset with the deployed HTTP response."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib,json,sys,time
from urllib.request import urlopen
from urllib.parse import quote

root=Path(sys.argv[1])
base='https://yoonjl-svg.github.io/halfsword-codex/encounters/chixiao-20261025/'
revision=sys.argv[2]
files=sorted(p for p in root.rglob('*') if p.is_file())
def check(p):
    rel=p.relative_to(root).as_posix(); expected=p.read_bytes()
    for attempt in range(3):
        try:
            with urlopen(base+quote(rel)+'?v='+revision,timeout=35) as response: actual=response.read()
            if actual != expected: raise ValueError('HTTP bytes differ: '+rel)
            return {'path':rel,'bytes':len(actual),'sha256':hashlib.sha256(actual).hexdigest()}
        except Exception:
            if attempt==2: raise
            time.sleep(1)
with ThreadPoolExecutor(max_workers=8) as pool: rows=list(pool.map(check,files))
result={'url':base,'revision':revision,'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'allMatch':True,'entries':rows}
Path(__file__).with_name('remote-files.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='entries'}))
