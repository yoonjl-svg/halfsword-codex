// 시작 지급품은 제외한다. 전리품/구매가 생기면 획득 사건마다 고유 receipt를 넘긴다.
// 같은 사건을 재처리해도 중복 상승하지 않으며, 장착/해제와 기존 유파 숙련은 레벨에 영향이 없다.
export const PROGRESS_KEY = 'stillness.fork.progress.v1';
let session = { acquisitions: [], coins: 100, titles: [], title: '여행자' };
const validText = s => typeof s === 'string' && s.length > 0 && s.length <= 160;
export function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (value?.version === 1) {
      const seen = new Set();
      const acquisitions = (Array.isArray(value.acquisitions) ? value.acquisitions : []).filter(a => {
        if (!a || !validText(a.receipt) || !['item', 'skillbook'].includes(a.kind) || seen.has(a.receipt)) return false;
        seen.add(a.receipt); return true;
      }).map(({receipt, kind}) => ({receipt, kind}));
      const titles = (Array.isArray(value.titles) ? value.titles : []).filter(t => t && validText(t.event) && validText(t.name));
      session = { acquisitions, titles, title: titles.some(t => t.name === value.title) ? value.title : '여행자',
        coins: Number.isSafeInteger(value.coins) && value.coins >= 0 ? value.coins : 100 };
    }
  } catch { /* 이번 실행 동안 유지한다. */ }
  return { ...structuredClone(session), level: 1 + session.acquisitions.length };
}
function save() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, ...session })); return true; }
  catch { return false; }
}
export function recordAcquisition({ receipt, kind, source }) {
  readProgress();
  if (source === 'starter' || !validText(receipt) || !['item', 'skillbook'].includes(kind) || session.acquisitions.some(a => a.receipt === receipt)) return false;
  session.acquisitions.push({ receipt, kind }); save(); return true;
}
// 이벤트 조건은 해당 이벤트에서 판정한다. 호칭은 레벨/유파로 자동 해금하지 않는다.
export function unlockEventTitle(event, name) {
  readProgress();
  if (!validText(event) || !validText(name) || session.titles.some(t => t.event === event)) return false;
  session.titles.push({ event, name }); save(); return true;
}
