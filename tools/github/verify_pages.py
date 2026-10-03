#!/usr/bin/env python3
"""Compare delivered Pages bytes with the frozen production build, with TLS enabled."""
import argparse
import concurrent.futures
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import Request, urlopen


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--base', default='https://yoonjl-svg.github.io/halfsword-codex/')
    args = parser.parse_args()
    base = args.base.rstrip('/') + '/'
    target = urlsplit(base)
    if target.scheme != 'https' or target.netloc != 'yoonjl-svg.github.io' or target.path != '/halfsword-codex/':
        parser.error('Use the independent repository Pages URL')
    build = args.build.resolve()
    if args.out.exists():
        parser.error('Use a fresh receipt path')
    files = [build / name for name in ['index.html', 'feature-lab.html', 'development-plan.html', 'sounds.html']]
    files += sorted(p for p in (build / 'assets').rglob('*') if p.is_file())
    if not files or any(not p.is_file() for p in files):
        parser.error('Required production files are missing')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')

    def check(path):
        name = path.relative_to(build).as_posix()
        expected = path.read_bytes()
        url = urljoin(base, quote(name)) + '?delivery=' + stamp
        row = {'path': name, 'url': url, 'expectedBytes': len(expected), 'expectedSHA256': digest(expected), 'pass': False}
        try:
            request = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'halfsword-codex-delivery-verification'})
            with urlopen(request, timeout=45) as response:
                actual = response.read()
                row.update(status=response.status, finalURL=response.url, bytes=len(actual), sha256=digest(actual))
            row['pass'] = row['status'] == 200 and actual == expected
        except Exception as error:
            row['error'] = str(error)
        return row

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(check, files))
    receipt = {'base': base, 'createdUTC': stamp, 'build': str(build), 'tlsVerification': True,
               'pass': all(row['pass'] for row in rows), 'files': rows,
               'scope': 'Exact public HTML and all production assets; mobile execution is verified separately.'}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'pass': receipt['pass'], 'files': len(rows), 'failed': [row['path'] for row in rows if not row['pass']], 'out': str(args.out)}))
    return 0 if receipt['pass'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
