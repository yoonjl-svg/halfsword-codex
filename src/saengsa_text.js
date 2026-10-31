// 생사전 화면 글 (docs/text/editing_guide.md — 안내 · 공지 '~합니다' 체 · 단추 · 이름표는 명사 · 결과 줄은 '~다' 체 · 설명은 짧게 · 개발 말 없음)
//  대기실 '생사전' 칸(saengsa_panel.js) · 생사전 화면(saengsa_page.js)이 이 글만 쓴다. 시각 글은 기기의 현지 시각.
import { roundsOf } from './saengsa_rules.js';
import { SAENGSA } from './config.js';
import { titleName } from './title_rules.js';

export const SAENGSA_TEXT = Object.freeze({
  title: '생사전',
  subtitle: '3인의 맹약',
  desc: '왕의 후견인이 왕을 대신해 생사전을 소집했습니다.', // 사장님 10/29 15:5x 글 그대로 — 고치지 않는다
  enter: '생사전 입장',
  back: '대기실',
  bracket: '대진표',
  me: '나',
  nameless: '무명 검객', // 사장님 10/29 15:5x
  companion: '동료',
  pick: '동료 고르기',
  weapon: '무기',
  noWeapon: '무기 없음',
  broken: '부러짐', // 부러진 무기(사장님 10/29 20:1x — 대회 끝까지 부러진 채) · 카드 무기 이름 옆 · 무기 배정 칸 · 팀 무기
  pickWeapons: '세 사람 모두 무기를 고르십시오.',
  arm: '무기 배정', // 경기 화면 — 나설 사람의 무기를 바꿈(사장님 10/29 18:2x 경기마다 배정)
  teamPool: '팀 무기', // 경기 화면 상대 팀 이름표 끝 — 그 팀이 받은 무기 다섯(사장님 10/29 19:5x)
  hire: '고용',
  confirm: '확인',
  myTeam: '내 팀',
  foeTeam: '상대 팀',
  fightEnter: '전투 입장',
  pickHint: '나설 사람을 한두 명 고르십시오.',
  foeHidden: '상대는 입장할 때 함께 보입니다.',
  noInjury: '부상 없음',
  dead: '죽음',
  entrant: '출전',
  win: '승리',
  loss: '패배',
  champion: '우승',
  chest: '왕의 하사품',
  open: '열기',
  noTournament: '신청한 대회가 없습니다.',
  pickTwo: '동료 둘을 고르십시오.',
  willSign: '입장하면 이 팀으로 신청합니다.',
  signed: '생사전에 신청했습니다.',
  noCoins: '금화가 모자랍니다.',
  busy: '진행 중인 대회가 있습니다.',
  saveFail: '저장하지 못했습니다. 다시 시도해 주십시오.',
  notReady: '지금은 이 경기를 할 수 없습니다.',
  notPlayed: '경기를 그만두었습니다. 다시 입장할 수 있습니다.', // 실제 싸움을 정지 창에서 그만둠 — 결과 없음(지지 않음)
  notPlayedResume: '경기를 그만두었습니다. 다시 입장하면 그 상황 그대로 이어 싸웁니다.', // 몸 상태 이어받기 (SAENGSA.resumeState — 사장님 10/30 08:2x)
  resumeHint: '싸우던 경기입니다. 같은 사람 · 같은 무기로 그 상황 그대로 이어 싸웁니다.', // 고르기 · 무기 배정 잠금
  ready: '입장 가능',
  nextCup: '다음 대회', // 시험판(SAENGSA.testMode) — 대회가 끝나면 바로 다음 대회 (사장님 10/29 17:5x)
});
export const INJURY_KO = Object.freeze({ arm: '팔', leg: '다리', torso: '몸통', head: '머리' });
/** 무명 검객 옷 색 이름 (config SAENGSA.nameless.cloth 차례 — 화면 읽기 글에서 같은 팀 무명 검객을 가름) */
export const CLOTH_KO = Object.freeze(['붉은 옷', '쑥색 옷', '황토색 옷', '자줏빛 옷', '청록 옷', '녹슨 붉은 옷', '잿빛 옷', '솔빛 옷']);
export const SCHOOL_KO = Object.freeze({ german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방', none: '무유파' });

const pad = (n) => String(n).padStart(2, '0');
/** 시각 → '10:00' */
export const clockText = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
/** 시각 → '새벽 2시' · '아침 10시' · '낮 12시' · '오후 2시' · '저녁 6시' · '밤 10시' (분이 있으면 '반' 대신 '10시 30분') */
export function hourWords(t) {
  const d = new Date(t), h = d.getHours(), m = d.getMinutes();
  const part = h < 5 ? '새벽' : h < 12 ? '아침' : h === 12 ? '낮' : h < 18 ? '오후' : h < 22 ? '저녁' : '밤';
  const h12 = h % 12 || 12;
  return `${part} ${h12}시${m ? ` ${m}분` : ''}`;
}
/** 남은 시간 → '1시간 12분 뒤' · '12분 뒤' · '곧' */
export function untilText(ms) {
  const min = Math.ceil(ms / 60e3);
  if (min <= 1) return '곧';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ''} 뒤` : `${m}분 뒤`;
}
/** 대진 이름 (16 팀: 16강 · 8강 · 4강 · 결승) */
export function roundName(teamCount, r) {
  const R = roundsOf(teamCount);
  return r >= R - 1 ? '결승' : `${2 ** (R - r)}강`;
}
/** 일정 상태 한 줄 (saengsa_rules.js scheduleState) */
export function stateLine(s) {
  switch (s.kind) {
    case 'signup': return s.until == null ? '신청 받는 중' : `신청 받는 중 · ${hourWords(s.until)}까지`; // 시험판은 창이 늘 열림(until 없음)
    case 'waiting': return `첫 대진 ${hourWords(s.startAt)}`;
    case 'running': return '대회 진행 중';
    case 'done': return '대회 끝';
    default: return `다음 신청 · ${hourWords(s.opensAt)}`;
  }
}
/** 신청 창 안내 */
export const signupHours = (from, to) => `신청은 ${hourWords(from)}부터 ${hourWords(to)}까지입니다.`;
/** 부상 한 줄 '팔 경상 · 다리 중상' */
export const injuryText = (list, serious) => (list.length ? list.map((i) => `${INJURY_KO[i.part] ?? i.part} ${serious(i) ? '중상' : '경상'}`).join(' · ') : SAENGSA_TEXT.noInjury);
/** 팀 이름: 내 팀 · 'N번 팀'(대진표 자리 차례) */
export const teamName = (seat, mine) => (mine ? SAENGSA_TEXT.myTeam : `${seat}번 팀`);
/** 경기 한 줄 결과 (대진표 칸) */
export function resultLine(winner, loser, result, deaths) {
  if (result.by === 'forfeit') return `${loser} 기권`;
  return `${winner} 승리${deaths ? ` · 죽음 ${deaths}` : ''}`;
}
/** 내 경기 결과 줄 ('~다' 체) */
export const myResultLine = (won, forfeit) => (forfeit ? '기권했다' : won ? '상대 팀을 꺾었다' : '상대 팀에 졌다');
/** 내 다음 경기 안내 */
export const nextMatchLine = (round, at, state, now) =>
  state === 'ready' ? `내 경기 · ${round} · 지금 싸울 수 있습니다.` : !at ? `내 경기 · ${round}` : `내 경기 · ${round} · ${clockText(at)}${at > now ? ` · ${untilText(at - now)}` : ''}`; // 시각 없음(시험판) = 대진 이름만
/** 떨어진 뒤 안내 */
export const outLine = (round, forfeit) => (forfeit ? `내 팀은 ${round}에서 기권했습니다.` : `내 팀은 ${round}에서 졌습니다.`);
/** 하사품 안내 · 연 뒤 */
export const chestLine = (n) => `${SAENGSA_TEXT.chest} ${n}개를 열 수 있습니다.`;
export const chestGot = (coins) => `${SAENGSA_TEXT.chest}에서 금화 ${coins.toLocaleString('ko-KR')}을 받았습니다.`;
/** 고용 값 줄 */
export const hireLine = (coins) => `고용 금화 ${coins.toLocaleString('ko-KR')}`;
/** 입장 조건에서 모자란 것 (saengsa_rules.js entryMissing — 사장님 10/29 18:2x): '정복자 호칭이 필요합니다 · 무기 5개가 필요합니다 (지금 2개)' */
export const entryLine = (missing) => missing.map((x) => (x.kind === 'title' ? `${titleName(SAENGSA.entry.title)} 호칭이 필요합니다` : `무기 ${x.need}개가 필요합니다 (지금 ${x.have}개)`)).join(' · ');
