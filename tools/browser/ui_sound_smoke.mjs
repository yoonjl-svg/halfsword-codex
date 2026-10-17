// 첫 화면 · 대기실 소리 점검 (사장님 10/17 — docs/import/ui_sound_2026-10-17.md · src/ui_sound.js) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  소리는 들을 수 없으니 오디오 API 를 감싸 적는다: 소리 문맥 만들기 · 소리 시작/멈춤/끝 · 문맥 상태 + 스피커 앞 분석기로 크기(RMS · 꼭대기 — 좌우를 섞은 값)
//  ① 누르기 전에는 소리 문맥이 없다 ② 공지 확인 = 문맥 + 바람(되풀이 잡음 셋 · 물결 셋) + 딸깍 하나 ③ 확인 류 단추마다 딸깍 하나(계정 창 인증번호 받기 포함 — 인증 서버는 안 부름) ·
//     그 밖 단추는 없음 · 연타는 쌓이지 않음(울리던 앞 딸깍을 끔)
//  ④ Stage 1 → 곧바로 싸움(카드 — 10/17 대기실을 거치지 않음): 바람 멈춤(잦아든 뒤 끝) · 싸움 소리는 제 문맥 · 정지 → 대기실: 바람 없음 · 대기실 확인 류 단추 딸깍 · 조용하면 문맥이 잠듦
//  ⑤ 첫 화면(대기실 단추) → 바람 다시 ⑥ Stage 1 → 싸움 → 정지 → 대기실 → Stage 입장 → 싸움: 게임 문맥은 따로(대기실 뒤 다시 돎), 첫 화면 문맥은 새 소리 없이 잠듦
//  ⑦ 첫 누름이 단추가 아니어도(공지 목록) 바람만 · 키보드 Enter 확인 = 딸깍 ⑧ 오디오가 없는 브라우저 · 막힌 문맥(resume 거절)에서도 오류 0 · 싸움까지 그대로
//  npm run build && node tools/pwa/build.mjs && npx vite preview --port 4302 →  node tools/browser/ui_sound_smoke.mjs http://127.0.0.1:4302 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, lobbyFromBattle } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:4302', out = process.argv[3] || '/tmp/ui-sound';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], checks = [], report = {};
const IGNORED = /deprecated parameters for the initialization function/; // 라파이어 초기화 경고 (본판 그대로 — 다른 점검도 거른다)
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`${tag} pageerror ${e}`));
  p.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' && !IGNORED.test(t)) || /AudioContext|audio/i.test(t) && m.type() === 'warning') errors.push(`${tag} ${m.type()} ${t}`); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`${tag} ${r.status()} ${r.url()}`); });
};
const noAuth = (c) => c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
const check = (name, data = {}) => { checks.push({ check: name, ...data }); console.log('ok -', name); };

