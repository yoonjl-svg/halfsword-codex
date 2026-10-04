// Real Input/joystick handlers in a small DOM event fixture; no game/physics run.
import assert from 'node:assert/strict';

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  emit(type, details = {}) {
    const event = { type, timeStamp: 1000, pointerType: 'touch', button: 0,
      pointerId: 1, clientX: 50, clientY: 50, stopPropagation() {}, ...details };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }
}
class Element extends Events {
  constructor() { super(); this.style = { transform: '' }; this.captures = new Set(); }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.emit('lostpointercapture', { pointerId: id });
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
}

const windowEvents = new Events();
Object.assign(windowEvents, { location: { search: '' }, innerHeight: 390 });
globalThis.window = windowEvents;
globalThis.document = { pointerLockElement: null };
globalThis.matchMedia = () => ({ matches: true });
const { Input, attachStick } = await import('../../src/input.js');
const { INPUT } = await import('../../src/config.js');
const canvas = new Element(), pad = new Element(), knob = new Element();
const input = new Input(canvas);
const trail = { touch: [], pad: [], addTouch(x, y, t) { this.touch.push({ x, y, t }); },
  lift() { this.touch.push(null); }, clear() { this.touch.length = 0; this.pad.length = 0; } };
input.trail = trail;
attachStick(input, pad, knob);
const rows = [];
const check = (name, fn) => { fn(); rows.push({ name, pass: true }); };
function clean() {
  assert.deepEqual(input.consumeHandDelta(), { x: 0, y: 0 });
  assert.equal(input.consumeTaps(), 0);
  assert.equal(input.press, null); assert.equal(input.activeTouch, null);
  assert.equal(input.keys.size, 0); assert.deepEqual(input.stickMove, { x: 0, y: 0 });
  assert.equal(knob.style.transform, ''); assert.equal(pad.captures.size, 0);
  assert.deepEqual(trail.touch, []); assert.deepEqual(trail.pad, []);
}
const start = (id = 1, t = 1000) => canvas.emit('pointerdown', { pointerId: id, timeStamp: t });
const move = (id = 1) => windowEvents.emit('pointermove', { pointerId: id, clientX: 80, clientY: 30, timeStamp: 1040 });
const up = (id = 1, t = 1080) => windowEvents.emit('pointerup', { pointerId: id, timeStamp: t });

check('disabled hand, keyboard and joystick cannot queue input', () => {
  start(); move(); up(); windowEvents.emit('keydown', { code: 'KeyW' });
  pad.emit('pointerdown', { pointerId: 9, clientX: 90 });
  pad.emit('pointermove', { pointerId: 9, clientX: 10 });
  assert.deepEqual(input.move, { x: 0, y: 0 }); clean();
});
input.enabled = true;
check('ordinary drag retains touch mapping and never becomes a tap', () => {
  start(); move();
  assert.deepEqual(input.consumeHandDelta(), {
    x: 30 * (INPUT.touchSensitivity / 390),
    y: 20 * (INPUT.touchSensitivity / 390) * 1.35,
  });
  up(); assert.equal(input.consumeTaps(), 0); assert.equal(input.activeTouch, null);
});
input.resetTransient();
check('normal short tap survives the following implicit lost capture', () => {
  start(); up(); canvas.emit('lostpointercapture');
  assert.equal(input.consumeTaps(), 1); assert.equal(input.press, null);
});
input.resetTransient();
check('blur aborts queued tap, held drag, keys and captured joystick together', () => {
  start(); up(); start(2, 1100); move(2);
  windowEvents.emit('keydown', { code: 'KeyW' });
  pad.emit('pointerdown', { pointerId: 9, clientX: 90 });
  assert.equal(pad.captures.size, 1); assert.ok(input.stickMove.x > 0 && input.handDX > 0);
  windowEvents.emit('blur'); clean();
  up(2, 1140); pad.emit('pointermove', { pointerId: 9, clientX: 10 });
  clean();
  start(3); move(3); assert.equal(input.activeTouch, 3); assert.ok(input.consumeHandDelta().x > 0);
});
input.resetTransient();
check('pointercancel aborts the current gesture without a delayed tap', () => {
  start(); move(); windowEvents.emit('pointercancel'); clean(); up(); clean();
});
check('canvas lost capture releases a held gesture and allows a new pointer', () => {
  start(4); move(4); canvas.emit('lostpointercapture', { pointerId: 4 }); clean();
  start(5); assert.equal(input.activeTouch, 5); up(5); assert.equal(input.consumeTaps(), 1);
});
input.resetTransient();
check('canceling another finger does not erase the active hand gesture', () => {
  start(6); move(6); windowEvents.emit('pointercancel', { pointerId: 99 });
  assert.equal(input.activeTouch, 6); assert.ok(input.consumeHandDelta().x > 0);
});
input.resetTransient();
check('joystick lost capture clears local id and knob before a fresh finger', () => {
  pad.emit('pointerdown', { pointerId: 9, clientX: 90 });
  pad.releasePointerCapture(9); clean();
  pad.emit('pointerdown', { pointerId: 10, clientX: 10 }); assert.ok(input.stickMove.x < 0);
  pad.emit('pointerup', { pointerId: 10 }); clean();
});
check('explicit pause/new-round reset discards pending requests and capture', () => {
  start(); up(); start(7, 1200); move(7);
  pad.emit('pointerdown', { pointerId: 11, clientX: 90 });
  input.resetTransient(); clean(); up(7, 1260); clean();
});
check('disabling a held pad blocks updates and releases its local state', () => {
  pad.emit('pointerdown', { pointerId: 12, clientX: 90 });
  input.enabled = false; pad.emit('pointermove', { pointerId: 12, clientX: 10 });
  assert.deepEqual(input.move, { x: 0, y: 0 }); clean(); input.enabled = true;
});
check('reset preserves gain, tilt preference/calibration and configuration', () => {
  input.useTilt = true; input.invertTilt = true; input.tiltActive = true;
  input.tiltBaseline = { roll: 11, pitch: -7 }; input.tiltMove = { x: .2, y: -.1 };
  const gain = { ...input.mobileIntent };
  input.resetTransient(); clean();
  assert.deepEqual(input.mobileIntent, gain); assert.equal(input.mobileIntent.verticalGain, 1.35);
  assert.equal(input.useTilt, true); assert.equal(input.invertTilt, true);
  assert.deepEqual(input.tiltBaseline, { roll: 11, pitch: -7 });
  assert.deepEqual(input.move, { x: .2, y: -.1 });
  input.enabled = false; assert.deepEqual(input.move, { x: 0, y: 0 });
});
check('sanitized optional query isolates an invalid integrated entry from raw URL gain', () => {
  windowEvents.location.search = '?combatTrial=integrated&mobileVerticalGain=1.8';
  const filtered = new Input(new Element(), new URLSearchParams());
  assert.deepEqual(filtered.mobileIntent, { verticalGain: 1.35, source: 'default' });
  const ordinary = new Input(new Element());
  assert.deepEqual(ordinary.mobileIntent, { verticalGain: 1.8, source: 'url' });
  const explicit = new Input(new Element(), new URLSearchParams('mobileVerticalGain=1'));
  assert.deepEqual(explicit.mobileIntent, { verticalGain: 1, source: 'url' });
  windowEvents.location.search = '';
});
console.log(JSON.stringify({ pass: true, checks: rows.length, rows,
  scope: 'Actual Input/attachStick event handlers in a DOM fixture. No browser, physics, sensor-permission or saved-storage behavior is claimed.',
  physicsExecutions: 0, networkRequests: 0 }));
