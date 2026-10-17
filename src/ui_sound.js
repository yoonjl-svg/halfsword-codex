// 첫 화면 · 대기실 소리 (사장님 10/17 '소리가 없어서 이상해. 첫화면과 대기실에서 확인 류의 단추 누를 때 짧은 효과음 나게 해. 첫 화면에선 바람 소리.
//  우리가 가진 것중 아무거나 써.' — docs/import/ui_sound_2026-10-17.md)
//  ① 확인 류 단추(CONFIRM_BUTTONS)를 누르면 짧은 '딸깍' 하나 — 이미 가진 녹음 public/sfx/revolver/insert2.wav (AugustSandberg, CC0 — 탄 하나를 넣는 소리)의
//     둘째 딸깍 0.1 초만 잘라 쓴다. 새 녹음 · 새 파일 없음
//  ② 첫 화면 = 바람 (녹음 없이 합성): 게임 무대 바람과 같은 짜임 — 흰 잡음 되풀이 → 띠 거르개 → 위 닫기 → 느린 물결(lfo)
//     (sound.js _ambTemple 의 솔바람 · 골짜기 바람, 층 하나의 꼴은 stage_detail_sound.js addNoise). 첫 누름에 스며들고(브라우저 규칙 — 누르기 전에는 소리를 켤 수 없다)
//     첫 화면을 떠나면(곧바로 싸움 — 사장님 10/17 11:2x, 대기실은 싸움의 정지 · 결과 창에서) 잦아들어 꺼진다. 첫 화면 바람 장면이 불 때(#entrance data-phase 'wind') 한 번 세졌다 잦아든다
//  소리 길: 이 모듈의 소리 문맥 하나 → 전체 음량(config.js SOUND.volume — 게임 소리와 같은 값 · 0 이면 아무 소리도 안 낸다) → 스피커.
//   게임 소리(sound.js Sound)의 문맥은 쓰지 않는다 — 그 문맥은 싸움을 열 때 만들고(소리 조각 수십 벌 만들기 · 녹음 내려받기가 함께 돈다)
//   싸움 → 대기실 동안은 멈춰 둔다(main.js toLobby). 싸움 소리 · 크기 · 그 문맥은 그대로다.
//   이 문맥은 소리가 다 끝나고 UI_SOUND.sleep 초 뒤 잠든다(suspend — 싸움 동안 쉼) · 다음 확인 단추가 깨운다. 문맥이 없거나 막히면 조용히 아무것도 안 한다(오류 · 경고 없음)
import { SOUND } from './config.js';

// 값은 모두 사장님 확인 전 (문서 §4)
export const UI_SOUND = Object.freeze({
  // 딸깍: 녹음의 0.19 초부터 0.1 초 (딸깍 꼭대기는 0.194 초 — 앞 2 ms 는 들어감) · 끝 0.05 초에 걸쳐 잦아듦 · 6 kHz 위를 깎아 덜 날카롭게 ·
  //  크기 0.5 (× 전체 음량 0.8 → 꼭대기 약 −12 dBFS — 싸움 타격음보다 한참 작고, 첫 화면 바람 위로는 또렷하게) · 0.05 초 안에 다시 누르면 하나로 ·
  //  앞 딸깍이 아직 울리면 5 ms 에 줄여 끄고 새로 (겹쳐 쌓이지 않게) · 누를 때마다 높낮이 ±3 % (같은 소리가 기계처럼 되풀이되지 않게)
  click: Object.freeze({ src: 'sfx/revolver/insert2.wav', from: 0.19, length: 0.1, fade: 0.05, gain: 0.5, lowpass: 6000, gap: 0.05, detune: 0.03 }),
  // 바람: 스며듦 0.8 초 · 잦아듦 0.8 초 · 바람 장면이 불 때 1.8 배로 0.6 초쯤 올랐다가 2 초쯤에 걸쳐 제자리(그림의 바람 줄 2.2 초와 같이) + 잎 바람 높이 +350 Hz
  //  (공지 확인이 첫 누름이면 스며듦과 세짐이 겹쳐 '휘익 — 잔잔' 하나로 들린다)
  //  층 = 잎 바람 둘(왼 · 오른 — 솔바람 900 Hz 띠 꼴) + 골짜기 바람(220 Hz 아래). gain = 층 크기 · depth = 느린 물결 폭 · lfo = 물결 빠르기(Hz) · sweep = 띠 높이 물결 폭(Hz)
  //  크기: 잔잔할 때 긴 평균 약 −34 dBFS RMS(좌우 섞음 · 물결 따라 약 −38 ~ −31) — 폰 스피커가 내는 400 Hz 위만 약 −35 dBFS.
  //   산사 무대 바람(약 −52 dBFS — 싸움 소리 밑에 깔리는 값)보다 18 dB 쯤 크고, 딸깍(10 ms 크기 약 −25 dBFS)보다 작다
  wind: Object.freeze({
    fadeIn: 0.8, fadeOut: 0.8, gust: 1.8, gustHz: 350,
    layers: Object.freeze([
      Object.freeze({ rate: 1, type: 'bandpass', frequency: 900, q: 0.6, ceiling: 1900, gain: 0.1, lfo: 0.062, depth: 0.05, sweep: 300, pan: -0.35 }),
      Object.freeze({ rate: 0.91, type: 'bandpass', frequency: 760, q: 0.6, ceiling: 1700, gain: 0.085, lfo: 0.023, depth: 0.04, sweep: 250, pan: 0.35 }),
      Object.freeze({ rate: 0.79, type: 'lowpass', frequency: 220, q: 0.4, ceiling: 0, gain: 0.085, lfo: 0.041, depth: 0.035, sweep: 0, pan: 0 }),
    ]),
  }),
  sleep: 2, // 초: 소리가 다 끝나고 이만큼 조용하면 문맥을 재운다
});

