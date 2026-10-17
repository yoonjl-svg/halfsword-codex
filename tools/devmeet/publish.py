#!/usr/bin/env python3
"""개발자 회의록 발행 (Stillness → 샛별 수신기 규격). 디렉터가 23:22 KST 트리거에서 부른다.

사용: python3 tools/devmeet/publish.py YYYY-MM-DD [--no-push]
전제: 디렉터가 미리 써 둔 것 — docs/devmeet/YYYY-MM-DD.md (첫 줄 '# 개발자 회의록 YYYY-MM-DD (Stillness)' — 10/16 까지는 옛 한글 이름 · 사장님 10/17 '우리 게임 이름은 이제 Stillness'), docs/devmeet/ledger.md 갱신,
      (선택) docs/devmeet/notes/YYYY-MM-DD-uhwa.md 남김말.
하는 일: ① 작성 노트 docs/dev_exchange/notes/YYYY-MM-DD.md 를 일지와 같은 바이트로 만들어 먼저 커밋 (= manifest 의 source_sha)
         ② docs/devmeet/YYYY-MM-DD.json manifest(샛별 PROTOCOL.md v1: report_id, window, technical_base 14bcf1f, source_sha, notes_blob_sha,
            notes_sha256, markdown_sha256, previous_*) 를 쓰고 일지·대장·남김말과 함께 커밋 ③ dev 가지와 main 에 push (디렉터만 main 에 올린다).
규칙: 발행한 날짜 문서·manifest 는 고치지 않는다 (정정은 다음 날 일지에). 모델 이름을 적지 않는다.
"""
import hashlib, json, os, re, subprocess, sys
from datetime import date, datetime, timedelta, timezone

REPO = 'yoonjl-svg/halfsword'
BASE = '14bcf1fe6bd205c775db91aa4ca36b9841b6d2bd'
DEV = 'claude/first-game-development-2q36ha'
KST = timezone(timedelta(hours=9))


def sh(*a, check=True):
    return subprocess.run(a, check=check, capture_output=True, text=True).stdout.strip()


def main():
    if len(sys.argv) < 2 or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', sys.argv[1]):
        sys.exit('usage: publish.py YYYY-MM-DD [--no-push]')
    day = sys.argv[1]
    push = '--no-push' not in sys.argv
    root = sh('git', 'rev-parse', '--show-toplevel')
    os.chdir(root)
    md_path = f'docs/devmeet/{day}.md'
    json_path = f'docs/devmeet/{day}.json'
    note_path = f'docs/dev_exchange/notes/{day}.md'
    if not os.path.exists(md_path):
        sys.exit(f'missing {md_path}')
    md = open(md_path, 'rb').read()
    first = md.decode('utf-8-sig').lstrip().splitlines()[0]
    if not re.fullmatch(r'# [^\n]*' + re.escape(day) + r'[^\n]*', first):
        sys.exit(f'first line must be a dated H1, got: {first}')
    secs = re.findall(r'^## ([1-6])[.)]', md.decode('utf-8'), re.M)
    if secs != list('123456'):
        sys.exit(f'need exactly six H2 sections numbered 1..6, got {secs}')
    if os.path.exists(json_path):
        sys.exit(f'{json_path} already published — do not republish; put corrections in tomorrow\'s log')
    if sh('git', 'status', '--porcelain', '--', 'src', 'index.html'):
        sys.exit('src/index.html have uncommitted changes — publish from a clean code state')
    # ① authored note = same bytes as the log, committed first
    os.makedirs(os.path.dirname(note_path), exist_ok=True)
    open(note_path, 'wb').write(md)
    sh('git', 'add', note_path)
    sh('git', '-c', 'user.name=Claude', '-c', 'user.email=noreply@anthropic.com', 'commit', '-q', '-m',
       f'Devmeet: authored note {day} (source for the published report)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_014nJCzE4hyxiYc9innhSUng')
    source_sha = sh('git', 'rev-parse', 'HEAD')
    notes_blob = sh('git', 'rev-parse', f'HEAD:{note_path}')
    # ② manifest
    y = date.fromisoformat(day)
    prev_day = (y - timedelta(days=1)).isoformat()
    prev_json = f'docs/devmeet/{prev_day}.json'
    prev = json.load(open(prev_json)) if os.path.exists(prev_json) else None
    start = '2026-10-01T18:00:00+09:00' if day == '2026-10-01' else f'{prev_day}T23:30:00+09:00'
    now = datetime.now(KST).replace(microsecond=0)
    manifest = {
        'schema_version': 1,
        'status': 'published',
        'date': day,
        'report_id': f'{REPO}@{day}T23:30+09:00',
        'team': 'uhwa',
        'repo': REPO,
        'window': {'start_exclusive': start, 'end_inclusive': f'{day}T23:30:00+09:00'},
        'technical_base': BASE,
        'source_sha': source_sha,
        'source_observed_head': source_sha,
        'source_observed_at': now.isoformat(),
        'selection_basis': 'director session publishes from the dev branch head at 23:22-23:30 KST; the same commit is pushed to main',
        'authored_decision_record': 'present',
        'notes_path': note_path,
        'notes_blob_sha': notes_blob,
        'notes_sha256': hashlib.sha256(md).hexdigest(),
        'markdown_sha256': hashlib.sha256(md).hexdigest(),
        'previous_report_id': prev['report_id'] if prev else None,
        'previous_source_sha': prev['source_sha'] if prev else None,
    }
    open(json_path, 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    sh('git', 'add', md_path, json_path, 'docs/devmeet/ledger.md', 'docs/devmeet/notes', 'docs/dev_exchange')
    sh('git', '-c', 'user.name=Claude', '-c', 'user.email=noreply@anthropic.com', 'commit', '-q', '-m',
       f'Devmeet: report {day} published (manifest, ledger, notes)\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_014nJCzE4hyxiYc9innhSUng')
    head = sh('git', 'rev-parse', 'HEAD')
    if push:
        subprocess.run(['git', 'push', '-q', '-u', 'origin', DEV], check=True)
        subprocess.run(['git', 'push', '-q', 'origin', f'{DEV}:main'], check=True)
    print(json.dumps({'day': day, 'source_sha': source_sha, 'published_sha': head, 'markdown_sha256': manifest['markdown_sha256'], 'pushed': push}, ensure_ascii=False))


if __name__ == '__main__':
    main()
