/** Reproduce the 69 cm / 2.2 kg reconstruction from material volumes.
 * node tools/sim/morgenstern_design.mjs --check
 * node tools/sim/morgenstern_design.mjs --out=/tmp/morgenstern-design.json
 * --write-source deliberately refreshes the frozen runtime constants.
 * SI units throughout. These are design assumptions, not an artifact measurement.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const STEEL = 7800, WOOD = 635.3456684691199;
const HEAD_R = .04, SPIKE_R = .007, SPIKE_L = .025;
const HEAD_Y = .5235, SHAFT_BOTTOM = -.099, SHAFT_TOP = HEAD_Y + .03;
const SHAFT_R0 = .016, TOTAL = 2.2, COLLAR_Y = .4815, COLLAR_H = .03;
const BUTT_MASS = .025, COLLAR_MASS = .1, SLEEVE_R = .022;

// Polynomial antiderivatives make all volume / moment integrations exact to
// floating point precision. No sampling density or artificial COM offsets.
const add = (a, b, sign = 1) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + sign * (b[i] || 0));
const mul = (a, b) => {
  const c = Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) c[i + j] += a[i] * b[j];
  return c;
};
const integral = (a, lo, hi) => a.reduce((s, v, i) => s + v * (hi ** (i + 1) - lo ** (i + 1)) / (i + 1), 0);
function revolution(outer2, inner2, lo, hi, density) {
  const area = add(outer2, inner2, -1), radial = add(mul(outer2, outer2), mul(inner2, inner2), -1);
  const mass = density * Math.PI * integral(area, lo, hi);
  const first = density * Math.PI * integral([0, ...area], lo, hi);
  const IeOrigin = density * Math.PI * (integral([0, 0, ...area], lo, hi) + integral(radial, lo, hi) / 4);
  const It = density * Math.PI * integral(radial, lo, hi) / 2;
  const comY = first / mass;
  return { mass, comY, Ie: IeOrigin - mass * comY ** 2, It, volume: mass / density };
}
function aggregate(parts) {
  const list = Object.values(parts), mass = list.reduce((s, p) => s + p.mass, 0);
  const comY = list.reduce((s, p) => s + p.mass * (p.y + p.comY), 0) / mass;
  const handInertia = list.reduce((s, p) => s + p.Ie + p.mass * (p.y + p.comY) ** 2, 0);
  return { mass, comY, Ie: handInertia - mass * comY ** 2, It: list.reduce((s, p) => s + p.It, 0), handInertia };
}
function head(socketRadius, socketTop) {
  const sphereMass = STEEL * 4 * Math.PI * HEAD_R ** 3 / 3;
  const sphereI = .4 * sphereMass * HEAD_R ** 2;
  const transition = Math.sqrt(HEAD_R ** 2 - socketRadius ** 2);
  const boundaries = [-HEAD_R, -transition, transition, socketTop].filter(y => y >= -HEAD_R && y <= socketTop).sort((a, b) => a - b);
  let mass = sphereMass, first = 0, IeOrigin = sphereI, It = sphereI, holeVolume = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const lo = boundaries[i - 1], hi = boundaries[i], middle = (lo + hi) / 2;
    const radius2 = HEAD_R ** 2 - middle ** 2 < socketRadius ** 2 ? [HEAD_R ** 2, 0, -1] : [socketRadius ** 2];
    const removed = revolution(radius2, [0], lo, hi, STEEL);
    mass -= removed.mass; first -= removed.mass * removed.comY;
    IeOrigin -= removed.Ie + removed.mass * removed.comY ** 2; It -= removed.It;
    holeVolume += removed.volume;
  }
  const coreMass = mass;
  const directions = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) directions.push([x, y, z].map(v => v / Math.sqrt(3)));
  const coneMass = STEEL * Math.PI * SPIKE_R ** 2 * SPIKE_L / 3;
  const coneAxial = .3 * coneMass * SPIKE_R ** 2;
  const coneTransverse = coneMass * (3 * SPIKE_R ** 2 / 20 + 3 * SPIKE_L ** 2 / 80);
  const offset = HEAD_R + SPIKE_L / 4;
  for (const [x, y] of directions) {
    mass += coneMass; first += coneMass * offset * y;
    IeOrigin += coneTransverse + (coneAxial - coneTransverse) * x ** 2 + coneMass * offset ** 2 * (1 - x ** 2);
    It += coneTransverse + (coneAxial - coneTransverse) * y ** 2 + coneMass * offset ** 2 * (1 - y ** 2);
  }
  const comY = first / mass;
  return { shape: ['ball', .053], y: HEAD_Y, mass, comY, Ie: IeOrigin - mass * comY ** 2, It, coreMass, spikesMass: 13 * coneMass, holeVolume, socketRadius, socketTop };
}
function woodFrustum(bottom, top, r0, r1, density) {
  const length = top - bottom, y = (top + bottom) / 2;
  const radius = [(r0 + r1) / 2, (r1 - r0) / length];
  return { shape: ['box', Math.max(r0, r1), length / 2, Math.max(r0, r1)], y,
    ...revolution(mul(radius, radius), [0], -length / 2, length / 2, density),
    bottom, top, bottomRadius: r0, topRadius: r1, density };
}
function butt() {
  // Preserve the previous 25 g cap and its box mass approximation.
  return { shape: ['box', .0175, .0015, .0175], y: -.1, mass: BUTT_MASS, comY: 0,
    Ie: BUTT_MASS * (.035 ** 2 + .003 ** 2) / 12, It: BUTT_MASS * 2 * .035 ** 2 / 12 };
}
function lengthOnly() {
  const previousHead = head(.017, .035), shaftMass = TOTAL - previousHead.mass - BUTT_MASS - COLLAR_MASS;
  const shaft = woodFrustum(SHAFT_BOTTOM, HEAD_Y + .035, .016, .017, 1);
  const density = shaftMass / shaft.volume;
  const parts = { shaft: woodFrustum(SHAFT_BOTTOM, HEAD_Y + .035, .016, .017, density), butt: butt(),
    collar: { shape: ['box', .02, .015, .02], y: COLLAR_Y, mass: COLLAR_MASS, comY: 0,
      Ie: COLLAR_MASS * (.04 ** 2 + .03 ** 2) / 12, It: COLLAR_MASS * 2 * .04 ** 2 / 12 }, head: previousHead };
  return { description: 'Shorten the previous construction by 26.5 mm while preserving every part mass; no redistribution.', parts, aggregate: aggregate(parts) };
}
function candidate(socketRadius) {
  const shaft = woodFrustum(SHAFT_BOTTOM, SHAFT_TOP, SHAFT_R0, socketRadius, WOOD);
  const slope = (socketRadius - SHAFT_R0) / (SHAFT_TOP - SHAFT_BOTTOM);
  const radiusAt = y => SHAFT_R0 + slope * (y - SHAFT_BOTTOM);
  const ring = (bottom, top, outerRadius) => {
    const y = (bottom + top) / 2, height = top - bottom, inner = [radiusAt(y), slope];
    return { shape: ['box', outerRadius, height / 2, outerRadius], y,
      ...revolution([outerRadius ** 2], mul(inner, inner), -height / 2, height / 2, STEEL),
      bottom, top, outerRadius, innerBottomRadius: radiusAt(bottom), innerTopRadius: radiusAt(top), density: STEEL };
  };
  const collarBottom = COLLAR_Y - COLLAR_H / 2, collarTop = COLLAR_Y + COLLAR_H / 2;
  const collarInner = [radiusAt(COLLAR_Y), slope];
  const innerVolume = Math.PI * integral(mul(collarInner, collarInner), -COLLAR_H / 2, COLLAR_H / 2);
  const collarRadius = Math.sqrt((COLLAR_MASS / STEEL + innerVolume) / (Math.PI * COLLAR_H));
  const collar = ring(collarBottom, collarTop, collarRadius), headPart = head(socketRadius, .03), cap = butt();
  const sleeveMass = TOTAL - shaft.mass - collar.mass - headPart.mass - cap.mass;
  let lo = .000001, hi = .12;
  assert(sleeveMass > 0 && ring(SHAFT_BOTTOM, SHAFT_BOTTOM + hi, SLEEVE_R).mass > sleeveMass, 'Sleeve solve bracket');
  for (let i = 0; i < 70; i++) {
    const h = (lo + hi) / 2;
    if (ring(SHAFT_BOTTOM, SHAFT_BOTTOM + h, SLEEVE_R).mass < sleeveMass) lo = h; else hi = h;
  }
  const sleeve = ring(SHAFT_BOTTOM, SHAFT_BOTTOM + (lo + hi) / 2, SLEEVE_R);
  const parts = { shaft, butt: cap, collar, head: headPart, sleeve };
  return { parts, aggregate: aggregate(parts) };
}
export function calculateDesign() {
  const baseline = lengthOnly(), target = .9 * baseline.aggregate.comY;
  const originalHead = baseline.parts.head;
  assert(Math.abs(originalHead.mass - 1.7031936098226728) < 1e-12, 'Original head mass');
  assert(Math.abs(originalHead.Ie - .0012493731312126577) < 1e-12, 'Original head transverse inertia');
  assert(Math.abs(originalHead.It - .0014672536672301738) < 1e-12, 'Original head axial inertia');
  let lo = .02, hi = .023;
  assert(candidate(lo).aggregate.comY > target && candidate(hi).aggregate.comY < target, 'COM solve bracket');
  for (let i = 0; i < 70; i++) {
    const radius = (lo + hi) / 2;
    if (candidate(radius).aggregate.comY > target) lo = radius; else hi = radius;
  }
  const solved = candidate((lo + hi) / 2), socketRadius = solved.parts.head.socketRadius;
  assert(Math.abs(solved.aggregate.mass - TOTAL) < 1e-12);
  assert(Math.abs(solved.aggregate.comY - target) < 1e-12);
  assert(socketRadius < Math.sqrt(HEAD_R ** 2 - .03 ** 2), 'Top cap remains connected to surrounding steel');
  assert(solved.parts.sleeve.innerTopRadius < SLEEVE_R, 'Positive sleeve wall');
  return { units: 'metres, kilograms, kg*m^2',
    construction: 'Author reconstruction: 8 cm steel sphere, 70 mm blind socket, 10 mm top cap, 13 outward 25 mm conical spikes; wood frustum and steel grip sleeve.',
    limitations: 'The collar/head join and inherited cap/shaft overlap are geometric assembly approximations. Box shaft/ring colliders and the spherical spike envelope do not resolve surface detail; cap retains previous box inertia. This is not a structural-strength or historical-artifact validation.',
    geometry: { overallLength: .69, bottom: -.1015, tip: HEAD_Y + HEAD_R + SPIKE_L,
      headCenter: HEAD_Y, headRadius: HEAD_R, spikeLength: SPIKE_L, spikeRadius: SPIKE_R,
      socketRadius, socketBottom: -.04, socketTop: .03, socketDepth: .07, topCap: .01,
      shaftBottom: SHAFT_BOTTOM, shaftTop: SHAFT_TOP, shaftLength: SHAFT_TOP - SHAFT_BOTTOM,
      steelDensity: STEEL, woodDensity: WOOD, sleeveOuterRadius: SLEEVE_R },
    lengthOnly: baseline, targetComY: target, comRatio: solved.aggregate.comY / baseline.aggregate.comY, ...solved };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const design = calculateDesign(), json = JSON.stringify(design, null, 2) + '\n';
  const source = new URL('../../src/morgenstern_design.js', import.meta.url);
  if (process.argv.includes('--write-source')) {
    fs.writeFileSync(source, '// Generated by tools/sim/morgenstern_design.mjs --write-source.\n// Physical dimensions and mass properties for the 69 cm user-requested reconstruction.\nconst freeze = value => {\n  if (value && typeof value === \'object\') { Object.values(value).forEach(freeze); Object.freeze(value); }\n  return value;\n};\nexport const MORGENSTERN_DESIGN = freeze(' + json.trimEnd() + ');\n');
  }
  if (process.argv.includes('--check')) {
    const { MORGENSTERN_DESIGN } = await import(source);
    assert.deepEqual(MORGENSTERN_DESIGN, design, 'Runtime constants reproduce from construction');
    assert(Object.isFrozen(MORGENSTERN_DESIGN.parts.head));
    console.log('PASS: material integration, original-head regression, 2.2 kg, 69 cm, connected cap, COM ratio 0.9, frozen source exact.');
  }
  const output = process.argv.find(arg => arg.startsWith('--out='))?.slice(6);
  if (output) { assert(!fs.existsSync(output), 'Use a fresh report path'); fs.writeFileSync(output, json); }
  if (!output && !process.argv.includes('--check') && !process.argv.includes('--write-source')) process.stdout.write(json);
}