// 확인 류 단추 — 누르면 딸깍 (사장님 '확인 류의 단추'): 앞으로 나아가거나 정하는 단추만
//  첫 화면: 공지 확인 · Stage 1(전 처음부터) · 이어하기 · 설정 확인 · 인증번호 받기 · 연결하기
//  대기실: Stage 입장(전 여정 시작 · 이어가기) · 장착 · 해제 · 이름 저장 · 스킬북 구입 · 사용 · 봉인
//  뺀 것 (고르기 · 열기 · 닫기 · 되돌리기라 확인이 아님): 탭 · 칸 · 책 고르기 · 미닫이 · 호칭 상자 · 공지사항 · 설정 · 계정 연결 열기 · 닫기 · 취소 · 첫 화면(대기실) · 계정 글 단추
export const CONFIRM_BUTTONS = [
  '#confirmNotices', '#newJourney', '#continueJourney', '#closeSettings', '#accountSend', '#accountVerify',
  '#lobbyDepart', '#equipItem', '#unequipItem', '#nameForm [type=submit]', '#buyBook', '#useBook', '#sealBook',
].join(', ');

let ctx = null, master = null, noiseBuf = null, broken = false;
let clickPcm = null, clickBuf = null, voice = null, lastPress = -Infinity;
let windWanted = false, wind = null, watcher = null, sleepTimer = 0, wired = false;

const level = () => (SOUND.volume > 0 ? SOUND.volume : 0);
// 자동 값 잡기를 지금 값에서 멈춘다 (cancelAndHoldAtTime 이 없는 브라우저는 지금 값을 다시 적는다)
function hold(param, t) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else { const v = param.value; param.cancelScheduledValues(t); param.setValueAtTime(v, t); }
}

/** 누름 안에서 부른다: 처음이면 문맥을 만들고, 잠들어 있으면 깨운다. 소리를 낼 수 있으면 true */
function wake() {
  if (broken || !(level() > 0)) return false;
  try {
    if (!ctx) {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return false;
      if (navigator.userActivation && !navigator.userActivation.isActive) return false; // 누름 밖: 지금 만들면 브라우저가 '허락 안 됨' 경고를 남긴다
      // 아이폰 무음 스위치: 싸움 소리와 같게 '재생' 용도로 알린다 (sound.js unlock 과 같은 까닭 — 무음 모드에서도 들린다)
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* 지원하지 않는 브라우저 */ }
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      // 아이폰: 누른 그 순간에 아주 짧은 무음을 한 번 재생해 두어야 소리 장치가 확실히 켜진다 (sound.js unlock 과 같다)
      try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch { /* 못 해도 그만 */ }
    }
    if (ctx.state === 'closed') return false;
    master.gain.value = level();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    clearTimeout(sleepTimer);
    return true;
  } catch {
    broken = !ctx; // 문맥을 못 만드는 브라우저면 다시 시도하지 않는다
    return false;
  }
}

function sleepSoon() {
  clearTimeout(sleepTimer);
  sleepTimer = setTimeout(() => {
    if (ctx && !wind && !voice && ctx.state === 'running') ctx.suspend().catch(() => {});
  }, UI_SOUND.sleep * 1000);
}

