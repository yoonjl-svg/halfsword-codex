// Loaded exclusively by tools/attack_balance_page/vite.config.mjs.
// This file deliberately has no imports: storage isolation precedes game_entry's imports.
const BASELINE = '88a96061e8dd93e8f107b7b0df647a341e73fa5d';
const PREFIX = 'stillness.research.attack-balance-20261101.';
function isolateStorage() {
  const ls = globalThis.localStorage, P = Storage.prototype;
  if (P.__attackBalanceResearch) return;
  const { getItem, setItem, removeItem, key, clear } = P;
  const length = Object.getOwnPropertyDescriptor(P, 'length').get;
  const keys = s => Array.from({ length: length.call(s) }, (_, i) => key.call(s, i)).filter(k => k?.startsWith(PREFIX));
  P.getItem = function(k) { return getItem.call(this, this === ls ? PREFIX + k : k); };
  P.setItem = function(k, v) { return setItem.call(this, this === ls ? PREFIX + k : k, v); };
  P.removeItem = function(k) { return removeItem.call(this, this === ls ? PREFIX + k : k); };
  P.key = function(i) { return this === ls ? keys(this)[i]?.slice(PREFIX.length) ?? null : key.call(this, i); };
  P.clear = function() { if (this !== ls) return clear.call(this); for (const k of keys(this)) removeItem.call(this, k); };
  Object.defineProperty(P, 'length', { configurable: true, get() { return this === ls ? keys(this).length : length.call(this); } });
  Object.defineProperty(P, '__attackBalanceResearch', { value: true });
}
let storageIsolated = false;
try { isolateStorage(); storageIsolated = true; } catch { /* unavailable storage is reported */ }

