// 생사전 시계 (사장님 10/29 14:1x — 설계 docs/design/saengsa_2026-10-29.md §3): 기기의 현지 시각으로 신청 창 · 대진 시각을 셈한다.
//  모두 순수 함수(Date 와 config 만 — 시험 tools/sim/saengsa.test.mjs). 시각 = ms(Date.getTime), 날 = 'YYYY-MM-DD'(현지 날짜 — 그 대회의 첫 대진이 있는 날).
//  신청 창 = 대회 전날 SAENGSA.signupFrom 시(밤 10시) ~ 대회 날 signupTo 시(새벽 2시) · 첫 대진 = 대회 날 startHour 시(아침 10시) · 다음 대진 = roundEveryH 시간마다.
//  시험 주소 `?saengsaNow=2026-10-30T09:59` = 열 때 기기 시계를 그 현지 시각으로 옮긴다(그 뒤로는 그대로 흐름 — clockFrom).
import { SAENGSA } from './config.js';

export const MINUTE = 60e3;
export const HOUR = 60 * MINUTE;
const pad = (n) => String(n).padStart(2, '0');
const parts = (day) => day.split('-').map(Number);

/** 시각 → 그 현지 날 'YYYY-MM-DD' */
export function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 날을 n 날 옮김 (현지 달력 — 서머타임이 있어도 날짜로 셈) */
export function shiftDay(day, n) {
  const [y, m, d] = parts(day);
  return dayKey(new Date(y, m - 1, d + n, 12).getTime());
}
/** 그 날 h 시(소수 · 24 이상 · 음수도 — Date 가 날을 넘김) 현지 시각 */
export function atHour(day, h) {
  const [y, m, d] = parts(day);
  return new Date(y, m - 1, d, 0, Math.round(h * 60)).getTime();
}
/** 그 대회의 신청 창 { day, from, to } */
export function windowOf(day, cfg = SAENGSA) {
  return { day, from: atHour(cfg.signupFrom > cfg.signupTo ? shiftDay(day, -1) : day, cfg.signupFrom), to: atHour(day, cfg.signupTo) };
}
/** 지금 열린 신청 창(open true) · 닫혀 있으면 다음 창(open false) — { open, day, from, to } · 시험판(cfg.testMode)은 늘 열림(to null · 대회 날 = 오늘) */
export function signupWindow(now, cfg = SAENGSA) {
  const today = dayKey(now);
  if (cfg.testMode) return { open: true, day: today, from: now, to: null };
  for (let i = 0; i < 3; i++) {
    const w = windowOf(shiftDay(today, i), cfg);
    if (now < w.to) return { ...w, open: now >= w.from };
  }
  return { ...windowOf(shiftDay(today, 1), cfg), open: false }; // 닿지 않음 (창이 하루보다 길게 적힌 값)
}
/** 그 대회 첫 대진 시각 */
export const startAt = (day, cfg = SAENGSA) => atHour(day, cfg.startHour);
/** 그 대회 r 번째 대진(0 = 첫 대진) 시각 */
export const roundAt = (day, r, cfg = SAENGSA) => atHour(day, cfg.startHour + r * cfg.roundEveryH);
/** 결과를 저장한 시각 → 그 팀의 다음 경기를 시작할 수 있는 시각 */
export const restUntil = (savedAt, cfg = SAENGSA) => savedAt + cfg.restH * HOUR;

/** 'YYYY-MM-DDTHH:MM' (현지 시각) → ms · 못 읽으면 NaN */
export function parseLocal(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(String(text ?? '').trim());
  if (!m) return NaN;
  const [, y, mo, d, h = '0', mi = '0'] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi).getTime();
}
/** 지금 시각 함수: 주소에 ?saengsaNow= 가 있으면 그 시각에서 출발해 흐름 · 없으면 기기 시계 */
export function clockFrom(search = typeof location === 'undefined' ? '' : location.search, real = () => Date.now()) {
  const raw = new URLSearchParams(String(search).replace(/^\?/, '').replace(/\?/g, '&')).get('saengsaNow');
  const want = raw ? parseLocal(raw) : NaN;
  if (!Number.isFinite(want)) return real;
  const offset = want - real();
  return () => real() + offset;
}