// 오디오 감싸기 (페이지보다 먼저): 문맥마다 번호 · 소리 시작/멈춤/끝 적기 · destination 에 붙는 노드를 분석기에도 붙인다
const INSTRUMENT = () => {
  const A = (window.__audio = { log: [], ctxs: [], n: 0 }), t0 = performance.now();
  const log = (e) => A.log.push({ t: Math.round(performance.now() - t0), ...e });
  const Base = window.AudioContext;
  if (!Base) return;
  let n = 0;
  class Tagged extends Base {
    constructor(...args) {
      super(...args);
      this.__id = ++n;
      A.ctxs.push(this);
      log({ ev: 'ctx', ctx: this.__id, state: this.state, active: navigator.userActivation ? navigator.userActivation.isActive : null });
      this.addEventListener('statechange', () => log({ ev: 'state', ctx: this.__id, state: this.state }));
    }
  }
  window.AudioContext = Tagged;
  if ('webkitAudioContext' in window) window.webkitAudioContext = Tagged;
  const desc = (s) => ({ ctx: s.context.__id || 0, kind: s.constructor.name, loop: !!s.loop, dur: s.buffer ? +s.buffer.duration.toFixed(4) : null, rate: s.playbackRate ? +s.playbackRate.value.toFixed(3) : null, now: +s.context.currentTime.toFixed(3) });
  // AudioBufferSourceNode 는 start 를 제 것으로 따로 가진다(offset · duration) — start · stop 을 가진 원형마다 감싼다
  for (const C of [window.AudioScheduledSourceNode, window.AudioBufferSourceNode, window.OscillatorNode, window.ConstantSourceNode]) {
    const P = C?.prototype;
    if (!P) continue;
    if (Object.hasOwn(P, 'start')) {
      const start = P.start;
      P.start = function (...a) {
        this.__n = ++A.n;
        log({ ev: 'start', id: this.__n, when: a[0] ?? 0, ...desc(this) });
        this.addEventListener('ended', () => log({ ev: 'ended', id: this.__n, ...desc(this) }));
        return start.apply(this, a);
      };
    }
    if (Object.hasOwn(P, 'stop')) {
      const stop = P.stop;
      P.stop = function (...a) { log({ ev: 'stop', id: this.__n, when: +(a[0] ?? 0).toFixed(3), ...desc(this) }); return stop.apply(this, a); };
    }
  }
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && dest.context.__id) {
      const c = dest.context;
      if (!c.__tap) { c.__tap = c.createAnalyser(); c.__tap.fftSize = 32768; }
      connect.call(this, c.__tap);
    }
    return connect.call(this, dest, ...rest);
  };
};
const audioLog = (p) => p.evaluate(() => window.__audio.log.slice());
const mark = (p) => p.evaluate(() => window.__audio.log.length);
const since = async (p, m) => (await audioLog(p)).slice(m);
// 스피커 앞 크기 — 분석기의 마지막 32768 샘플(48 kHz 면 0.68 초)
const meter = (p, id) => p.evaluate((id) => {
  const c = window.__audio.ctxs.find((x) => x.__id === id);
  if (!c || !c.__tap) return null;
  const a = new Float32Array(c.__tap.fftSize);
  c.__tap.getFloatTimeDomainData(a);
  let s = 0, pk = 0, w = 0, top = 0;
  const win = Math.round(c.sampleRate * 0.01); // 10 ms 창 RMS 의 가장 큰 값 — 딸깍처럼 짧은 소리의 크기
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    s += v * v; pk = Math.max(pk, Math.abs(v)); w += v * v;
    if (i >= win) w -= a[i - win] * a[i - win];
    if (i >= win - 1) top = Math.max(top, w);
  }
  const rms = Math.sqrt(s / a.length), db = (x) => +(20 * Math.log10(x || 1e-9)).toFixed(1);
  return { rmsDb: db(rms), rms10MaxDb: db(Math.sqrt(Math.max(0, top) / win)), peakDb: db(pk), peak: +pk.toFixed(4), state: c.state, time: +c.currentTime.toFixed(2) };
}, id);
const isClick = (e) => e.ev === 'start' && e.kind === 'AudioBufferSourceNode' && !e.loop && e.dur > 0.09 && e.dur < 0.11;
const clicks = (log, ctx = 1) => log.filter((e) => isClick(e) && e.ctx === ctx);
const windSources = (log, ctx = 1) => log.filter((e) => e.ev === 'start' && e.ctx === ctx && e.loop && e.dur === 4);
const lfos = (log, ctx = 1) => log.filter((e) => e.ev === 'start' && e.ctx === ctx && e.kind === 'OscillatorNode');
const phase = (p) => p.evaluate(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase ?? null);
const ready = (p) => p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });
// 누르고 나서 그 사이 적힌 것 (딸깍 수를 센다)
async function press(p, sel, how = 'tap', wait = 180) {
  const m = await mark(p);
  if (how === 'tap') await p.locator(sel).tap(); else await p.locator(sel).click();
  await p.waitForTimeout(wait);
  return since(p, m);
}
const one = (log, what) => assert.equal(clicks(log).length, 1, `${what}: 딸깍 하나 (${JSON.stringify(clicks(log))})`);
const none = (log, what) => assert.equal(clicks(log).length, 0, `${what}: 딸깍 없음 (${JSON.stringify(clicks(log))})`);
// 여정 출발 뒤(첫 화면 Stage 1 · 대기실 Stage 입장): 카드(대기실에서 장착한 무기가 없으면) → 싸움 · 장착한 무기가 있으면 카드 없이 바로 싸움 (main.js journeyLoadout)
async function toFight(p) {
  await p.waitForFunction(() => game.state === 'draw' || game.state === 'fight', null, { timeout: 60000 });
  const drew = await p.evaluate(() => game.state === 'draw');
  if (drew) {
    await p.waitForFunction(() => game.draw.t > 0.6, null, { timeout: 20000 });
    await p.locator('#draw .wcard[data-i="0"]').tap();
    await p.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
  }
  const sim = await p.evaluate(() => game.stats.simTime);
  await p.waitForFunction((t) => game.stats.simTime > t, sim, { timeout: 30000 });
  return drew ? 'draw → fight' : 'fight (lobby weapon)';
}
// t 초 동안 every 초마다 크기
async function levels(p, id, seconds, every = 0.25) {
  const out = [];
  for (let i = 0; i < Math.round(seconds / every); i++) { await p.waitForTimeout(every * 1000); out.push((await meter(p, id)).rmsDb); }
  return out;
}