const catalog = [
  ['mordschlag', 'german', '비기', '죽음의 일격', 'longsword', '상대와 가슴 사이 0.8 m 이내에서 2초 유지 → 비기 표시가 뜨면 톡 또는 빠르게 긋기. 기본 판당 1회.', [0, .03], .68],
  ['duplieren', 'german', '특수', '자동 겹치기', 'longsword', '가슴 사이 0.8 m 초과~1.6 m에서 칼을 0.6초 맞댄다. 손을 빠르게 긋는 중에는 발동을 미룬다. 스틱·칼·막기로 맞댐을 유지하는 노력도 기록한다.', [0, .03], 1.2],
  ['schielhau', 'german', '고유', '실하우', 'longsword', '칼손을 오른 어깨 위로 옮겨 준비한 뒤 왼쪽 아래로 빠르게 긋기. 현재 게임 표시는 곁눈 베기.', [.42, .42], 1.4],
  ['zwerchAbtritt', 'german', '고유', '비껴 딛는 가로베기', 'longsword', '이동 스틱을 옆으로 50% 이상 기울이면서 오른쪽 옆에서 왼쪽으로 가로 긋기.', [.52, .06], 1.4],
  ['risoluto', 'italian', '비기', '안다레 리솔루토', 'rapier', '막기 단추를 놓고 칼로 상대 칼의 길을 덮으며 스틱을 앞이나 뒤로 기울여 유지한다. 비기 표시가 뜨면 톡 또는 빠르게 긋기. 판당 1회.', [0, .03], 1.5],
  ['inquartata', 'italian', '특수', '비껴서며 찌르기', 'rapier', '상대 칼이 들어오는 동안 이동 스틱을 옆으로 기울이며 화면을 톡 친다.', [0, .03], 1.5],
  ['imbroccata', 'italian', '고유', '내려 찌르기', 'rapier', '아래로 빠르게 긋는다. 수직·사선 내려긋기가 내려 찌르기로 바뀐다.', [.02, .52], 1.4],
  ['cavazione', 'italian', '고유', '칼끝 돌려 빼기', 'rapier', '내가 휘두르는 중이 아닌 실제 칼 맞댐 시작 후 0.2초 이상, 마지막 맞댐 후 1.2초 안에 톡 친다. 이른 톡은 해당 기회를 소모한다. 막기 단추를 쥔 채로도 가능.', [0, .03], 1.3],
  ['cingir', 'iberian', '비기', '싱지르', 'zweihander', '칼끝 거리 밖에서 2초 준비한 뒤 공격 손가락으로 1.5초 안에 원 한 바퀴를 그린다. 이동 스틱 회전은 현재 기본 커맨드가 아니다. 판당 1회.', [0, .03], 3.3],
  ['redondo', 'iberian', '특수', '정수리 가르기', 'zweihander', '화면의 같은 자리를 0.6초 이상 눌러 칼을 어깨에 메고 손을 떼면 정수리로 내려 가른다. 비기 준비가 열리면 우선권에 주의.', [0, .03], 1.5],
  ['talhoRodeado', 'iberian', '고유', '나선 걸음 베기', 'zweihander', '이동 스틱을 옆으로 기울이면서 오른 어깨 위에서 왼쪽 아래로 빠르게 긋기.', [.42, .42], 1.5],
  ['gonosen', 'japanese', '비기', '고노센', 'uchigatana', '이동·공격·막기·피격 없이 2초 준비한다. 준비 후 상대가 들어오거나 공격을 들 때 비기 표시를 보고 톡 또는 빠르게 긋기. 판당 1회.', [0, .03], 2.5],
  ['tsubameGaeshi', 'japanese', '특수', '제비 베기', 'uchigatana', '내려벤 칼이 빗나가거나 막힌 뒤 다시 위로 빠르게 긋는다. 앞 칼의 조건이 필요하다.', [.02, .52], 1.5],
  ['hirakiGiri', 'japanese', '고유', '비껴 베기', 'uchigatana', '이동 스틱을 옆으로 기울이면서 왼 어깨 위에서 오른쪽 아래로 빠르게 긋기.', [-.4, .42], 1.4],
  ['kote', 'japanese', '고유', '손목 치기', 'uchigatana', '칼손을 가운데 긴 자세에 놓고 짧게 아래로 빠르게 긋기.', [0, .03], 1.3],
  ['geoksal', 'chinese', '비기', '격살', 'hwando', '앞으로 이동 스틱을 기울이고 막기 버튼을 새로 누른 뒤 0.6초 안에 동방 자세로 상대 칼을 받는다. 나를 베지 못한 칼이 떨어질 때 자동 연환. 받은 자세에 따라 4갈래, 기본 판당 3회.', [0, .03], 1.4],
  ['lianchi', 'chinese', '특수', '날개 접기', 'hwando', '이동 스틱으로 물러나는 동안 또는 물러남을 푼 뒤 0.6초 안에 화면을 톡 친다.', [0, .03], 1.5],
  ['yaoji', 'chinese', '고유', '허리 베기', 'hwando', '오른쪽 옆에서 왼쪽으로 빠르게 가로 긋기.', [.52, .06], 1.4],
  ['chebuYaoji', 'chinese', '고유', '끌어 딛고 허리 베기', 'hwando', '이동 스틱을 앞으로 50% 이상 기울이면서 오른쪽 옆에서 왼쪽으로 빠르게 가로 긋기.', [.52, .06], 1.4],
].map(([id, school, kind, label, weapon, instruction, hand, distance]) => ({ id, school, kind, label, weapon, instruction, hand, distance }));
const q = new URLSearchParams(location.search);
const chosen = catalog.find(c => c.id === q.get('technique')) ?? catalog[0];
const mode = q.get('trial') === 'natural' ? 'natural' : 'condition';
// A bare research URL receives the actual game's existing test route and kit.
if (q.get('test') !== '1' || q.get('skillNodes') !== 'all' || !q.has('weapon')) {
  q.set('test', '1'); q.set('skillNodes', 'all'); q.set('weapon', chosen.weapon);
  q.set('technique', chosen.id); q.set('trial', mode);
  if (!q.has('foe')) q.set('foe', 'heinrich');
  if (!q.has('stage')) q.set('stage', 'castle');
  location.replace(`${location.pathname}?${q}`);
} else {
  const events = [], inputs = [], samples = [];
  let session = null, terminalSnapshot = null, previous = null, prevNow = performance.now(), activeWall = 0, sampleAt = 0;
  let hookedPlayer = null, hookedCombat = null, fixtureDone = false, fixtureInfo = null;
  let seq = 0, motionRefs = {}, hookRestore = [], episodeSerial = 0;
  const episodes = new WeakMap();
  const episodeId = ref => { if (!ref || typeof ref !== 'object') return null; if (!episodes.has(ref)) episodes.set(ref, ++episodeSerial); return episodes.get(ref); };
  const clock = () => {
    const g = window.game;
    return { wallMs: performance.now(), activeWallS: activeWall, physicsS: g?.stats?.simTime ?? null, referenceS: g ? g.stats.simTime / g.config.TIME.k : null };
  };
  const clean = (v, depth = 0) => {
    if (v == null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
    if (typeof v === 'function' || depth > 3) return undefined;
    if (v instanceof Set) return [...v];
    if (Array.isArray(v)) return v.slice(0, 80).map(x => clean(x, depth + 1));
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (['f', 'me', 'foe', 'fighter', 'attacker', 'victim', 'world', 'parent', 'bodies', 'groups', 'mesh', 'sword', 'ctx'].includes(k)) continue;
      const z = clean(x, depth + 1); if (z !== undefined) out[k] = z;
    }
    return out;
  };
  const record = (type, data = {}) => {
    if (session?.ended) return;
    events.push({ sequence: ++seq, type, ...clock(), ...data });
  };
  const body = f => f ? ({
    name: f.name, weapon: f.weapon?.id, school: f.swordArt?.tradition,
    alive: f.alive, state: f.state, causeOfDeath: f.causeOfDeath ?? null, decapitated: !!f.decapitated, armed: f.armed, weaponBroken: f.weaponBroken,
    armor: { hasHelmet: f.hasHelmet, helmetType: f.helmetType, helmetIntegrity: f.helmetIntegrity, plate: clean(f.plate) },
    blood: f.blood, bleed: f.bleed, consciousness: f.consciousness, pain: f.pain,
    limbs: { ...f.limbs }, wounds: clean(f.wounds), stamina: { value: f.stamina?.value, exhausted: f.stamina?.exhausted, level: f.stamina?.level, spent: clean(f.stamina?.spent), counts: clean(f.stamina?.counts), recovered: f.stamina?.recovered },
    chest: clean(f.bodies?.chest?.translation()), hand: [f.handOffset.x, f.handOffset.y],
  }) : null;
  const snapshot = () => {
    const g = window.game, p = g?.player, u = g?.playerUnique, s = g?.playerSecret;
    return {
      ...clock(), state: g?.state, player: body(p), enemy: body(g?.enemy), distance: p?.foeDistance(),
      secret: s ? { name: s.S?.name, open: !!s.open, opened: s.opened, left: s.left, used: p.secretUsed ?? 0, pressT: s.pressT ?? null, poor: clean(s.poor), spinArm: clean(s.spinArm), iaiArm: clean(s.iaiArm), riso: clean(s.riso?.stats), stage: p.skill.sec?.stage ?? null, bursts: p.skill.secretBursts, stats: clean(p.skill.secretStats) } : null,
      unique: u ? { stats: clean(u.stats), running: u.r?.e?.name ?? null, stroke: clean(u.cur), previousStroke: clean(u.last), dupA: clean(u.dupA), bladeTouch: u.bladeTouch(), touch: clean(u.touch), coolT: clean(u.coolT), coolRuns: clean(u.stats?.coolRuns), available: u.list.map(e => ({ name: e.name, special: !!e.special, cooldown: Number.isFinite(u.coolLeft(e.name)) ? u.coolLeft(e.name) : 'motion_busy' })) } : null,
      inputState: p ? { stickX: p.stickX, stickY: p.stickY, handHeld: p.handHeld, inputSwinging: p.skill.inputSwinging, guardHeld: g.playerGuard?.held, guardActive: g.playerGuard?.active, guardLine: g.playerGuard?.line } : null,
      motion: p ? { secret: p.skill.sec?.stage ?? null, iai: p.iai?.kind ?? p.iai?.tech ?? p.iai?.name ?? null, iaiRequest: !!p.iaiReq, tap: p.skill.tap?.uniqTech ?? (p.skill.tap ? 'ordinary' : null), artTech: clean(p.artTech), swinging: p.skill.swinging } : null,
      cue: [...document.querySelectorAll('#techSlot .slot.show')].map(el => ({ kind: el.dataset.kind, text: el.innerText.replace(/\s+/g, ' ').trim(), visible: +getComputedStyle(el).opacity > .5 })),
      rawGameHits: [...(g?.stats?.hits ?? [])],
    };
  };
  function conditionText(g) {
    const p = g.player, s = g.playerSecret, u = g.playerUnique, k = g.config.TIME.k, U = g.config.UNIQUE_ASSIST;
    const seconds = t => Math.max(0, t / k).toFixed(1);
    if (g.state !== 'fight') return '싸움 시작 뒤 조건을 확인합니다.';
    if (p.swordArt.tradition !== chosen.school) return '선택 기술과 무기 유파가 다릅니다. 새 판을 여십시오.';
    if (!p.alive || !g.enemy.alive) return '판이 끝났습니다. 원본을 받고 새 판을 여십시오.';
    if (!p.armed || p.weaponBroken) return '칼을 쓸 수 없는 상태입니다.';
    if (p.state !== 'stand') return `서 있는 상태가 필요합니다 (현재 ${p.state}).`;
    if (p.stamina.exhausted) return '탈진 중입니다.';
    if (chosen.kind === '비기') {
      if (!s?.S) return '이 무기/키트에 비기가 열려 있지 않습니다.';
      if (!(s.left > 0)) return '이 판의 비기 횟수를 모두 썼습니다.';
      if (!p.stamina.secretReady) return '비기를 낼 기력이 없습니다 (기력 0 이하).';
      if (p.skill.secretPhase) return '비기 동작·손 복귀 중입니다.';
      if (s.open) return chosen.id === 'cingir' ? '준비창 열림: 공격 손가락으로 1.5초 안에 원을 그립니다.' : chosen.id === 'geoksal' ? '받기 조건 열림: 칼이 떨어지면 자동 실행합니다.' : '비기 창 열림: 톡 또는 빠른 긋기를 기다립니다.';
      if (chosen.id === 'mordschlag') return p.foeDistance() > g.config.SECRET.mordCloseN ? '가슴 사이 0.8 m 이내로 더 붙어야 합니다.' : `가까움 유지 ${seconds(s.pressT ?? 0)} / ${seconds(g.config.SECRET.mordPress)}초`;
      if (chosen.id === 'risoluto') return g.playerGuard?.held ? '막기 단추를 놓고 칼로 덮으며 앞/뒤 스틱을 유지합니다.' : '칼 덮음 + 앞/뒤 스틱 유지 조건을 기다립니다.';
      if (chosen.id === 'cingir') return `칼끝 거리 밖 준비 ${seconds(s.spinArm?.t ?? 0)} / 2.0초 (준비 중 피격·공격 시 취소)`;
      if (chosen.id === 'gonosen') return s.iaiArm?.armed ? '준비됨: 상대 진입·들어 올림의 비기 창을 기다립니다.' : `무행동 준비 ${seconds(s.iaiArm?.t ?? 0)} / 2.0초 (이동·공격·막기·피격 시 취소)`;
      if (chosen.id === 'geoksal') {
        if (!((p.stickY ?? 0) > Math.abs(p.stickX ?? 0))) return '전진 스틱 + 새 막기 입력이 필요합니다.';
        if (!g.playerGuard?.held) return '전진 중 막기 단추를 새로 눌러야 합니다.';
        return '새 막기 0.6초 안에 받아야 합니다. 상처 없이 칼이 떨어질 때 자동 실행합니다.';
      }
    }
    const e = u?.list.find(e => e.name === chosen.id);
    if (!e) return '선택 기술이 현재 키트에 없습니다.';
    const cool = u.coolLeft(chosen.id);
    if (cool > 0) return Number.isFinite(cool) ? `특수 식힘 ${seconds(cool)}초 남음` : '특수 동작·손 복귀 중입니다 (끝나면 식힘 3초).';
    if (p.skill.sec || p.iai || p.iaiReq || p.skill.tap || p.skill.pom) return '다른 공격·손 복귀 중입니다. 끝난 뒤 조건을 시도합니다.';
    if (chosen.id === 'duplieren') {
      const d = p.foeDistance(), lo = U.dupBandMin ?? g.config.SECRET.mordCloseN;
      if (!(d > lo && d <= U.dupBandMax)) return '가슴 사이 0.8 m 초과~1.6 m가 필요합니다.';
      if (!u.bladeTouch()) return '실제 칼 맞댐이 필요합니다. 스틱·칼·막기로 유지합니다.';
      return `맞댐 누적 ${seconds(u.dupA?.st ?? 0)} / ${seconds(U.dupStackS)}초${p.skill.inputSwinging ? ' · 빠른 긋기를 멈추면 발동 가능' : ''}`;
    }
    if (chosen.id === 'cavazione') {
      const t = u.touch;
      if (!t) return '내가 베는 중이 아닌 실제 칼 맞댐을 먼저 만듭니다.';
      if (t.cut) return '내 베기 중의 맞댐은 이 기회에서 제외됩니다.';
      if (t.cavSpent) return '이 맞댐 기회는 이미 사용되었거나 이른 탭으로 소모됐습니다.';
      if (u.t - t.t0 < U.cavFrom) return '아직 이른 탭 구간입니다 (맞댐 시작 후 0.2초 대기).';
      if (u.t - t.t1 > U.cavTo) return '마지막 맞댐 후 탭 기회 1.2초가 지났습니다.';
      return '탭 기회 열림: 칼끝 돌려 빼기를 시도할 수 있습니다.';
    }
    if (chosen.id === 'inquartata') {
      if (!(Math.abs(p.stickX ?? 0) >= .5 && Math.abs(p.stickX ?? 0) >= Math.abs(p.stickY ?? 0))) return '이동 스틱을 옆으로 50% 이상 기울입니다.';
      return (g.playerGuard?.noThreat ?? Infinity) <= U.inqThreat ? '상대 칼이 들어오는 기회: 지금 톡을 시도할 수 있습니다.' : '상대 칼이 들어오는 기회를 기다립니다.';
    }
    if (chosen.id === 'lianchi') return u.backNow() || (u.backOff != null && u.t - u.backOff <= U.lianWindow) ? '물러남 탭 기회 열림' : '물러나는 동안 또는 놓은 뒤 0.6초 안의 탭이 필요합니다.';
    if (chosen.id === 'redondo') return u.winding ? '칼을 메는 중입니다. 손을 떼면 내려칩니다.' : '같은 자리를 0.6초 이상 길게 누릅니다.';
    if (chosen.id === 'tsubameGaeshi') return '내려벤 칼의 빗나감·막힘 뒤 위로 빠르게 긋는 조건을 기다립니다.';
    if (['zwerchAbtritt', 'talhoRodeado', 'hirakiGiri'].includes(chosen.id) && !(Math.abs(p.stickX ?? 0) >= .5 && Math.abs(p.stickX ?? 0) >= Math.abs(p.stickY ?? 0))) return '옆 이동 스틱 50% 이상 + 정해진 시작 자세의 긋기가 필요합니다.';
    if (chosen.id === 'chebuYaoji' && !((p.stickY ?? 0) >= .5 && (p.stickY ?? 0) > Math.abs(p.stickX ?? 0))) return '앞 이동 스틱 50% 이상 + 오른쪽 시작 가로긋기가 필요합니다.';
    return '시작 자세·방향을 맞춘 빠른 긋기를 기다립니다.';
  }
  function wrap(obj, key, fn) {
    const original = obj?.[key]; if (typeof original !== 'function') return;
    obj[key] = function(...args) { return fn.call(this, original, args); };
    hookRestore.push(() => { obj[key] = original; });
  }
  function hook(g) {
    if (hookedPlayer !== g.player) {
      hookedPlayer = g.player; motionRefs = {};
      const p = g.player, u = g.playerUnique;
      wrap(p.skill, 'secret', function(original, args) {
        const context = { technique: args[0]?.S?.name ?? null, trigger: clean(args[0]?.ctx), phaseBefore: this.secretPhase };
        record('request', { pathway: 'game-input-to-skill.secret', ...context });
        const out = original.apply(this, args);
        record('request_result', { pathway: 'game-input-to-skill.secret', accepted: !!out, ...context });
        return out;
      });
      wrap(u, 'launchTap', function(original, args) {
        record('request', { pathway: 'unique.launchTap', technique: args[0]?.name, automatic: !!args[2] });
        const out = original.apply(this, args);
        record('request_result', { pathway: 'unique.launchTap', technique: args[0]?.name, automatic: !!args[2], accepted: !!out });
        return out;
      });
      wrap(u, 'start', function(original, args) {
        const [e, cur, part] = args;
        const id = episodeId(cur);
        record('request', { pathway: 'unique.detect-to-start', technique: e.name, episodeId: id, part, stroke: clean(cur) });
        const out = original.apply(this, args);
        record('request_result', { pathway: 'unique.detect-to-start', technique: e.name, episodeId: id, part, accepted: this.r?.e === e, stroke: clean(cur) });
        return out;
      });
      wrap(u, 'windFire', function(original, args) {
        record('request', { pathway: 'unique.windFire', technique: 'redondo', releaseReason: args[0] });
        const out = original.apply(this, args);
        record('request_result', { pathway: 'unique.windFire', technique: 'redondo', releaseReason: args[0], accepted: !!out });
        return out;
      });
      wrap(u, 'windCancel', function(original, args) {
        record('cancelled', { pathway: 'unique.windCancel', technique: 'redondo', reason: args[0] });
        return original.apply(this, args);
      });
      record('new_body', { player: body(p), enemy: body(g.enemy), kit: clean(p.skillKit), constants: { timeK: g.config.TIME.k, secretUses: clean(g.config.UNIQUE_ASSIST.secretUses), specialCooldown: g.config.UNIQUE_ASSIST.specialCooldown, specialCoolFrom: g.config.UNIQUE_ASSIST.specialCoolFrom, mordPress: g.config.SECRET.mordPress, mordCloseN: g.config.SECRET.mordCloseN, dupAuto: g.config.UNIQUE_ASSIST.dupAuto, dupStackS: g.config.UNIQUE_ASSIST.dupStackS, dupBandMin: g.config.UNIQUE_ASSIST.dupBandMin, dupBandMax: g.config.UNIQUE_ASSIST.dupBandMax, secretStaminaMin: g.config.SECRET.secretStaminaMin } });
    }
    if (hookedCombat !== g.combat) {
      hookedCombat = g.combat;
      wrap(g.combat.hooks, 'onWound', function(original, args) {
        const [att, vic, result, point] = args;
        record('body_contact_result', { attacker: att === g.player ? 'player' : 'enemy', victim: vic === g.player ? 'player' : 'enemy', techniqueAtContact: att.skill?.uniq?.r?.e?.name ?? att.skill?.tap?.uniqTech ?? (typeof att.artTech === 'string' ? att.artTech : att.artTech?.name) ?? null, result: clean(result), point: clean(point), player: body(g.player), enemy: body(g.enemy) });
        return original.apply(this, args);
      });
      wrap(g.combat.hooks, 'onClash', function(original, args) {
        const [point, speed, info] = args;
        if (info?.fresh) record('blade_contact_episode', { point: clean(point), speed, info: clean(info) });
        return original.apply(this, args);
      });
    }
  }
  function setHand(f, xy) {
    const sk = f.skill;
    f.handOffset.set(...xy);
    for (const v of [sk.prev, sk.anchor, sk.aim, sk.aimRaw]) v?.set(...xy);
    for (const v of [sk.aimVel, sk.vel, sk.follow]) v?.set(0, 0);
    if (sk.uniq) sk.uniq.restPos = xy.slice();
    f.handHeld = true;
  }
  function positionEnemy(distance) {
    const g = window.game, p = g.player, e = g.enemy;
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
    const dx = ec.x - pc.x, dz = ec.z - pc.z, d = Math.hypot(dx, dz) || 1;
    const shift = { x: pc.x + dx / d * distance - ec.x, y: 0, z: pc.z + dz / d * distance - ec.z };
    const bodies = new Set([...Object.values(e.bodies), e.sword].filter(Boolean));
    for (const b of bodies) {
      const t = b.translation(); b.setTranslation({ x: t.x + shift.x, y: t.y, z: t.z + shift.z }, true);
      b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    return shift;
  }
  function prepareFixture(options = {}) {
    const g = window.game;
    if (!g?.player || g.state !== 'fight') throw new Error('싸움 시작 뒤 준비할 수 있습니다.');
    if (mode !== 'condition') throw new Error('자연 30초에는 조건 준비를 사용하지 않습니다.');
    if (fixtureDone) throw new Error('조건 준비는 새 몸당 한 번입니다. 새 판을 여십시오.');
    const distance = options.distance ?? chosen.distance, hand = options.hand ?? chosen.hand;
    const holdOpponent = options.holdOpponent ?? !['risoluto', 'inquartata', 'gonosen', 'geoksal'].includes(chosen.id);
    const before = snapshot();
    if (holdOpponent) {
      const original = g.ai.update;
      g.ai.update = function() { g.enemy.move.set(0, 0); g.enemy.handHeld = true; };
      hookRestore.push(() => { g.ai.update = original; });
      g.enemy.move.set(0, 0);
      setHand(g.enemy, options.enemyHand ?? [0, .03]);
    }
    setHand(g.player, hand);
    const shift = positionEnemy(distance);
    fixtureDone = true;
    fixtureInfo = { kind: 'one-time-condition-fixture', distance, hand, enemyHand: options.enemyHand ?? [0, .03], holdOpponent, shift, changes: ['one-time body translation', 'starting hand pose', ...(holdOpponent ? ['opponent AI update held'] : [])], activationConditionsOverridden: false, powerOrStaminaConstantsOverridden: false, before, after: snapshot() };
    record('fixture', fixtureInfo);
    return fixtureInfo;
  }
  function begin() {
    if (session) return;
    session = { id: `${chosen.id}-${Date.now()}`, baseline: BASELINE, started: clock(), ended: null, technique: chosen, mode, actor: q.get('actor') === 'automated' ? 'automated-browser-input' : 'human', inputPath: 'DOM pointer/keyboard events via existing Input and stick/parry listeners', fixture: null, clockDefinition: mode === 'natural' ? '30 active wall seconds while fight is visible; pause/background excluded; physics and TIME.k reference recorded separately' : 'single condition practice, manual finish', rules: 'Default activation, counts, damage and stamina constants; test=1 + skillNodes=all', storagePrefix: PREFIX, storageIsolated };
    record('session_start', { metadata: session, state: snapshot() });
  }
  function finish(reason = 'manual') {
    if (!session || session.ended) return;
    terminalSnapshot = snapshot();
    record('session_end', { reason, final: terminalSnapshot });
    session.ended = clock(); session.reason = reason; session.fixture = fixtureInfo;
  }
  function report() { return { schema: 'attack-balance-browser-inputs/v1', session, baseline: BASELINE, selected: chosen, catalogCount: catalog.length, storageIsolated, fixture: fixtureInfo, events, inputs, samples, final: terminalSnapshot ?? snapshot(), limitations: ['Automated browser input is not human success rate.', 'Condition preparation success is distinct from activation and contact.', 'A request or fired counter alone is not proof of executed motion or effective wound.', 'No wound result is not a zero-power estimate; condition failures remain separate.', 'Motion sampled per animation frame may miss a very short intermediate phase.', 'Body contact hooks include armor/block outcomes that pass the minimum-energy gate; subthreshold geometric contact is not exhaustively measured.'] }; }
  function download() {
    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${session?.id ?? chosen.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const uiPointers = new Set();
  function onInput(e) {
    const target = e.target instanceof Element ? e.target : null;
    const uiTarget = !!target?.closest('#attackBalancePanel');
    if (e.type === 'pointerdown' && uiTarget) { uiPointers.add(e.pointerId); return; }
    if (e.type.startsWith('pointer') && uiPointers.has(e.pointerId)) {
      if (e.type === 'pointerup' || e.type === 'pointercancel') uiPointers.delete(e.pointerId);
      return;
    }
    const row = { type: e.type, ...clock(), trusted: e.isTrusted, target: target?.id || target?.tagName || null };
    if (e.type.startsWith('pointer')) Object.assign(row, { eventTimestampMs: e.timeStamp, pointerId: e.pointerId, pointerType: e.pointerType, x: e.clientX, y: e.clientY, movementX: e.movementX, movementY: e.movementY, buttons: e.buttons });
    else Object.assign(row, { code: e.code, repeat: e.repeat, uiTarget });
    if (session && !session.ended) inputs.push(row);
  }
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keydown', 'keyup']) window.addEventListener(t, onInput, true);
  const api = window.attackBalance = { catalog, selected: chosen, mode, snapshot, report, prepareFixture, begin, finish, download, mark: (label, data) => record('annotation', { label, ...data }), storagePrefix: PREFIX };
  function mount() {
    const el = document.createElement('details'); el.id = 'attackBalancePanel'; el.open = true;
    el.innerHTML = `<summary>유파 공격 연구 · ${mode === 'natural' ? '자연 30초' : '단발 조건 연습'}</summary><div class="ab-controls"><select aria-label="시험 기술" id="ab-tech">${catalog.map(c => `<option value="${c.id}" ${c === chosen ? 'selected' : ''}>${c.kind} · ${c.label}</option>`).join('')}</select><select aria-label="시험 방식" id="ab-mode"><option value="condition" ${mode === 'condition' ? 'selected' : ''}>단발 조건 연습</option><option value="natural" ${mode === 'natural' ? 'selected' : ''}>자연 30초</option></select><button id="ab-new">새 판 열기</button><button id="ab-prepare">조건 준비</button><button id="ab-record">기록 시작</button><button id="ab-finish">기록 끝</button><button id="ab-download">JSON 받기</button></div><p id="ab-state">게임을 불러오고 있습니다.</p><p id="ab-progress"></p><p id="ab-condition"></p><p>${chosen.instruction}</p><p class="ab-note">조건 연습: 거리·시작 칼손·정지 상대를 1회 준비합니다. 반응형 기술은 상대가 움직입니다. 발동 규칙·횟수·위력·기력은 기본값. 자연 30초는 조건 준비 없이 합니다. 폰: 끌기·톡 / 왼쪽 스틱 / 막기. PC: 마우스 / WASD / F. 저장은 연구 전용입니다.</p>`;
    const style = document.createElement('style'); style.textContent = '#attackBalancePanel{position:fixed;z-index:80;top:6px;left:6px;width:min(510px,55vw);max-height:55vh;overflow:auto;padding:7px 9px;background:#211c17ed;border:1px solid #a48b5e;color:#eee4cc;font:12px/1.4 sans-serif;border-radius:5px}#attackBalancePanel summary{cursor:pointer;color:#efd390}#attackBalancePanel p{margin:5px 0}#attackBalancePanel .ab-controls{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}#attackBalancePanel button,#attackBalancePanel select{font:12px sans-serif;padding:4px;background:#3a3026;color:#fff0d6;border:1px solid #8b7652;border-radius:3px}#attackBalancePanel .ab-note{font-size:11px;color:#c3b79d}#ab-state{color:#bfe1b5}';
    document.head.append(style); document.body.append(el);
    document.querySelector('#ab-new').onclick = () => {
      const c = catalog.find(x => x.id === document.querySelector('#ab-tech').value), nq = new URLSearchParams(location.search);
      nq.set('technique', c.id); nq.set('weapon', c.weapon); nq.set('trial', document.querySelector('#ab-mode').value);
      location.href = `${location.pathname}?${nq}`;
    };
    document.querySelector('#ab-prepare').onclick = () => { try { begin(); prepareFixture(); } catch (e) { document.querySelector('#ab-state').textContent = e.message; } };
    document.querySelector('#ab-record').onclick = begin;
    document.querySelector('#ab-finish').onclick = () => finish();
    document.querySelector('#ab-download').onclick = download;
    document.querySelector('#ab-prepare').disabled = mode !== 'condition';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  function tick(now) {
    const g = window.game, dt = (now - prevNow) / 1000; prevNow = now;
    if (g?.player) {
      hook(g);
      if (session && !session.ended && g.state === 'fight' && document.visibilityState === 'visible' && !document.documentElement.hasAttribute('data-start-open')) activeWall += dt;
      const p = g.player, u = g.playerUnique, s = g.playerSecret;
      const state = { state: g.state, open: !!s?.open, opened: s?.opened, phase: p.skill.sec?.stage ?? null, bursts: p.skill.secretBursts, fired: JSON.stringify(u?.stats?.fired ?? {}), cue: p.uniqueCue, alive: p.alive, enemyAlive: g.enemy.alive };
      if (previous) {
        if (state.open && !previous.open) record('condition_window', { technique: s.S?.name, context: clean(s.open?.ctx) });
        if (state.phase !== previous.phase) record('secret_motion_phase', { phase: state.phase });
        if (state.bursts !== previous.bursts) record('secret_burst', { technique: s?.S?.name, count: state.bursts, delta: state.bursts - previous.bursts });
        if (state.fired !== previous.fired) record('unique_counter_change', { counts: clean(u.stats.fired) });
        if (state.cue !== previous.cue && state.cue) record('technique_display', { cue: clean(state.cue) });
      }
      for (const [name, ref] of Object.entries({ secret: p.skill.sec, iai: p.iai, iaiRequest: p.iaiReq, unique: u?.r, tap: p.skill.tap })) {
        if (ref && ref !== motionRefs[name]) record(name === 'iaiRequest' ? 'motion_request_queued' : 'motion_start', { channel: name, episodeId: episodeId(name === 'unique' ? u.cur : ref), technique: ref.tech ?? ref.name ?? ref.uniqTech ?? ref.e?.name ?? (name === 'secret' ? s?.S?.name : null) ?? null, stage: ref.stage ?? null });
        if (!ref && motionRefs[name]) record(name === 'iaiRequest' ? 'motion_request_cleared' : 'motion_end', { channel: name });
        motionRefs[name] = ref;
      }
      previous = state;
      if (session && !session.ended && now - sampleAt >= 100) { sampleAt = now; samples.push(snapshot()); }
      if (session && !session.ended && (!p.alive || !g.enemy.alive)) finish(!p.alive ? 'player_dead' : 'enemy_dead');
      if (session && !session.ended && mode === 'natural' && activeWall - session.started.activeWallS >= 30) finish('active_wall_30s');
      const progress = document.querySelector('#ab-progress'), condition = document.querySelector('#ab-condition');
      if (condition) condition.textContent = '조건 · ' + conditionText(g);
      if (progress) {
        const observed = session ? events.filter(e => e.wallMs >= session.started.wallMs) : [];
        const targetName = chosen.kind === '비기' ? s?.S?.name : chosen.id;
        const attempts = inputs.filter(e => e.type === 'pointerdown' || e.type === 'keydown' && !e.repeat && !e.uiTarget).length;
        const requests = observed.filter(e => e.type === 'request' && e.technique === targetName).length;
        const ran = observed.some(e => e.type === 'motion_start' && e.technique === targetName && ['secret', 'iai', 'unique'].includes(e.channel));
        progress.textContent = `입력 시도(누름) ${attempts} · 요청 ${requests} · 실행 확인 ${ran ? '있음' : '대기'} · 양측 접촉 결과 ${observed.filter(e => e.type === 'body_contact_result').length}`;
      }
      const status = document.querySelector('#ab-state');
      if (status) status.textContent = `${g.state} · ${p.swordArt.tradition} · 거리 ${p.foeDistance().toFixed(2)} m · 비기 ${s?.open ? '창 열림' : s?.left ?? '없음'} · 기록 ${session ? session.ended ? '끝' : `${(activeWall - session.started.activeWallS).toFixed(1)}초` : '대기'} · 입력 ${inputs.length} · 사건 ${events.length}${fixtureDone ? ' · 조건 준비됨' : ''}`;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
