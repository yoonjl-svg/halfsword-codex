import { trial, ATTACK_NAMES } from './parry_reading_trials.mjs';
import { writeFileSync } from 'node:fs';

const names = (process.env.ATTACKS ?? ATTACK_NAMES.join(',')).split(',');
const atks = (process.env.ATKS ?? 'longsword,rapier,zweihander').split(',');
const gaps = (process.env.GAPS ?? '1.2,1.4,1.6,1.8').split(',').map(Number);
const configs = (process.env.CONFIGS ?? 'uchigatana').split(',');
const held = process.env.HELD === '1';
const trace = process.env.TRACE !== '0';
const Guard = process.env.CANDIDATE ? (await import('./parry_reading_guard.mjs')).ResearchGuard : undefined;
const out = [];
for (const cfg of configs) for (const atk of atks) {
  for (const name of names) for (const gap of gaps) out.push(trial({ cfg, atk, name, gap, held, trace, Guard, prepareOnly: process.env.PREPARE === '1' }));
  const rows = out.filter(x => x.cfg === cfg && x.atk === atk);
  console.log(JSON.stringify({ cfg, atk, n: rows.length, injured: rows.filter(x => x.injured).length, fresh: rows.filter(x => x.firstStrokeClash).length, covered: rows.filter(x => x.firstStrokeClash?.mode === 'defend' && x.firstStrokeClash.cover >= .5).length, nag: rows.filter(x => x.nag).length, switches: rows.reduce((s,x) => s + x.switches, 0) }));
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));
