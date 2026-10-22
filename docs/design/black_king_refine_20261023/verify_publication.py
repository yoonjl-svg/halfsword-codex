"""Run after the specified Pages workflow succeeds; verify actual remote bytes."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib, json, subprocess, urllib.request

root=Path('/workspace/halfsword-weapons-preview/public/encounters/black-king-20261023')
out=Path(__file__).resolve().parent/'publication.json'
url='https://yoonjl-svg.github.io/halfsword-codex/encounters/black-king-20261023/'
commit='e53582f2d651cf3ebf10c122720500e6b69f4483'; run=39812813729
state=json.loads(subprocess.check_output(['gh','run','view',str(run),'--repo','yoonjl-svg/halfsword-codex','--json','status,conclusion,headSha'],text=True))
assert state['status']=='completed' and state['conclusion']=='success' and state['headSha']==commit,state

def verify(path):
    relative=path.relative_to(root).as_posix(); expected=path.read_bytes()
    request=urllib.request.Request(url+relative+'?review='+commit[:8],headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=45) as response: actual=response.read()
    assert actual==expected,relative
    return {'path':relative,'sha256':hashlib.sha256(actual).hexdigest(),'bytes':len(actual)}

with ThreadPoolExecutor(max_workers=12) as pool:
    files=list(pool.map(verify,sorted(p for p in root.rglob('*') if p.is_file())))
receipt={'status':'deployed_and_remote_bytes_verified','verified_at':datetime.now(timezone.utc).isoformat(),'source':'87d510baa36a3b4d9f53f9c2091a1f885b0cd36d','publication_commit':commit,'pages_run':run,'pages_conclusion':'success','url':url,'file_count':len(files),'total_bytes':sum(p['bytes'] for p in files),'files':files}
out.write_text(json.dumps(receipt,indent=2)+'\n')
print({k:v for k,v in receipt.items() if k!='files'})
