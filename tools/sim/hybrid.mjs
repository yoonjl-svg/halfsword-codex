// 옛 명령줄용 빈 래퍼. 아무 설정도 바꾸지 않고 스크립트만 돌린다
//  BODY.weightMode 기본값이 게임과 같은 'hybrid'가 되어(9/29 감사 R-003) 따로 켤 것이 없다.
//  `node tools/sim/hybrid.mjs fights12.mjs` = `node tools/sim/fights12.mjs` (바이트 동일). 새 명령에는 쓰지 않는다
//  옛 levitate 숫자: node tools/sim/with_config.mjs BODY.weightMode=levitate <스크립트> [인자...]
// 실행: node tools/sim/hybrid.mjs fights12.mjs [인자...]
import { simPath } from './is_main.mjs';
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], simPath(script), ...rest]; // 절대 경로로 넘긴다 (대상 스크립트의 직접 실행 확인이 맞게)
await import(new URL('./' + script, import.meta.url));
