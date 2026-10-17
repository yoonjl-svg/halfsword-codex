import { readFileSync, writeFileSync } from 'node:fs';
import { StrokeReader } from './parry_reading_model.mjs';
import { gunzipSync } from 'node:zlib';
const raw = readFileSync(process.argv[2]);
const rows = JSON.parse((process.argv[2].endsWith('.gz') ? gunzipSync(raw) : raw).toString());
const output = [];
for (const grace of [.15, .25, .35]) {
  const details = [];
  for (const r of rows) {
    const model = new StrokeReader({ grace });
    const lines = [];
    const start = r.phases.find(p => p.ph === 3)?.t ?? Infinity;
    const contact = r.touches.find(x => x.t >= start && (r.instrumentation !== 2 || x.fresh) && Math.hypot(x.velocity.x, x.velocity.y, x.velocity.z) >= 2.5);
    let i = 0;
    for (i = 0; i < r.frames.length; i++) {
      const f = r.frames[i];
      const sense = { seen: lag => r.frames[Math.max(0, i - Math.round(lag * 120))].s };
      lines.push(model.update(sense, f.d, f.reach, 1 / 120));
    }
    const index = contact ? r.frames.findIndex(f => f.t >= contact.t - 1e-8) : -1;
    const firstOn = lines.findIndex(Boolean);
    details.push({ name: r.name, atk: r.atk, gap: r.gap, contact: contact?.t ?? null, firstOn: firstOn < 0 ? null : r.frames[firstOn].t, lineAtContact: index >= 0 ? lines[index] : null, triggerBeforeStroke: firstOn >= 0 && r.frames[firstOn].t < start });
  }
  output.push({ grace, n: details.length, contacts: details.filter(x => x.contact != null).length, coveredAtContact: details.filter(x => x.lineAtContact).length, prepTriggers: details.filter(x => x.triggerBeforeStroke).length, byAttack: Object.fromEntries([...new Set(details.map(x=>x.name))].map(n=>{const d=details.filter(x=>x.name===n);return [n,{contact:d.filter(x=>x.contact!=null).length,covered:d.filter(x=>x.lineAtContact).length,trigger:d.filter(x=>x.firstOn!=null).length}]})), details });
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(output, null, 1));
for (const {details,...summary} of output) console.log(JSON.stringify(summary));
