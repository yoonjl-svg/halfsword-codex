// Test-process-only replacement. Production entry points never import this file.
import { PlayerParryGuard } from '../../src/parry_button.js';
import { ResearchGuard } from './parry_reading_guard.mjs';
PlayerParryGuard.prototype.step = ResearchGuard.prototype.step;
