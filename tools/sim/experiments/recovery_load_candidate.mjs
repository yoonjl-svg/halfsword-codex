// Research-only source transformation. Never imported by the public game.
export const recoveryLoadWarnings = Object.freeze([
  'Raw projected contact impulse/dt is the preceding native solver load, not a prediction of future support capacity.',
  'Preload changes the requested horizontal motion through the existing controller; it adds no direct body transform or new force application.',
  'A load deferral can stall recovery when the other foot cannot acquire support. Neither variant establishes recovery acceptance.',
]);

function replaceOnce(source, marker, replacement) {
  if (source.split(marker).length !== 2) throw new Error('Expected exactly one Gait marker: ' + marker.slice(0, 100));
  return source.replace(marker, replacement);
}

export function transformRecoveryLoadGait(source, { preload = false, selectByLoad = true,
  contactModuleUrl = new URL('../../../src/support_contacts.js', import.meta.url).href } = {}) {
  if (typeof source !== 'string' || typeof preload !== 'boolean' || typeof selectByLoad !== 'boolean') throw new TypeError('Provide Gait source and a boolean preload option');
  if (new URL(contactModuleUrl).protocol !== 'file:') throw new TypeError('Contact module must be an authorized local file URL');
  if (/\brecoveryLoadProbe\b|\bcollectRecoverySupportContacts\b/.test(source)) throw new Error('Source was already transformed or contains conflicting recovery names');

  const setup = `    else this.sense();
    const recoveryLow = this.levH > 0;
    let recoveryFeet = null;
    if (recoveryLow) {
      const contacts = collectRecoverySupportContacts(f, {detail: false});
      recoveryFeet = Object.fromEntries(['F', 'B'].map(k => {
        const group = contacts.groups['foot' + k];
        const supported = group.contacts.filter(c => c.hasSupport);
        const verticalN = supported.reduce((sum, c) => sum + c.rawNormalImpulseNs * Math.max(0, c.normalAlignmentWithUp), 0) / (f.lastDt || dt);
        let point = this.legs[k].ankle;
        const measured = supported.filter(c => c.representativeSolverPoint && c.rawNormalImpulseNs > 0);
        const weight = measured.reduce((sum, c) => sum + c.rawNormalImpulseNs * Math.max(0, c.normalAlignmentWithUp), 0);
        if (weight > 0) point = {
          x: measured.reduce((sum, c) => sum + c.representativeSolverPoint.x * c.rawNormalImpulseNs * Math.max(0, c.normalAlignmentWithUp), 0) / weight,
          z: measured.reduce((sum, c) => sum + c.representativeSolverPoint.z * c.rawNormalImpulseNs * Math.max(0, c.normalAlignmentWithUp), 0) / weight,
        };
        return [k, {hasSupport: group.hasSupport, verticalN, point: {x: point.x, z: point.z}}];
      }));
      this.recoveryLoadProbe ??= {updateCount: 0, eligibleCount: 0, deferredCount: 0, preloadCount: 0, last: null};
      this.recoveryLoadProbe.updateCount++;
    }`;
  source = replaceOnce(source, '    else this.sense();', setup);

  const air = 'const air = l.soleY > GAIT.airFoot && (this.levH > 0 || (l.toeY > GAIT.airFoot * 0.75 && (l.N || 0) < 0.05 * this.Mg));';
  source = replaceOnce(source, air, air.slice(0, -1) + ' && (!recoveryLow || !recoveryFeet[k].hasSupport);');
  const eligibility = '        if (hx * hx + hz * hz > GAIT.reachMax * GAIT.reachMax || air) next = next || k;';
  source = replaceOnce(source, eligibility, `        if (hx * hx + hz * hz > GAIT.reachMax * GAIT.reachMax || air) {
          if (!recoveryLow || ${!selectByLoad}) next = next || k;
          else {
            this.recoveryLoadProbe.eligibleCount++;
            const foot = recoveryFeet[k], previous = next ? recoveryFeet[next] : null;
            if (!previous || (!foot.hasSupport && previous.hasSupport)
              || (foot.hasSupport === previous.hasSupport && foot.verticalN < previous.verticalN)) next = k;
          }
        }`);

  const preloadCode = preload ? `
          if (other.hasSupport && f.com) {
            let vx = (other.point.x - f.com.x) * GAIT.holdGain;
            let vz = (other.point.z - f.com.z) * GAIT.holdGain;
            const speed = Math.hypot(vx, vz);
            if (speed > 0.3) { vx *= 0.3 / speed; vz *= 0.3 / speed; }
            want.x += vx; want.z += vz;
            this.recoveryLoadProbe.preloadCount++;
            this.recoveryLoadProbe.last.preloadCorrectionMps = {x: vx, z: vz};
          }` : '';
  const gateMarker = "      if (next && kind === 'walk' && GAIT.liftLoad > 0 && vLat < 0.6 * speed && this.sinceTD < Tds + GAIT.liftWait) {";
  source = replaceOnce(source, gateMarker, `      if (recoveryLow && next && kind === 'catch') {
        const selected = next, otherKey = next === 'F' ? 'B' : 'F';
        const foot = recoveryFeet[selected], other = recoveryFeet[otherKey];
        const need = GAIT.liftLoad * this.Mg;
        const defer = foot.verticalN > GAIT.liftOwn * need && (!other.hasSupport || other.verticalN < need);
        this.recoveryLoadProbe.last = {selected, other: otherKey, needN: need,
          selectedSupport: foot.hasSupport, selectedVerticalN: foot.verticalN,
          otherSupport: other.hasSupport, otherVerticalN: other.verticalN,
          otherPoint: {...other.point}, deferred: defer};
        if (defer) {
          this.recoveryLoadProbe.deferredCount++;${preloadCode}
          next = null;
        }
      }
${gateMarker}`);
  return 'import {collectSupportContacts as collectRecoverySupportContacts} from ' + JSON.stringify(String(contactModuleUrl)) + ';\n' + source;
}
