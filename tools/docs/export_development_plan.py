#!/usr/bin/env python3
"""Export the approved public ACTIVE_PLAN; standard library, no private inputs.

python3 tools/docs/export_development_plan.py
Pass --generated-date YYYY-MM-DD for reproducible date metadata.
Regenerate after editing ACTIVE_PLAN and before the ordinary Vite build.
"""
import argparse
from datetime import date, datetime
from zoneinfo import ZoneInfo
import hashlib
import html
from pathlib import Path
import re
from urllib.parse import quote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/codex_team/ACTIVE_PLAN.md'
TARGET = ROOT / 'public/development-plan.html'
GITHUB = 'https://github.com/yoonjl-svg/halfsword-codex/blob/main/'


def link_target(target):
    if target.startswith('#'):
        return target
    parts = urlsplit(target)
    if parts.scheme:
        return target if parts.scheme in ('http', 'https') else '#'
    resolved = (SOURCE.parent / target).resolve()
    try:
        relative = resolved.relative_to(ROOT).as_posix()
    except ValueError:
        return '#'
    return GITHUB + quote(relative, safe='/#')


def inline(text):
    # Preserve generated tags while escaping the source's literal HTML.
    tokens = []
    def keep(value):
        tokens.append(value)
        return '\x00' + str(len(tokens) - 1) + '\x00'
    text = re.sub(r'`([^`]+)`', lambda m: keep('<code>' + html.escape(m[1]) + '</code>'), text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', lambda m: keep(
        '<a href="' + html.escape(link_target(m[2]), quote=True) + '">' + html.escape(m[1]) + '</a>'), text)
    text = html.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\x00(\d+)\x00', lambda m: tokens[int(m[1])], text)
    return text