try {
  // ── A. 폰 가로(터치) — 처음 온 사람: 공지 → 첫 화면 → 싸움(카드) → 정지 → 대기실 → 첫 화면 → 싸움 → 정지 → 대기실 → 싸움 ──
  {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
    await noAuth(context);
    await context.addInitScript(INSTRUMENT);
    const p = await context.newPage();
    watch(p, 'A');
    await p.goto(base + '/?coins=5000', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    assert.equal(await p.locator('#noticeDialog').evaluate((d) => d.open), true);
    await p.waitForTimeout(1500);
    let log = await audioLog(p);
    assert.equal(log.filter((e) => e.ev === 'ctx').length, 0, '누르기 전 소리 문맥 없음');
    check('① before any press: no AudioContext (no autoplay attempt, no warning)');

    // ② 공지 확인 (첫 누름) = 문맥 + 바람 + 딸깍
    log = await press(p, '#confirmNotices', 'tap', 120);
    const clickOnly = await meter(p, 1); // 바람은 막 스며들기 시작 — 이 창의 꼭대기 = 딸깍
    const ctxEv = log.find((e) => e.ev === 'ctx');
    assert.ok(ctxEv && ctxEv.ctx === 1 && ctxEv.active === true, '누름 안에서 문맥 1 을 만든다 ' + JSON.stringify(ctxEv));
    assert.equal(windSources(log).length, 3, '바람 되풀이 잡음 셋');
    assert.equal(lfos(log).length, 3, '바람 물결 셋');
    one(log, '공지 확인');
    // 바람 크기: 누른 뒤 3 초는 0.25 초마다(스며듦 + 바람 장면 세짐), 그 뒤 4 초는 0.5 초마다(잔잔)
    const early = await levels(p, 1, 3, 0.25);
    await ready(p);
    const steady = await levels(p, 1, 4, 0.5);
    report.firstPress = { ctx: ctxEv, click: clicks(log)[0], wind: windSources(log).map((e) => e.rate), clickOnlyMeter: clickOnly, windRmsDbFirst3s: early, windRmsDbSteady: steady, windSteadyMeter: await meter(p, 1) };
    assert.ok(Math.max(...steady) < -24 && Math.min(...steady) > -45, '바람은 작게 깔린다 ' + steady);
    assert.ok(clickOnly.peakDb > -20 && clickOnly.peakDb < -9, '딸깍 꼭대기 ' + clickOnly.peakDb);
    await shot(p, 'A-title-wind');
    check('② notice 확인 (first press): context created inside the press · wind 3 noise loops + 3 LFOs · exactly one click', { clickPeakDb: clickOnly.peakDb, windFirst3s: early, windSteady: steady });

    // ③ 첫 화면의 확인 류 · 아닌 단추
    none(await press(p, '#openSettings'), '설정 열기');
    await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('titleFps').disabled);
    none(await press(p, '#titleFps'), '미닫이');
    none(await press(p, '#titleFps'), '미닫이');
    one(await press(p, '#closeSettings'), '설정 확인');
    none(await press(p, '#openNotices'), '공지사항 열기');
    none(await press(p, '#hideRead'), '지난 업데이트 숨김 미닫이');
    none(await press(p, '#hideRead'), '지난 업데이트 숨김 미닫이');
    one(await press(p, '#confirmNotices'), '공지 확인(첫 화면에서 연 공지)');
    one(await press(p, '#continueJourney', 'tap', 300), '이어하기 (여정 없음 — 첫 화면에 남음)');
    assert.equal(await p.locator('#selectionStatus').textContent(), '이어갈 여정이 없습니다. Stage 1로 시작해 주세요.');
    // 연타: 이어하기 다섯 번 40 ms 사이 — 딸깍마다 앞 딸깍을 끈다 (겹쳐 커지지 않게)
    const box = await p.locator('#continueJourney').boundingBox();
    let m = await mark(p);
    const burstPeaks = [];
    for (let i = 0; i < 5; i++) { await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(40); }
    await p.waitForTimeout(60);
    burstPeaks.push((await meter(p, 1)).peak);
    log = await since(p, m);
    const burst = clicks(log), cut = log.filter((e) => e.ev === 'stop' && e.ctx === 1 && !e.loop && e.dur > 0.09 && e.dur < 0.11);
    assert.ok(burst.length >= 3 && burst.length <= 5, '연타 딸깍 수 ' + burst.length);
    report.burst = { presses: 5, clicks: burst.length, stoppedEarly: cut.length, gapsMs: burst.slice(1).map((e, i) => e.t - burst[i].t), peak: burstPeaks[0], singlePeak: clickOnly.peak };
    for (let i = 1; i < burst.length; i++) if (burst[i].t - burst[i - 1].t < 95) assert.ok(cut.some((e) => e.id === burst[i - 1].id), '앞 딸깍이 울리는 중이면 끈다');
    assert.ok(burstPeaks[0] < clickOnly.peak * 1.6, '연타가 겹쳐 커지지 않는다 ' + JSON.stringify(report.burst));
    // 정확히 70 ms 사이 다섯 번(딸깍 0.1 초보다 짧다 — 페이지 안에서 누름): 딸깍 다섯 · 앞 딸깍 넷을 끈다 · 꼭대기 그대로
    m = await mark(p);
    await p.evaluate(() => new Promise((done) => {
      const b = document.querySelector('#gameEntrance').shadowRoot.getElementById('continueJourney');
      let k = 0;
      const tick = () => { b.click(); if (++k < 5) setTimeout(tick, 70); else setTimeout(done, 60); };
      tick();
    }));
    const stealPeak = (await meter(p, 1)).peak;
    log = await since(p, m);
    const steal = clicks(log), stolen = log.filter((e) => e.ev === 'stop' && e.ctx === 1 && !e.loop && e.dur > 0.09 && e.dur < 0.11);
    report.steal = { presses: 5, gapMs: 70, clicks: steal.length, stoppedEarly: stolen.length, peak: stealPeak, singlePeak: clickOnly.peak };
    assert.equal(steal.length, 5, '70 ms 사이 누름은 하나하나 딸깍 ' + JSON.stringify(report.steal));
    assert.equal(stolen.length, 4, '울리는 앞 딸깍 넷을 끈다 ' + JSON.stringify(report.steal));
    assert.ok(stealPeak < clickOnly.peak * 1.6, '겹쳐 커지지 않는다 ' + JSON.stringify(report.steal));
    check('③ title: one click per confirm press (설정 확인 · 공지 확인 · 이어하기), none for open/toggle buttons; rapid presses do not stack', report.burst);
    // 계정 창: 인증번호 받기 = 딸깍 (메일 칸이 비어 있어 브라우저가 보내기를 막는다 — 인증 서버는 부르지 않음) · 열기 · 글 단추 · 닫기 = 없음
    await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled, null, { timeout: 30000 });
    none(await press(p, '#openAccount'), '계정 연결 열기');
    one(await press(p, '#accountSend'), '인증번호 받기');
    none(await press(p, '#accountMode'), '기존 계정으로 로그인(글 단추)');
    none(await press(p, '#closeAccount'), '계정 닫기');
    check('title account dialog: 인증번호 받기 = one click (empty email — no auth call), open/text/close buttons none');

    // ④ Stage 1 → 곧바로 싸움(카드 고르기 — 아직 장착한 무기 없음): 딸깍 + 바람 멈춤 · 싸움 소리 문맥(2)은 이때 생긴다
    m = await mark(p);
    assert.equal(await departTitle(p, '#newJourney', 'tap'), 'draw');
    await p.waitForTimeout(1300);
    log = await since(p, m);
    one(log, 'Stage 1');
    const windStops = log.filter((e) => e.ev === 'stop' && e.ctx === 1 && (e.loop || e.kind === 'OscillatorNode'));
    const windEnded = log.filter((e) => e.ev === 'ended' && e.ctx === 1 && (e.loop || e.kind === 'OscillatorNode'));
    assert.equal(windStops.length, 6, '바람 여섯 소리 멈춤 예약');
    assert.ok(windStops.every((e) => e.when - e.now > 0.8 && e.when - e.now < 0.9), '잦아듦 0.8 초 뒤 끝 ' + JSON.stringify(windStops[0]));
    assert.equal(windEnded.length, 6, '싸움으로 넘어가고 1.3 초 안에 바람이 다 끝났다');
    const gameCtx = log.find((e) => e.ev === 'ctx' && e.ctx === 2);
    assert.ok(gameCtx, '싸움 소리는 제 문맥(2)에서');
    report.battleEnter = { windStops: windStops.map((e) => +(e.when - e.now).toFixed(3)), ended: windEnded.length, gameCtx, meter: await meter(p, 1) };
    await shot(p, 'A-battle-draw');
    check('④ Stage 1 → battle (card draw, no lobby): one click, wind fades 0.8 s and all 6 wind nodes end; game audio opens its own context (2)', report.battleEnter);

    // 대기실 = 싸움의 정지 → '대기실': 바람은 다시 켜지지 않는다 · 정지 · 대기실은 덮개 밖 게임 단추라 딸깍 없음
    m = await mark(p);
    await lobbyFromBattle(p, 'tap');
    log = await since(p, m);
    none(log, '정지 → 대기실');
    assert.equal(windSources(log).length, 0, '대기실에는 바람 없음');
    assert.equal(await p.locator('#lobbyDepart').textContent(), 'Stage 입장');
    await shot(p, 'A-lobby');
    check('pause → 대기실 from battle: lobby opens (depart button Stage 입장), no wind and no click on the way');

    // 대기실 확인 류 · 아닌 단추
    none(await press(p, '[data-weapon=tree_branch]'), '무기 칸 고르기');
    one(await press(p, '#equipItem', 'tap', 200), '장착');
    report.lobbyClickMeter = await meter(p, 1); // 대기실 = 바람 없음 — 딸깍만의 꼭대기
    one(await press(p, '#unequipItem'), '해제');
    one(await press(p, '#equipItem'), '장착');
    none(await press(p, '#tabArmor'), '방어구 탭');
    none(await press(p, '#tabSkills'), '스킬북 탭');
    none(await press(p, '.book-node[data-book="1"]'), '책 고르기');
    one(await press(p, '#buyBook'), '스킬북 구입');
    one(await press(p, '#sealBook'), '봉인');
    one(await press(p, '#useBook'), '사용');
    none(await press(p, '.detail-close'), '설명 닫기');
    none(await press(p, '.school-tabs [role=tab]:nth-child(2)'), '유파 탭');
    none(await press(p, '#editName'), '이름 수정 열기');
    await p.locator('#playerNameInput').fill('바람');
    one(await press(p, '#nameForm button[type=submit]'), '이름 저장');
    none(await press(p, '#editName'), '이름 수정 열기');
    none(await press(p, '#cancelName'), '이름 취소');
    none(await press(p, '#titleSelect'), '호칭 상자');
    await p.keyboard.press('Escape');
    // 조용하면 잠든다 (2 초)
    m = await mark(p);
    await p.waitForTimeout(2600);
    log = await since(p, m);
    assert.ok(log.some((e) => e.ev === 'state' && e.ctx === 1 && e.state === 'suspended'), '대기실에서 조용하면 첫 화면 문맥이 잠든다');
    check('lobby: one click each for 장착 · 해제 · 구입 · 봉인 · 사용 · 이름 저장; none for item/tab/book/close/name-open/cancel/title box; context sleeps after 2 s of silence');

    // ⑤ 첫 화면(대기실 단추) → 바람 다시 (문맥이 이미 있어 누른 그 자리에서) · 공지 확인 = 딸깍 + 바람 장면 세짐
    m = await mark(p);
    await p.locator('#lobbyBack').tap();
    await p.waitForTimeout(300);
    log = await since(p, m);
    none(log, '첫 화면');
    assert.equal(windSources(log).length, 3, '첫 화면으로 돌아오면 바람 다시');
    assert.ok(log.some((e) => e.ev === 'state' && e.ctx === 1 && e.state === 'running'), '잠든 문맥이 깨어난다');
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) one(await press(p, '#confirmNotices'), '공지 확인(다시)');
    await ready(p);
    check('⑤ back to title: wind restarts at once (sleeping context resumed inside the press)');

    // ⑥ Stage 1 → 곧바로 싸움 (위 대기실에서 나뭇가지를 장착해 두었으니 카드 없이 — main.js journeyLoadout) → 정지 → 대기실 → Stage 입장 → 싸움
    m = await mark(p);
    assert.equal(await departTitle(p, '#newJourney', 'tap'), 'fight');
    await lobbyFromBattle(p, 'tap');
    assert.equal(await departTitle(p, '#lobbyDepart', 'tap'), 'fight'); // 대기실 출발도 같은 덮개 — 걷힐 때까지
    const departAt = (await audioLog(p)).length;
    const path = await toFight(p);
    await p.waitForTimeout(3000);
    log = await since(p, m);
    const afterDepart = (await audioLog(p)).slice(departAt);
    assert.equal(clicks(log).length, 2, 'Stage 1 · Stage 입장 딸깍 둘');
    assert.equal(log.filter((e) => e.ev === 'ctx').length, 0, '싸움 소리는 ④에서 만든 제 문맥(2) 그대로 — 새 문맥 없음');
    const uiStarts = afterDepart.filter((e) => e.ev === 'start' && e.ctx === 1).length;
    assert.equal(uiStarts, 0, '싸움 동안 첫 화면 문맥은 새 소리 없음');
    const ui = await meter(p, 1);
    assert.equal(ui.state, 'suspended', '싸움 동안 첫 화면 문맥은 잠듦');
    const openWind = (await audioLog(p)).filter((e) => e.ctx === 1 && (e.loop || e.kind === 'OscillatorNode'));
    const started = openWind.filter((e) => e.ev === 'start').map((e) => e.id), ended = new Set(openWind.filter((e) => e.ev === 'ended').map((e) => e.id));
    assert.ok(started.every((id) => ended.has(id)), '바람이 싸움으로 이어지지 않는다');
    const game2 = await meter(p, 2);
    assert.equal(game2?.state, 'running', '대기실 동안 멈춘 싸움 소리 문맥이 Stage 입장 뒤 다시 돈다');
    const gameStarts = (await audioLog(p)).filter((e) => e.ev === 'start' && e.ctx === 2).length;
    assert.ok(gameStarts > 0, '싸움 소리는 그대로 난다');
    await shot(p, 'A-fight');
    report.fight = { path, gameState: game2?.state, uiState: ui.state, uiStartsDuringFight: uiStarts, gameSourcesStarted: gameStarts, gameSourcesAfterLobby: afterDepart.filter((e) => e.ev === 'start' && e.ctx === 2).length, windNodesStarted: started.length, windNodesStillOpen: started.filter((id) => !ended.has(id)).length };
    check('⑥ Stage 1 → live fight (lobby weapon, no cards) → pause → 대기실 → Stage 입장 → fight: one click each, game audio stays in its own context (2) and runs again after the lobby, title context suspended with no new sources, no wind left', report.fight);
    await context.close();
  }

  // ── B. PC(마우스 · 키보드): 첫 누름이 공지 목록(단추 아님) → 바람만 · Enter 로 확인 → 딸깍 ──
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await noAuth(context);
    await context.addInitScript(INSTRUMENT);
    const p = await context.newPage();
    watch(p, 'B');
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.locator('#noticeDialog[open]').waitFor({ timeout: 30000 });
    let log = await press(p, '#noticeList', 'click', 200);
    assert.equal(windSources(log).length, 3, '첫 누름이 어디든 바람');
    none(log, '공지 목록 누름');
    const calm = await levels(p, 1, 3, 0.5); // 잔잔해진 바람 (스며듦 0.8 초 뒤)
    await p.locator('#confirmNotices').focus();
    const m = await mark(p);
    await p.keyboard.press('Enter');
    const gust = await levels(p, 1, 3, 0.25); // 바람 장면이 불 때
    log = await since(p, m);
    one(log, 'Enter 로 공지 확인');
    assert.equal(windSources(log).length, 0, '바람은 하나만 (다시 켜지 않음)');
    await ready(p);
    const before = calm.slice(-2).reduce((a, b) => a + b, 0) / 2, peak = Math.max(...gust);
    report.desktopGust = { calmRmsDb: calm, afterEnterRmsDb: gust, riseDb: +(peak - before).toFixed(1) };
    assert.ok(peak - before > 2.5, '바람 장면이 불 때 바람이 세진다 ' + JSON.stringify(report.desktopGust));
    assert.ok(gust.at(-1) < peak - 1.5, '세진 바람은 잦아든다 ' + JSON.stringify(report.desktopGust));
    check('⑦ desktop: first press on the notice list (not a button) starts wind only; Enter on 확인 = one click; title gust swells the wind then settles', report.desktopGust);
    await context.close();
  }

  // ── C. 오디오가 없는 브라우저 · D. 막힌 문맥(resume 거절 · 늘 쉼): 오류 0 · 싸움까지 그대로 ──
  for (const [tag, setup] of [
    ['C', () => { delete window.AudioContext; delete window.webkitAudioContext; }],
    ['D', () => {
      const Base = window.AudioContext;
      window.AudioContext = class extends Base {
        constructor(...a) { super(...a); Base.prototype.suspend.call(this); }
        resume() { return Promise.reject(new DOMException('not allowed', 'NotAllowedError')); }
      };
    }],
  ]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await noAuth(context);
    await context.addInitScript(setup);
    const p = await context.newPage();
    watch(p, tag);
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    await p.locator('#confirmNotices').tap();
    await ready(p);
    await p.locator('#continueJourney').tap();
    assert.equal(await departTitle(p, '#newJourney', 'tap'), 'draw');
    await lobbyFromBattle(p, 'tap');
    await p.locator('[data-weapon=tree_branch]').tap();
    await p.locator('#equipItem').tap();
    await p.locator('#unequipItem').tap(); // 카드 길로 (장착 · 해제 둘 다 눌러 본다)
    await departTitle(p, '#lobbyDepart', 'tap'); // Stage 입장 — 덮개가 걷힐 때까지
    const path = await toFight(p);
    check(`⑧-${tag} ${tag === 'C' ? 'no AudioContext at all' : 'blocked context (resume rejected, stays suspended)'}: title → Stage 1 → card draw → pause → lobby → ${path} works, no errors`);
    await context.close();
  }

  assert.deepEqual(errors, [], '오류 · 오디오 경고 0');
  check('console errors / page errors / audio warnings / HTTP ≥ 400: 0');
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(`${out}/ui_sound_report.json`, JSON.stringify({ checks, report, errors }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, errors, report }, null, 2));
  await browser.close();
}
