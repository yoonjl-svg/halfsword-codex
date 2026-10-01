// ─────────────────────────────────────────────────────────────
//  소리 조각을 만드는 일꾼 스레드 (Web Worker). sound.js 의 prepareSoon 이 부른다.
//  계산이 조금 무거워서(폰에서 전부 1초 남짓) 게임 화면(메인 스레드)이 멈칫하지 않게 여기서 만든다.
// ─────────────────────────────────────────────────────────────
import { makeBankSound } from './sound.js';

self.onmessage = (e) => {
  const { jobs, sr } = e.data;
  for (const j of jobs) {
    const t0 = performance.now();
    const data = makeBankSound(j.name, sr, j.seed);
    // 배열을 복사하지 않고 넘긴다 (transfer)
    self.postMessage({ name: j.name, data, ms: performance.now() - t0 }, [data.buffer]);
  }
};
