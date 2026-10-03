#!/usr/bin/env python3
"""Local, immutable daily exchange artifacts; remote reads use gh GET only."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import subprocess
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo
from urllib.parse import quote, urlsplit

MAX_JSON = 100_000
MAX_MD = 64_000


class APIError(RuntimeError):
    def __init__(self, status=None):
        self.status = status
        super().__init__('GitHub API read failed' + (f' (HTTP {status})' if status else ''))


class ExchangeWindowClosed(RuntimeError):
    def __init__(self, checked_at):
        self.checked_at = checked_at
        super().__init__('Peer contact deferred outside exchange window')


def check_exchange_window(cfg, clock):
    if clock.tzinfo is None:
        raise ValueError('Timestamp must include a timezone')
    local = clock.astimezone(ZoneInfo(cfg['timezone']))
    start = time.fromisoformat(cfg.get('exchange_window_start', '00:00'))
    end = time.fromisoformat(cfg.get('exchange_window_end', '00:20'))
    if not start <= local.time() < end:
        raise ExchangeWindowClosed(clock)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def iso(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timestamp must include a timezone')
    return parsed


def config(root):
    value = json.loads((Path(root) / 'docs/dev_exchange/config.json').read_text())
    for key in ('team', 'repo', 'report_ref', 'peer_repo', 'peer_ref', 'timezone',
                'operational_cutoff', 'technical_base', 'report_hour'):
        if not value.get(key):
            raise ValueError('Missing config field: ' + key)
    for key in ('repo', 'peer_repo'):
        if not re.fullmatch(r'[\w.-]+/[\w.-]+', value[key]):
            raise ValueError('Invalid repository name')
    for key in ('daily_path', 'peer_daily_path'):
        value.setdefault(key, 'docs/devmeet')
        path = value[key]
        if not isinstance(path, str) or not path.startswith('docs/') or '\\' in path or any(p in ('', '.', '..') for p in path.split('/')):
            raise ValueError('Unsafe public report path')
    value.setdefault('exchange_window_start', '00:00')
    value.setdefault('exchange_window_end', '00:20')
    if not time.fromisoformat(value['exchange_window_start']) < time.fromisoformat(value['exchange_window_end']):
        raise ValueError('Invalid exchange window')
    return value


def window(day, cfg):
    parsed = date.fromisoformat(day)
    if parsed.isoformat() != day:
        raise ValueError('Use YYYY-MM-DD')
    tz = ZoneInfo(cfg['timezone'])
    hour, minute = map(int, cfg['report_hour'].split(':'))
    end = datetime.combine(parsed, time(hour, minute), tz)
    first = iso(cfg['operational_cutoff'])
    if parsed < first.astimezone(tz).date():
        raise ValueError('Date precedes operational cutoff')
    start = first if parsed == first.astimezone(tz).date() else end - timedelta(days=1)
    if start >= end:
        raise ValueError('Empty reporting window')
    return start, end


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], stderr=subprocess.PIPE)


def api(endpoint, timeout=None):
    try:
        result = subprocess.run(['gh', 'api', '--method', 'GET', endpoint], capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise APIError() from None
    if result.returncode:
        match = re.search(rb'HTTP[ :]+(\d{3})', result.stderr)
        raise APIError(int(match[1]) if match else None)
    if len(result.stdout) > 2_000_000:
        raise APIError()
    try:
        return json.loads(result.stdout)
    except ValueError:
        raise APIError() from None


def write_once(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as out:
        out.write(data)


def serialized(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def validate(manifest, markdown, cfg_repo, day, report_id):
    if len(markdown) > MAX_MD:
        raise ValueError('Markdown exceeds size limit')
    if not isinstance(manifest, dict):
        raise ValueError('Manifest must be an object')
    if type(manifest.get('schema_version')) is not int or manifest['schema_version'] != 1:
        raise ValueError('Unsupported manifest schema')
    for key, expected in (('date', day), ('repo', cfg_repo), ('status', 'published'), ('report_id', report_id)):
        if manifest.get(key) != expected:
            raise ValueError('Manifest mismatch: ' + key)
    if manifest.get('markdown_sha256') != digest(markdown):
        raise ValueError('Markdown hash mismatch')
    if not re.fullmatch('[0-9a-f]{40}', str(manifest.get('source_sha', ''))):
        raise ValueError('Invalid source SHA')
    expected_end = iso(report_id.rsplit('@', 1)[1])
    win = manifest.get('window', {})
    if not isinstance(win, dict):
        raise ValueError('Invalid report window')
    if iso(win.get('end_inclusive', '')) != expected_end or iso(win.get('start_exclusive', '')) >= expected_end:
        raise ValueError('Invalid report window')
    authored = manifest.get('authored_decision_record')
    if authored == 'present':
        safe_notes_path(manifest.get('notes_path'))
        if not re.fullmatch('[0-9a-f]{40}', str(manifest.get('notes_blob_sha', ''))) or not re.fullmatch('[0-9a-f]{64}', str(manifest.get('notes_sha256', ''))):
            raise ValueError('Invalid authored-note hashes')
    elif authored != 'absent' or manifest.get('notes_blob_sha') is not None or manifest.get('notes_sha256') is not None:
        raise ValueError('Invalid authored-note state')


def safe_notes_path(value):
    if not isinstance(value, str) or '\\' in value or any(p in ('', '.', '..') for p in value.split('/')):
        raise ValueError('Unsafe notes path')
    if not value.startswith('docs/dev_exchange/notes/') or not value.endswith('.md') or PurePosixPath(value).is_absolute():
        raise ValueError('Unsafe notes path')
    return value


def rewrite_note_links(text, repo, sha, note_path):
    count = 0
    def replace(match):
        nonlocal count
        raw = match[2]
        target = raw.strip('<>')
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or target.startswith(('#', '/')):
            return match[0]
        normalized = posixpath.normpath(posixpath.join(posixpath.dirname(note_path), parsed.path)) if parsed.path else note_path
        if normalized == '..' or normalized.startswith('../'):
            raise ValueError('Note link escapes repository root')
        pinned = f'https://github.com/{repo}/blob/{sha}/' + quote(normalized, safe='/')
        if parsed.query: pinned += '?' + parsed.query
        if parsed.fragment: pinned += '#' + parsed.fragment
        count += 1
        return match[1] + ('<' + pinned + '>' if raw.startswith('<') else pinned)
    text = re.sub(r'(\]\()(<[^>]+>|[^\s)]+)', replace, text)
    text = re.sub(r'^(\s{0,3}\[[^\]]+\]:\s*)(<[^>]+>|[^\s]+)', replace, text, flags=re.M)
    return text, count


def report_id(repo, end):
    return repo + '@' + end.isoformat(timespec='minutes')


def note_sections(text):
    """Find top-level H2 headings outside Markdown fenced code blocks."""
    visible_offsets, offset, fence = set(), 0, None
    for line in text.splitlines(keepends=True):
        if fence:
            if re.fullmatch(r' {0,3}' + re.escape(fence[0]) + '{' + str(fence[1]) + r',}\s*', line):
                fence = None
        else:
            opening = re.match(r' {0,3}(`{3,}|~{3,})', line)
            if opening:
                fence = (opening[1][0], len(opening[1]))
            elif line.startswith('## ') and not line.startswith('## #'):
                visible_offsets.add(offset)
        offset += len(line)
    return [m for m in re.finditer(r'^## (?!#).+$', text, re.M) if m.start() in visible_offsets]


def prepare_note_sections(text, allow_trailing_appendices=False):
    """Keep six numbered sections; optionally demote historical trailing appendices.

    Old source commits remain immutable. Only heading depth changes in the
    rendered report, and the caller records each change separately from raw hashes.
    Current authored notes use strict validation before publication.
    """
    sections = note_sections(text)
    numbered = [re.match(r'^##\s+([1-6])[.)]', section[0]) for section in sections[:6]]
    valid = len(numbered) == 6 and all(numbered) and [n[1] for n in numbered] == list('123456')
    extra = sections[6:]
    if (not valid or (extra and not allow_trailing_appendices)
            or any(re.match(r'^##\s+\d+[.)]', section[0]) for section in extra)):
        raise ValueError('Authored note must contain exactly six H2 sections')
    changes = [{'line': text.count('\n', 0, section.start()) + 1,
                'from': section[0], 'to': '#' + section[0]} for section in extra]
    for section in reversed(extra):
        text = text[:section.start()] + '#' + text[section.start():]
    return text, changes


def validate_notes(root):
    """Validate actual authored files, not only synthetic unit-test fixtures."""
    directory = Path(root) / 'docs/dev_exchange/notes'
    paths = sorted(directory.glob('*.md'))
    if not paths:
        raise ValueError('No authored notes found')
    for path in paths:
        try:
            prepare_note_sections(path.read_text(encoding='utf-8'))
        except ValueError as error:
            raise ValueError(f'{path.name}: {error}') from error
    return {'status': 'notes_valid', 'count': len(paths), 'notes': [p.name for p in paths]}


def published_pair(directory, day, repo, rid):
    md, js = directory / (day + '.md'), directory / (day + '.json')
    if not md.exists() and not js.exists():
        return None
    if not md.exists() or not js.exists():
        raise ValueError('Incomplete immutable report pair')
    if js.stat().st_size > MAX_JSON or md.stat().st_size > MAX_MD:
        raise ValueError('Existing report exceeds size limit')
    value = json.loads(js.read_bytes())
    validate(value, md.read_bytes(), repo, day, rid)
    return value


def deploy_read(cfg, end, gh):
    try:
        response = gh(f"repos/{cfg['repo']}/actions/workflows/deploy.yml/runs?status=success&per_page=100")
        runs = [r for r in response.get('workflow_runs', [])
                if r.get('conclusion') == 'success' and r.get('updated_at')
                and iso(r['updated_at']) <= end]
        selected = max(runs, key=lambda r: iso(r['updated_at'])) if runs else None
        return {'status': 'observed_success' if selected else 'none_in_bounded_query',
                'query_limit': 100, 'run_url': selected.get('html_url') if selected else None,
                'head_sha': selected.get('head_sha') if selected else None,
                'observed_updated_at': selected.get('updated_at') if selected else None,
                'cutoff_time_basis': 'run updated_at; conservative completion proxy',
                'currently_live_verified': False}
    except Exception as error:
        return {'status': 'unknown', 'error_type': type(error).__name__,
                'query_limit': 100, 'currently_live_verified': False}


def publish_ledger(root, output, cfg, source_sha, day):
    directory = Path(output) / cfg['daily_path']
    # A backfill may create a new immutable report, but must not rewind the
    # shared ledger belonging to a later published reporting day.
    if directory.exists():
        for path in directory.glob('????-??-??.json'):
            later_day = path.stem
            if later_day <= day:
                continue
            _, later_end = window(later_day, cfg)
            if published_pair(directory, later_day, cfg['repo'], report_id(cfg['repo'], later_end)):
                return 'preserved_newer_report'
    source_path = 'docs/dev_exchange/ledger.md'
    try:
        raw = git(root, 'show', source_sha + ':' + source_path)
    except subprocess.CalledProcessError:
        return 'absent'
    if len(raw) > MAX_MD:
        raise ValueError('Ledger exceeds size limit')
    text, _ = rewrite_note_links(raw.decode('utf-8'), cfg['repo'], source_sha, source_path)
    target = Path(output) / cfg['daily_path'] / 'ledger.md'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')
    return 'updated'


def publish(day, root, output, now=None, gh=api):
    if Path(root).resolve() == Path(output).resolve() or Path(root).resolve() in Path(output).resolve().parents:
        raise ValueError('Output must be outside the read-only source checkout')
    cfg = config(root)
    start, end = window(day, cfg)
    observed_at = iso(now) if isinstance(now, str) else now or datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        raise ValueError('Timestamp must include a timezone')
    if observed_at < end:
        raise ValueError('Refusing publication before reporting cutoff')
    directory = Path(output) / cfg['daily_path']
    rid = report_id(cfg['repo'], end)
    existing = published_pair(directory, day, cfg['repo'], rid)
    if existing:
        return {'status': 'unchanged', 'report_id': rid, 'ledger_status': 'unchanged'}
    head = git(root, 'rev-parse', 'HEAD').decode().strip()
    chain = git(root, 'rev-list', '--first-parent', '--before=' + str(int(end.timestamp()) + 1), head).decode().splitlines()
    selected = None
    for sha in chain:
        stamp = iso(git(root, 'show', '-s', '--format=%cI', sha).decode().strip())
        if stamp <= end:
            selected, selected_at = sha, stamp
            break
    if selected is None:
        raise ValueError('No first-parent commit before cutoff')
    commits = []
    history = git(root, 'log', '--since-as-filter=' + start.isoformat(),
                  '--format=%H%x09%cI%x09%s', selected).decode().splitlines()
    for line in history:
        sha, timestamp, subject = line.split('\t', 2)
        if not start < iso(timestamp) <= end:
            continue
        paths = git(root, 'show', '-m', '--first-parent', '--format=', '--name-only', sha).decode().splitlines()
        if paths and all(p.startswith(('docs/dev_exchange/', cfg['daily_path'] + '/', 'tools/dev_exchange/', '.codex-transfer/'))
                         or p == '.codex-transfer'
                         or p == '.github/workflows/dev-exchange.yml' for p in paths):
            continue
        if subject in ('Prepare verified source transfer', 'Import verified Codex source'):
            continue
        commits.append({'sha': sha, 'committed_at': timestamp, 'subject': subject,
                        'paths': paths[:15], 'path_count': len(paths)})
    note_path = f'docs/dev_exchange/notes/{day}.md'
    try:
        note = git(root, 'show', selected + ':' + note_path)
        note_blob = git(root, 'rev-parse', selected + ':' + note_path).decode().strip()
    except subprocess.CalledProcessError:
        note, note_blob = None, None
    previous_day = (date.fromisoformat(day) - timedelta(days=1)).isoformat()
    previous_end = end - timedelta(days=1)
    previous = None
    if date.fromisoformat(previous_day) >= iso(cfg['operational_cutoff']).astimezone(ZoneInfo(cfg['timezone'])).date():
        previous = published_pair(directory, previous_day, cfg['repo'], report_id(cfg['repo'], previous_end))
    manifest = {'schema_version': 1, 'status': 'published', 'date': day, 'report_id': rid,
                'team': cfg['team'], 'repo': cfg['repo'], 'window': {'start_exclusive': start.isoformat(), 'end_inclusive': end.isoformat()},
                'technical_base': cfg['technical_base'], 'source_observed_head': head,
                'source_observed_at': observed_at.isoformat(), 'source_sha': selected,
                'source_committed_at': selected_at.isoformat(), 'selection_basis': 'first-parent committer time; not historical remote state',
                'notes_path': note_path, 'notes_blob_sha': note_blob, 'notes_sha256': digest(note) if note is not None else None,
                'authored_decision_record': 'present' if note is not None else 'absent',
                'commit_count': len(commits), 'commits': commits[:50],
                'previous_report_id': previous.get('report_id') if previous else None,
                'previous_source_sha': previous.get('source_sha') if previous else None,
                'deployment': deploy_read(cfg, end, gh),
                'workflow_run_url': f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}" if os.environ.get('GITHUB_REPOSITORY') and os.environ.get('GITHUB_RUN_ID') else None}
    lines = [f'# {day} 개발 교환 보고', '', f'- 보고 ID: {rid}', f'- 창: ({start.isoformat()}, {end.isoformat()}]',
             f'- 관찰 HEAD: {head} / 관찰 시각: {observed_at.isoformat()}', f'- 선택 소스: {selected} ({selected_at.isoformat()})',
             '- 선택은 커밋 시각 기준이며 당시 원격 상태를 증명하지 않습니다.',
             '- 배포 기록은 제한된 API 관찰이며 현재 서비스 중임을 증명하지 않습니다.', '']
    normalized_note, heading_changes = prepare_note_sections(
        note.decode('utf-8') if note is not None else missing_note_sections(),
        allow_trailing_appendices=True)
    rendered_note, rewritten = rewrite_note_links(normalized_note, cfg['repo'], selected, note_path) if note is not None else (normalized_note, 0)
    manifest['notes_heading_normalization'] = {'policy': 'trailing-unnumbered-h2-to-h3-v1', 'count': len(heading_changes), 'trailing_appendices_demoted': heading_changes, 'raw_notes_hash_preserved': True}
    manifest['notes_link_rewrite'] = {'basis': 'source-note-relative paths pinned to source_sha', 'count': rewritten, 'raw_notes_hash_preserved': True}
    automatic = ['', f'### 자동 소스 변경 ({len(commits)}건; 최대 50건 표시)', '']
    for commit in commits[:50]:
        automatic += [f"- {commit['sha'][:12]} {commit['subject']} ({commit['committed_at']})",
                  '  경로: ' + ', '.join(commit['paths']) + (f" 외 {commit['path_count'] - 15}개" if commit['path_count'] > 15 else '')]
    sections = note_sections(rendered_note)
    numbers = [re.match(r'^##\s+([1-6])[.)]', s[0]) for s in sections]
    if len(sections) != 6 or any(n is None for n in numbers) or [n[1] for n in numbers] != list('123456'):
        raise ValueError('Authored note must contain exactly six H2 sections')
    insert = sections[2].start()
    rendered_note = rendered_note[:insert] + '\n'.join(automatic) + '\n\n' + rendered_note[insert:]
    lines.append(rendered_note)
    markdown = ('\n'.join(lines) + '\n').encode()
    if len(markdown) > MAX_MD:
        raise ValueError('Generated markdown exceeds size limit')
    manifest['markdown_sha256'] = digest(markdown)
    raw = serialized(manifest)
    if len(raw) > MAX_JSON:
        raise ValueError('Generated manifest exceeds size limit')
    write_once(directory / (day + '.md'), markdown)
    write_once(directory / (day + '.json'), raw)
    publish_ledger(root, output, cfg, selected, day)
    return manifest


def missing_note_sections():
    titles = ('1. 사장님 결정', '2. 시도와 결과', '3. 실패에서 배운 것', '4. 열린 질문·상대에게 묻는 것', '5. 상대 일지 검토', '6. 다음 24시간 계획')
    return '\n\n'.join('## ' + title + '\n\n작성된 결정 기록 없음. 이는 개발 활동이 없었다는 뜻이 아닙니다.' for title in titles)


def content(gh, repo, path, sha, limit):
    response = gh(f'repos/{repo}/contents/{path}?ref={sha}')
    if response.get('encoding') != 'base64' or response.get('size', limit + 1) > limit:
        raise ValueError('Unsupported or oversized peer content')
    data = base64.b64decode(response['content'].replace('\n', ''), validate=True)
    if len(data) > limit:
        raise ValueError('Peer content exceeds size limit')
    return data


def receive(day, root, output, gh=api, now=None):
    if Path(root).resolve() == Path(output).resolve() or Path(root).resolve() in Path(output).resolve().parents:
        raise ValueError('Output must be outside the read-only source checkout')
    cfg = config(root)
    _, end = window(day, cfg)
    def read_clock():
        value = now() if callable(now) else now if now is not None else datetime.now(timezone.utc)
        return iso(value) if isinstance(value, str) else value
    clock = read_clock()
    directory = Path(output) / 'docs/dev_exchange/inbox' / day
    receipt = {'date': day, 'peer_repo': cfg['peer_repo'], 'peer_ref': cfg['peer_ref'],
               'received_at': clock.isoformat(), 'status': 'peer_invalid',
               'semantic_review_performed': False, 'review_status': 'review_pending'}
    phase = 'report'
    created_snapshots = []
    def save_snapshot(path, data, rollback=True):
        check_exchange_window(cfg, read_clock())
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as out:
            if rollback:
                created_snapshots.append(path)
            out.write(data)
    raw_gh = gh
    def guarded_gh(endpoint):
        before = read_clock()
        check_exchange_window(cfg, before)
        local = before.astimezone(ZoneInfo(cfg['timezone']))
        deadline = datetime.combine(local.date(), time.fromisoformat(cfg['exchange_window_end']), local.tzinfo)
        remaining = (deadline - local).total_seconds()
        try:
            response = raw_gh(endpoint, timeout=remaining) if raw_gh is api else raw_gh(endpoint)
        except Exception:
            # A request that timed out at the boundary is a deferred contact,
            # even when its underlying failure would otherwise be APIError.
            check_exchange_window(cfg, read_clock())
            raise
        check_exchange_window(cfg, read_clock())
        return response
    gh = guarded_gh
    try:
        check_exchange_window(cfg, clock)
        if clock < end + timedelta(minutes=30):
            raise ValueError('Refusing receipt before reporting cutoff plus 30 minutes')
        existing_md, existing_json = directory / 'peer.md', directory / 'peer.json'
        if existing_md.exists() or existing_json.exists():
            if not existing_md.exists() or not existing_json.exists() or existing_md.stat().st_size > MAX_MD or existing_json.stat().st_size > MAX_JSON:
                raise ValueError('Invalid existing peer snapshot')
            previous = json.loads(existing_json.read_bytes())
            validate(previous, existing_md.read_bytes(), cfg['peer_repo'], day, report_id(cfg['peer_repo'], end))
            return {'status': 'already_received', 'date': day, 'report_id': previous['report_id'],
                    'semantic_review_performed': False, 'review_status': 'unchanged'}
        reference = gh(f"repos/{cfg['peer_repo']}/git/ref/heads/{cfg['peer_ref']}")
        sha = reference['object']['sha']
        if not re.fullmatch('[0-9a-f]{40}', sha):
            raise ValueError('Invalid peer branch SHA')
        receipt['peer_branch_sha'] = sha
        stem = cfg['peer_daily_path'] + '/' + day
        legacy = False
        try:
            raw = content(gh, cfg['peer_repo'], stem + '.json', sha, MAX_JSON)
        except APIError as error:
            if error.status != 404:
                raise
            legacy = True
        markdown = content(gh, cfg['peer_repo'], stem + '.md', sha, MAX_MD)
        if legacy:
            text = markdown.decode('utf-8-sig')
            first_line = text.lstrip().splitlines()[0] if text.strip() else ''
            if not re.fullmatch(r'# [^\n]*' + re.escape(day) + r'[^\n]*', first_line):
                raise ValueError('Plain peer document lacks dated header')
            check_exchange_window(cfg, read_clock())
            target = directory / 'peer-unverified.md'
            if target.exists() and target.read_bytes() != markdown:
                stamp = clock.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
                target = directory / ('peer-unverified-' + stamp + '-' + digest(markdown)[:12] + '.md')
            if not target.exists():
                save_snapshot(target, markdown, rollback=False)
            elif target.read_bytes() != markdown:
                raise ValueError('Existing legacy snapshot differs')
            receipt.update(status='document_received_unverified', markdown_sha256=digest(markdown),
                           source_provenance_unverified=True, provenance_status='unverified',
                           snapshot_path=target.name)
            review = directory / 'review.md'
            if not review.exists():
                save_snapshot(review, b'# Peer document review\n\nreview_pending\nsemantic_review_performed=false\nsource_provenance_unverified=true\n', rollback=False)
            return append_receipt(directory, clock, receipt)
        value = json.loads(raw)
        validate(value, markdown, cfg['peer_repo'], day, report_id(cfg['peer_repo'], end))
        phase = 'provenance'
        source = gh(f"repos/{cfg['peer_repo']}/commits/{value['source_sha']}")
        if source.get('sha') != value['source_sha']:
            raise ValueError('Peer source commit SHA mismatch')
        if value['authored_decision_record'] == 'present':
            path = safe_notes_path(value['notes_path'])
            note_response = gh(f"repos/{cfg['peer_repo']}/contents/{quote(path, safe='/')}?ref={value['source_sha']}")
            if note_response.get('encoding') != 'base64' or note_response.get('size', MAX_MD + 1) > MAX_MD:
                raise ValueError('Invalid peer source note')
            note = base64.b64decode(note_response['content'].replace('\n', ''), validate=True)
            blob_sha = hashlib.sha1(b'blob ' + str(len(note)).encode() + b'\0' + note).hexdigest()
            if len(note) > MAX_MD or note_response.get('sha') != value['notes_blob_sha'] or blob_sha != value['notes_blob_sha'] or digest(note) != value['notes_sha256']:
                raise ValueError('Peer source note hash mismatch')
        receipt['provenance_status'] = 'source_commit_and_notes_verified' if value['authored_decision_record'] == 'present' else 'source_commit_verified_no_authored_notes'
        phase = 'snapshot'
        check_exchange_window(cfg, read_clock())
        # An existing snapshot cannot silently become a different report.
        for name, data in (('peer.json', raw), ('peer.md', markdown)):
            path = directory / name
            if path.exists() and path.read_bytes() != data:
                raise ValueError('Existing peer snapshot differs')
        for name, data in (('peer.json', raw), ('peer.md', markdown)):
            if not (directory / name).exists():
                save_snapshot(directory / name, data)
        review = directory / 'review.md'
        if not review.exists():
            save_snapshot(review, b'# Peer report review\n\nreview_pending\nsemantic_review_performed=false\n')
        receipt.update(status='peer_received', report_id=value['report_id'], markdown_sha256=digest(markdown),
                       manifest_sha256=digest(raw), notes_blob_sha=value.get('notes_blob_sha'), notes_sha256=value.get('notes_sha256'))
        receipt.update(source_sha=value['source_sha'], previous_report_id=value.get('previous_report_id'),
                       previous_source_sha=value.get('previous_source_sha'),
                       workflow_run_url=f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}" if os.environ.get('GITHUB_REPOSITORY') and os.environ.get('GITHUB_RUN_ID') else None)
    except Exception as error:
        # Only files exclusively created for this strict receipt are removed;
        # prior verified/review/legacy artifacts and attempt receipts survive.
        for path in reversed(created_snapshots):
            path.unlink(missing_ok=True)
        if isinstance(error, ExchangeWindowClosed):
            receipt['status'] = 'deferred_outside_exchange_window'
            receipt['deferred_at'] = error.checked_at.isoformat()
            receipt['exchange_window'] = {'timezone': cfg['timezone'], 'start_inclusive': cfg['exchange_window_start'], 'end_exclusive': cfg['exchange_window_end']}
        elif phase == 'provenance':
            receipt['status'] = 'provenance_unverified'
        elif isinstance(error, APIError):
            receipt['status'] = 'peer_missing' if error.status == 404 else 'api_error'
        elif isinstance(error, RuntimeError):
            receipt['status'] = 'api_error'
        receipt['error_type'] = type(error).__name__
        receipt['error'] = str(error)[:300] if isinstance(error, (ValueError, APIError, ExchangeWindowClosed)) else 'Peer read or verification failed'
    return append_receipt(directory, clock, receipt)


def append_receipt(directory, clock, receipt):
    # Every fresh attempt has its own receipt, including missing/API failures.
    stamp = clock.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    path = directory / (stamp + '.json')
    suffix = 0
    while path.exists():
        suffix += 1
        path = directory / (stamp + f'-{suffix}.json')
    write_once(path, serialized(receipt))
    return receipt


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    check = sub.add_parser('validate-notes')
    check.add_argument('--repo-root', required=True)
    for command in ('publish', 'receive'):
        p = sub.add_parser(command)
        p.add_argument('--date', required=True)
        p.add_argument('--repo-root', required=True)
        p.add_argument('--output-root', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'validate-notes':
            print(json.dumps(validate_notes(args.repo_root), ensure_ascii=False))
            return 0
        result = globals()[args.command](args.date, args.repo_root, args.output_root)
        print(json.dumps(result, ensure_ascii=False))
        return 0 if args.command == 'publish' or result['status'] in ('peer_received', 'already_received', 'document_received_unverified') else 1
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    raise SystemExit(main())
