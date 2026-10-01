// 이 모듈을 node 로 직접 돌렸나 — 측정 도구의 "직접 실행이면 결과를 찍는다" 확인용
//  예전 확인(import.meta.url === `file://${process.argv[1]}`)은 감싸는 스크립트(with_config.mjs·hybrid.mjs 등)가
//  process.argv[1] 에 맨 파일 이름을 넣으면 어긋나서 아무것도 안 찍었다. 경로를 절대 경로 URL 로 바꿔 견준다
//  (감싸는 스크립트는 이제 절대 경로를 넘긴다 — 맨 이름이면 이 폴더 기준으로 푼다)
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function isMain(metaUrl) {
  const a = process.argv[1];
  if (!a) return false;
  const abs = path.isAbsolute(a) ? a : path.resolve(HERE, a);
  return metaUrl === pathToFileURL(abs).href || metaUrl === pathToFileURL(path.resolve(a)).href;
}

/** 감싸는 스크립트용: 같은 폴더의 스크립트 이름 → 절대 경로 (process.argv[1] 에 넣는다) */
export const simPath = (script) => path.resolve(HERE, script);
