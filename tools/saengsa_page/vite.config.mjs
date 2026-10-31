// 생사전 시험 페이지 빌드 (사장님 10/29 17:5x — 본판에 올리기 전에 사장님이 해 보는 하위 경로 /saengsa/ · docs/design/saengsa_2026-10-29.md §12)
//  npx vite build --config tools/saengsa_page/vite.config.mjs --base=./ --outDir <폴더> --emptyOutDir
//   → <폴더> 를 개발 가지 위 따로 가지의 public/saengsa/ 에 그대로 넣는다 (/wb/ 시험판과 같은 꼴 — docs/director_handoff.md).
//  본판 vite.config.js 와 다른 점:
//   - VITE_SAENGSA_TEST=1 → config SAENGSA.testMode 참(신청 늘 열림 · 모든 경기 바로 · 기권 없음 · '다음 대회') · src/test_storage.js 가 저장 열쇠를 가름 · pwa.js 등록 안 함
//   - 게임 페이지(index.html) 하나만 · 소스맵 없음
//   - public 은 게임이 쓰는 것만: fonts · sfx · ui · 탭 아이콘 셋을 .tmp/saengsa_public 에 모아 그 폴더를 public 으로 (옛 실험판 corr · r2p · support · wb · 검토용 encounters ·
//     밤 만남 쪽 html · 매니페스트는 뺌). public 폴더로 알려야 빌드가 index.html 의 '/fonts/…' 를 페이지 기준 주소로 바꾼다(하위 경로에서 글꼴이 열림)
//   - 매니페스트 링크를 뺀다(시험판이 또 하나의 'Stillness' 앱으로 설치되지 않게) · 탭 제목에 '생사전 시험판'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

process.env.VITE_SAENGSA_TEST = '1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC_DIRS = ['fonts', 'sfx', 'ui'];
const PUBLIC_FILES = ['icons/tree-sword-orig-20261020-favicon-32.png', 'icons/tree-sword-orig-20261020-favicon-64.png', 'icons/tree-sword-orig-20261020-apple-touch-icon.png'];

const staged = path.join(root, '.tmp', 'saengsa_public');
fs.rmSync(staged, { recursive: true, force: true });
for (const d of PUBLIC_DIRS) fs.cpSync(path.join(root, 'public', d), path.join(staged, d), { recursive: true });
for (const f of PUBLIC_FILES) { fs.mkdirSync(path.dirname(path.join(staged, f)), { recursive: true }); fs.copyFileSync(path.join(root, 'public', f), path.join(staged, f)); }

const testPage = () => {
  return {
    name: 'saengsa-test-page',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => {
        const out = html.replace(/\s*<link rel="manifest"[^>]*>(\s*<!--.*?-->)?/, '').replace('<title>Stillness</title>', '<title>Stillness · 생사전 시험판</title>');
        if (out.includes('rel="manifest"') || !out.includes('생사전 시험판')) throw new Error('시험 페이지: index.html 머리를 못 고침');
        return out;
      },
    },
  };
};

export default defineConfig({
  root,
  base: './',
  publicDir: staged,
  plugins: [testPage()],
  build: {
    sourcemap: false,
    rolldownOptions: { input: { main: path.join(root, 'index.html') } },
  },
});