def render_markdown(source):
    lines = source.splitlines()
    result, sections = [], []
    i = 0
    heading_count = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            content = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                content.append(lines[i]); i += 1
            result.append('<pre><code>' + html.escape('\n'.join(content)) + '</code></pre>')
            i += 1
            continue
        heading = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading:
            level, title = len(heading[1]), heading[2]
            heading_count += 1
            anchor = 'section-' + str(heading_count)
            if level == 2:
                sections.append((anchor, title))
            result.append(f'<h{level} id="{anchor}">{inline(title)}</h{level}>')
            i += 1
            continue
        if line.startswith('|') and i + 1 < len(lines) and re.fullmatch(r'[| :\-]+', lines[i + 1]):
            headers = [v.strip() for v in line.strip('|').split('|')]
            body = []
            i += 2
            while i < len(lines) and lines[i].startswith('|'):
                cells = [v.strip() for v in lines[i].strip('|').split('|')]
                if len(cells) != len(headers):
                    raise ValueError('Unsupported table cell count: ' + lines[i])
                body.append('<tr role="row">' + ''.join(
                    '<td role="cell" data-label="' + html.escape(headers[n], quote=True) + '">' + inline(cell) + '</td>'
                    for n, cell in enumerate(cells)) + '</tr>')
                i += 1
            result.append('<table role="table"><thead><tr role="row">' + ''.join(
                '<th scope="col" role="columnheader">' + inline(h) + '</th>' for h in headers)
                + '</tr></thead><tbody>' + ''.join(body) + '</tbody></table>')
            continue
        listing = re.match(r'^(-|\d+\.)\s+(.+)$', line)
        if listing:
            ordered = listing[1] != '-'
            tag = 'ol' if ordered else 'ul'
            items = []
            while i < len(lines):
                item = re.match(r'^(-|\d+\.)\s+(.+)$', lines[i])
                if not item or (item[1] != '-') != ordered:
                    break
                paragraph = [item[2]]
                i += 1
                while i < len(lines) and lines[i].startswith(' '):
                    paragraph.append(lines[i].strip()); i += 1
                items.append('<li>' + inline(' '.join(paragraph)) + '</li>')
            result.append(f'<{tag}>' + ''.join(items) + f'</{tag}>')
            continue
        paragraph = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#|\||```|- |\d+\. )', lines[i]):
            paragraph.append(lines[i].strip()); i += 1
        result.append('<p>' + inline(' '.join(paragraph)) + '</p>')
    return '\n'.join(result), sections


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--generated-date', default=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat())
    parser.add_argument('--publication-status', choices=['local', 'verified'], default='local',
                        help='Use verified only after the public delivery was actually checked.')
    args = parser.parse_args()
    date.fromisoformat(args.generated_date)
    source = SOURCE.read_text(encoding='utf-8')
    digest = hashlib.sha256(source.encode()).hexdigest()
    content, sections = render_markdown(source)
    navigation = ''.join('<a href="#' + anchor + '">' + html.escape(title) + '</a>' for anchor, title in sections)
    status = '실행 계획 생성본 · 전달 상태는 기록 참조' if args.publication_status == 'local' else '공개 전달 확인 완료'
    document = '''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>개발 실행 계획 · Half Sword</title>
<link rel="icon" href="data:,">
<meta name="description" content="작은 플레이 결과물 중심의 24시간 작업표, 실험 기록과 다음 개발 과제를 휴대폰에서 읽는 페이지.">
<style>
:root{color-scheme:dark;--bg:#121517;--panel:#1d2226;--text:#ecedef;--muted:#bfc7cd;--link:#f2c77a;--border:#41494f}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.7 system-ui,-apple-system,sans-serif;overflow-wrap:anywhere}
main,header,footer{max-width:1050px;margin:auto;padding:24px 20px}header{padding-top:32px;padding-bottom:8px}h1{font-size:clamp(1.7rem,5vw,2.3rem);line-height:1.35}h2{font-size:1.45rem;border-top:1px solid var(--border);padding-top:24px;margin-top:40px;scroll-margin-top:16px}
p,li{max-width:88ch}p{margin:1em 0}li{margin:.65em 0}ul,ol{padding-left:1.5em}a{color:var(--link);text-decoration-thickness:1px;text-underline-offset:3px}a:focus-visible{outline:3px solid var(--link);outline-offset:4px;border-radius:2px}
nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin:16px 0}nav a{padding:6px 0;min-height:44px}.meta{color:var(--muted);font-size:.92rem}.status{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px 16px}.status strong{display:block}.skip{position:absolute;left:16px;top:-100px}.skip:focus{top:8px;background:var(--bg);padding:12px;z-index:2}
table{border-collapse:collapse;width:100%;margin:24px 0;table-layout:fixed;font-size:.94rem}th,td{border:1px solid var(--border);padding:12px;vertical-align:top;text-align:left}th{background:var(--panel)}td:first-child{font-weight:650}code{font-family:ui-monospace,monospace;font-size:.88em;overflow-wrap:anywhere;background:var(--panel);padding:.1em .3em;border-radius:3px}pre{white-space:pre-wrap;border:1px solid var(--border);padding:16px}pre code{padding:0}footer{color:var(--muted);border-top:1px solid var(--border)}
@media(max-width:700px){main,header,footer{padding-left:16px;padding-right:16px}table,tbody,tr,td{display:block}table{border:0}thead{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}tr{margin:18px 0;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--panel)}td{border:0;padding:12px 14px}td+td{border-top:1px solid var(--border)}td::before{content:attr(data-label);display:block;color:var(--muted);font-size:.82rem;font-weight:650;margin-bottom:5px}td:first-child{font-weight:700;background:#283037}nav{display:grid;grid-template-columns:1fr}h2{font-size:1.3rem}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body>
<a class="skip" href="#plan">실행 계획 본문으로</a>
<header><p class="meta">Half Sword · 개발 기록</p><nav aria-label="페이지 이동"><a href="./feature-lab.html">게임 비교 화면</a><a href="''' + GITHUB + '''docs/codex_team/ACTIVE_PLAN.md">GitHub 원문</a></nav>
<div class="status"><strong>''' + status + '''</strong><span>생성일(KST): ''' + args.generated_date + ''' · 원문 SHA256: <code>''' + digest[:12] + '''</code></span><p class="meta">완료·실행·검증·공개 상태는 아래 실제 실행 대장을 기준으로 읽어 주세요. 계획 시간의 경과가 완료를 뜻하지는 않습니다.</p></div>
<nav aria-label="실행 계획 목차">''' + navigation + '''</nav></header>
<main id="plan">''' + content + '''</main>
<footer>승인된 공개 실행 계획 전체를 원문에서 자동 변환했습니다. <a href="''' + GITHUB + '''docs/codex_team/ACTIVE_PLAN.md">최신 원문 확인</a> · <a href="./feature-lab.html">게임 비교 화면</a></footer>
</body></html>
'''
    TARGET.write_text(document, encoding='utf-8')
    print(f'Exported {SOURCE.relative_to(ROOT)} -> {TARGET.relative_to(ROOT)} (source SHA256 {digest})')


if __name__ == '__main__':
    main()
