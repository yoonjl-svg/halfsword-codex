// 게임 기록 파일 쓰기 + docs/motion/records/index.json 갱신 (같은 id 는 바꿔 끼운다)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// 기록한 코드의 커밋 (짧은 해시). paths 를 주면 그 경로를 마지막으로 바꾼 커밋, 고친 채 안 올린 파일이 있으면 '+고침'
export function gitRev(dir, paths = []) {
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();
  try {
    const rev = paths.length ? git('log', '-1', '--format=%h', '--', ...paths) : git('rev-parse', '--short', 'HEAD');
    const dirty = git('status', '--porcelain', '--untracked-files=no', '--', ...(paths.length ? paths : ['.'])) !== '';
    return dirty ? `${rev}+고침` : rev;
  } catch {
    return '?';
  }
}

export function writeRecord(dir, r) {
  writeFileSync(join(dir, `${r.id}.json`), JSON.stringify(r));
  const ip = join(dir, 'index.json');
  let index = { format: 'stillness-motion-records/1', records: [] };
  if (existsSync(ip)) {
    try {
      index = JSON.parse(readFileSync(ip, 'utf8'));
    } catch {}
  }
  const entry = { id: r.id, cut: r.cut, kind: r.kind ?? 'game-arm', file: `${r.id}.json`, source: r.source, cond: r.cond, summary: r.summary };
  const i = index.records.findIndex((x) => x.id === r.id);
  if (i >= 0) index.records[i] = entry;
  else index.records.push(entry);
  index.records.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(ip, JSON.stringify(index, null, 1));
}
