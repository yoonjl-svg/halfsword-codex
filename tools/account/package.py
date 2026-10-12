"""Build a reproducible, source-only handoff. No auth sessions or build caches."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[2]
files = {}
for folder in ['src/account', 'integrations/stillness-account/backend', 'tools/account']:
    for p in sorted((root / folder).rglob('*')):
        if p.is_file() and '__pycache__' not in p.parts:
            name = p.relative_to(root).as_posix().replace('integrations/stillness-account/', '')
            files[name] = p.read_bytes()
for name, src in [('README.md', 'integrations/stillness-account/README.md'),
                  ('game-adapter.patch', 'integrations/stillness-account/game-adapter.patch'),
                  ('public/account.html', 'public/account.html'),
                  ('public/growth.html', 'public/growth.html'),
                  ('public/growth-setup.html', 'public/growth-setup.html'),
                  ('public/account-growth-setup.sql', 'public/account-growth-setup.sql')]:
    files[name] = (root / src).read_bytes()
# A fork must deliberately choose its own project/app namespace. The public key
# is not secret, but shipping our active configuration can mix another app's data.
files['src/account/config.js'] = b"// Set your own public project URL, publishable key and unique appId.\nexport default Object.freeze({ appId: 'halfsword-codex', url: '', publishableKey: '' });\n"
manifest = {'format': 1, 'files': [{'path': n, 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()} for n, b in sorted(files.items())]}
files['MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
p = root / 'public/stillness-account.zip'
with zipfile.ZipFile(p, 'w', zipfile.ZIP_DEFLATED) as z:
    for n, b in sorted(files.items()):
        info = zipfile.ZipInfo(n, date_time=(2026, 10, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, b)
with zipfile.ZipFile(p) as z:
    for item in manifest['files']:
        data = z.read(item['path'])
        assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256']
hash_value = hashlib.sha256(p.read_bytes()).hexdigest()
Path(str(p) + '.sha256').write_text(f'{hash_value}  stillness-account.zip\n')
print(json.dumps({'files': len(files), 'bytes': p.stat().st_size, 'sha256': hash_value}))
