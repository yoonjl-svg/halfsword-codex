"""Compare review media, compiled entry/PWA/JS, fonts and new thumbnail with Pages."""
from pathlib import Path
import concurrent.futures, hashlib, json, sys, urllib.request

root=Path(sys.argv[1]); base=sys.argv[2].rstrip('/')+'/'; revision=sys.argv[3]
files=list(root.glob('*.webp'))+list(root.glob('*.jpg'))+[root/'index.html']
files+=[root/'play'/n for n in ['index.html','sw.js','manifest.webmanifest']]
files+=list((root/'play/assets').glob('*.js'))
files+=[root/'play/fonts'/n for n in ['Pretendard-Regular.subset.woff2','Pretendard-SemiBold.subset.woff2','Pretendard-Bold.subset.woff2']]
files+=[root/'play/ui/weapons/pappenheimer.webp']
def check(path):
    rel=path.relative_to(root).as_posix(); local=path.read_bytes()
    req=urllib.request.Request(base+rel+'?revision='+revision,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=40) as response: remote=response.read()
    digest=hashlib.sha256(local).hexdigest()
    assert hashlib.sha256(remote).hexdigest()==digest,rel
    return {'path':rel,'bytes':len(local),'sha256':digest}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: rows=list(pool.map(check,files))
result={'base':base,'revision':revision,'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'allMatch':True,'entries':rows}
Path(__file__).with_name('remote-files.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k!='entries'}))