/** WAV(16 bit PCM) 의 from 초부터 length 초를 떼어 낸다 — 앞 2 ms 들어감 · 끝 fade 초 잦아듦. 다른 꼴이면 null */
function wavSlice(bytes, from, length, fade) {
  const v = new DataView(bytes);
  if (v.byteLength < 44 || v.getUint32(0) !== 0x52494646 || v.getUint32(8) !== 0x57415645) return null; // 'RIFF' · 'WAVE'
  let p = 12, format = 0, channels = 0, rate = 0, bits = 0, start = -1, size = 0;
  while (p + 8 <= v.byteLength) {
    const id = v.getUint32(p), len = v.getUint32(p + 4, true), body = p + 8;
    if (id === 0x666d7420 && body + 16 <= v.byteLength) { // 'fmt '
      format = v.getUint16(body, true); channels = v.getUint16(body + 2, true); rate = v.getUint32(body + 4, true); bits = v.getUint16(body + 14, true);
    } else if (id === 0x64617461) { start = body; size = Math.min(len, v.byteLength - body); break; } // 'data'
    p = body + len + (len & 1);
  }
  if (format !== 1 || bits !== 16 || !channels || !rate || start < 0) return null;
  const frames = Math.floor(size / (2 * channels)), a = Math.min(frames, Math.round(from * rate)), n = Math.min(frames - a, Math.round(length * rate));
  if (n < 2) return null;
  const data = new Float32Array(n), rise = Math.max(1, Math.round(0.002 * rate)), fall = Math.max(1, Math.round(fade * rate));
  for (let i = 0; i < n; i++) data[i] = (v.getInt16(start + (a + i) * 2 * channels, true) / 32768) * Math.min(1, i / rise, (n - 1 - i) / fall); // (여러 통로면 첫 통로)
  return { data, rate };
}

// 딸깍 녹음은 첫 화면이 뜰 때 미리 받아 둔다 (받기에는 누름이 필요 없다 — 첫 누름에 바로 낼 수 있게). 못 받으면 딸깍 없이
function loadClick() {
  if (typeof fetch !== 'function') return;
  const C = UI_SOUND.click;
  fetch(new URL(C.src, document.baseURI))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((bytes) => { if (bytes) clickPcm = wavSlice(bytes, C.from, C.length, C.fade); })
    .catch(() => {});
}

/** 딸깍 하나 (확인 류 단추가 부른다 — 누름 안에서). 냈으면 true */
export function playUiClick() {
  try {
    const now = performance.now(), C = UI_SOUND.click;
    if (now - lastPress < C.gap * 1000 || !wake()) return false;
    if (!clickBuf) {
      if (!clickPcm) return false; // 녹음을 아직 못 받았다 (느린 망 · 처음 오프라인) — 이번 누름은 조용히
      clickBuf = ctx.createBuffer(1, clickPcm.data.length, clickPcm.rate);
      clickBuf.getChannelData(0).set(clickPcm.data);
    }
    lastPress = now;
    const t = ctx.currentTime;
    if (voice) { const old = voice; voice = null; old.gain.gain.setTargetAtTime(0, t, 0.0015); old.source.stop(t + 0.005); }
    const source = ctx.createBufferSource(), tone = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = clickBuf;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * C.detune;
    tone.type = 'lowpass';
    tone.frequency.value = C.lowpass;
    gain.gain.value = C.gain;
    source.connect(tone).connect(gain).connect(master);
    const mine = (voice = { source, gain });
    source.onended = () => { source.disconnect(); tone.disconnect(); gain.disconnect(); if (voice === mine) voice = null; sleepSoon(); };
    source.start(t);
    return true;
  } catch {
    return false;
  }
}

// 바람의 흰 잡음 (4 초, 22050 Hz — sound.js _noiseBuf 와 같은 꼴. 흰 잡음이라 되풀이 이음매에서 딸깍이지 않는다)
function noise() {
  if (noiseBuf) return noiseBuf;
  const sr = 22050, buf = ctx.createBuffer(1, sr * 4, sr), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = buf);
}

