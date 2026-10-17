// Causal research reader. No attack names, future samples or AI phase/input.
export class StrokeReader {
  constructor({ start = 4.5, history = .1, grace = .25, cap = .65, scope = 'all', prepare = false } = {}) {
    Object.assign(this, { start, history, grace, cap, scope, prepare });
    this.t = 0;
    this.stroke = null;
    this.fast = false;
    this.ready = false;
  }
  update(sense, d, reach, dt) {
    this.t += dt;
    const s = sense.seen(0), speed = Math.hypot(s.hvx, s.hvy);
    const fast = speed >= this.start;
    const ready = this.prepare && s.hy > .35 && Math.abs(s.hx) < .10 && s.hvy >= 0 && speed < 2.5 && s.tvy > 1 && d < reach + .9;
    if (ready && !this.ready && !this.stroke) this.stroke = { line: 'highC', start: this.t, moving: this.t };
    this.ready = ready;
    if (fast && !this.fast && d < reach + .9) {
      const p = sense.seen(this.history);
      const line = p.hy > .15 ? (p.hx > .15 ? 'highL' : p.hx < -.15 ? 'highR' : 'highC') : p.hy < -.2 ? (p.hx >= 0 ? 'lowL' : 'lowR') : null;
      if (line && (this.scope !== 'center' || line === 'highC')) this.stroke = { line, start: this.t, moving: this.t };
    }
    this.fast = fast;
    if (this.stroke) {
      if (speed > 2.5) this.stroke.moving = this.t;
      if (this.t - this.stroke.moving > this.grace || this.t - this.stroke.start > this.cap || d > reach + .9) this.stroke = null;
    }
    return this.stroke?.line ?? null;
  }
}
