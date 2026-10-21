// Optional, input-owned short step. The existing gait supplies all foot physics.
import {BodyOpposition} from './italian_body_research.js';

export const COUNTER_STEP = Object.freeze({
  distance: .20, duration: .28, minForward: .20, minGap: 1.05, queueWindow: .28,
});

export class StepOpposition extends BodyOpposition {
  constructor(f, foe, guard, variant = 'strongBind', body = true, step = true) {
    super(f, foe, guard, variant, body);
    this.stepEnabled = step;
    this.stepRequest = null;
  }

  forwardInput() {
    return (this.f.stickY ?? 0) > COUNTER_STEP.minForward && this.f.move.y > .1;
  }

  onClash(...args) {
    const serial = this.serial;
    super.onClash(...args);
    if (!this.run || serial === this.serial || !this.stepEnabled) return;
    const f = this.f, gait = f.gait;
    if (!this.forwardInput() || f.state !== 'stand' || f.feetHeld
      || !gait?.active || gait.req || gait.drawPending || f.foeDistance() < COUNTER_STEP.minGap) return;
    if (!gait.requestStep({kind: 'lunge', fwd: COUNTER_STEP.distance, duration: COUNTER_STEP.duration})) return;
    this.stepRequest = {ref: gait.req, serial: this.run.serial, at: this.guard.clock, started: false};
    this.events.push({type: 'stepQueued', t: this.guard.clock, serial: this.run.serial,
      input: f.stickY, gap: f.foeDistance(), distance: COUNTER_STEP.distance});
  }

  stopStep(reason) {
    const own = this.stepRequest;
    if (!own) return;
    const gait = this.f.gait;
    if (gait.req === own.ref) {
      const leg = Object.values(gait.legs).find(l => !l.stance && l.kind === 'req');
      const swinging = !!leg;
      if (leg) this.recordStart(own, leg);
      // Never snap a raised foot back. Keep its landing target, remove the
      // extra forward speed. Pending requests can be removed outright.
      if (swinging) gait.req.push = 0;
      else gait.req = null;
      this.events.push({type: swinging ? 'stepAssistStopped' : 'stepCancelled',
        t: this.guard.clock, serial: own.serial, reason});
    }
    this.stepRequest = null;
  }

  recordStart(own, leg) {
    if (own.started) return;
    own.started = true;
    this.events.push({type: 'stepStarted', t: this.guard.clock, serial: own.serial,
      leg: leg.k, footStart: leg.p0.toArray(), footTarget: leg.p1.toArray()});
  }

  syncStep() {
    const own = this.stepRequest;
    if (!own) return;
    const gait = this.f.gait;
    if (gait.req !== own.ref) {
      this.events.push({type: own.started ? 'stepFinished' : 'stepSuperseded',
        t: this.guard.clock, serial: own.serial});
      this.stepRequest = null;
      return;
    }
    const leg = Object.values(gait.legs).find(l => !l.stance && l.kind === 'req');
    if (leg) this.recordStart(own, leg);
    if (!this.run || !this.eligible() || !this.forwardInput()) this.stopStep('input-or-state');
    else if (!own.started && this.guard.clock - own.at > COUNTER_STEP.queueWindow)
      this.stopStep('queue-expired');
  }

  beginGuardStep() { super.beginGuardStep(); this.syncStep(); }
  update(dt) { this.syncStep(); super.update(dt); }
  cancel(reason) { this.stopStep(reason); super.cancel(reason); }
}

export function installStep(f, foe, guard, variant = 'strongBind', body = true, step = true) {
  const mod = new StepOpposition(f, foe, guard, variant, body, step);
  guard.opposition = mod;
  return mod;
}