function startWind() {
  if (wind || !ctx || !(level() > 0)) return;
  const W = UI_SOUND.wind, c = ctx, t = c.currentTime;
  const out = c.createGain(), gust = c.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(1, t + W.fadeIn);
  gust.connect(out).connect(master);
  const sources = [], nodes = [out, gust], bright = [];
  for (const L of W.layers) {
    const src = c.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    src.playbackRate.value = L.rate;
    const band = c.createBiquadFilter();
    band.type = L.type;
    band.frequency.value = L.frequency;
    band.Q.value = L.q;
    const vol = c.createGain();
    vol.gain.value = L.gain;
    let tail = src.connect(band);
    if (L.ceiling) {
      const top = c.createBiquadFilter(); // 위를 닫아 치찰음처럼 새지 않게
      top.type = 'lowpass';
      top.frequency.value = L.ceiling;
      top.Q.value = 0.5;
      tail = tail.connect(top);
      nodes.push(top);
    }
    tail.connect(vol);
    const pan = L.pan && c.createStereoPanner ? c.createStereoPanner() : null;
    if (pan) { pan.pan.value = L.pan; vol.connect(pan).connect(gust); nodes.push(pan); }
    else vol.connect(gust);
    const lfo = c.createOscillator(), depth = c.createGain(); // 느린 물결: 불었다 잦아든다
    lfo.frequency.value = L.lfo;
    depth.gain.value = L.depth;
    lfo.connect(depth).connect(vol.gain);
    nodes.push(band, vol, depth);
    if (L.sweep) { const sweep = c.createGain(); sweep.gain.value = L.sweep; lfo.connect(sweep).connect(band.frequency); nodes.push(sweep); }
    if (L.type === 'bandpass') bright.push({ param: band.frequency, base: L.frequency });
    sources.push(src, lfo);
  }
  for (const s of sources) s.start(t);
  wind = { out, gust, sources, nodes, bright };
}

function stopWind() {
  const w = wind;
  if (!w) return;
  wind = null;
  try {
    const t = ctx.currentTime, end = t + UI_SOUND.wind.fadeOut, running = ctx.state === 'running';
    if (running) { hold(w.out.gain, t); w.out.gain.linearRampToValueAtTime(0, end); }
    w.sources[0].onended = () => { for (const n of [...w.sources, ...w.nodes]) n.disconnect(); sleepSoon(); };
    for (const s of w.sources) s.stop(running ? end + 0.05 : 0); // 문맥이 쉬는 중이면 깨어나는 즉시 끝
  } catch { /* 이미 닫힌 문맥 */ }
}

// 바람 장면이 분다: 한 번 세졌다 잦아든다 (잎 바람은 조금 높아진다)
function gustWind() {
  if (!wind || !ctx) return;
  try {
    const W = UI_SOUND.wind, t = ctx.currentTime;
    const swell = (param, base, peak) => { hold(param, t); param.setTargetAtTime(peak, t, 0.2); param.setTargetAtTime(base, t + 0.6, 0.7); };
    swell(wind.gust.gain, 1, W.gust);
    for (const b of wind.bright) swell(b.param, b.base, b.base + W.gustHz);
  } catch { /* 소리 없이 */ }
}

/**
 * 첫 화면 바람: on = true 는 첫 화면을 열 때(entrance = 그 #entrance — 바람 장면이 불면 한 번 세진다) · false 는 떠날 때(잦아들어 꺼짐).
 * 문맥이 이미 있으면(대기실에서 '첫 화면' 누름) 바로, 아니면 첫 누름에 스며든다
 */
export function titleWind(on, entrance = null) {
  try {
    windWanted = !!on;
    watcher?.disconnect();
    watcher = null;
    if (!windWanted) { stopWind(); return; }
    if (ctx && wake()) startWind();
    if (entrance && typeof MutationObserver === 'function') {
      watcher = new MutationObserver(() => { if (entrance.dataset.phase === 'wind') gustWind(); });
      watcher.observe(entrance, { attributes: true, attributeFilter: ['data-phase'] });
    }
  } catch { /* 소리 없이 */ }
}

// 첫 화면이 떠 있는 동안의 첫 누름(어디든): 바람을 켠다 · 전화 · 잠금으로 멈춘 문맥도 다시 켠다
function onGesture(event) {
  if (!windWanted || !event.isTrusted || (wind && ctx?.state === 'running')) return;
  if (wake()) startWind();
}
// 화면을 떠나면(앱 전환 · 잠금) 쉬고, 돌아오면 바람이 켜져 있을 때만 다시 (싸움 동안은 잠든 채)
function onVisibility() {
  if (!ctx) return;
  if (document.hidden) { if (ctx.state === 'running') ctx.suspend().catch(() => {}); }
  else if (wind) ctx.resume().catch(() => {});
}

/** game_entry.js 가 덮개(Shadow root)를 열 때마다 부른다: 그 안의 확인 류 단추 → 딸깍. 누름 · 화면 숨김 듣기와 딸깍 녹음 받기는 처음 한 번만 */
export function wireUiSound(root) {
  try {
    // 잡는 단계(capture)에서 — 단추 쪽 처리가 전파를 멈춰도 딸깍은 난다. 잠긴(disabled) 단추는 click 이 오지 않아 소리도 없다
    root.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest(CONFIRM_BUTTONS)) playUiClick();
    }, true);
    if (wired) return;
    wired = true;
    for (const type of ['pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(type, onGesture, { capture: true, passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    loadClick();
  } catch { /* 소리 없이 */ }
}
