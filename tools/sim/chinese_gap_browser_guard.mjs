import {gapGuard} from './chinese_gap_model.mjs';
export const PlayerParryGuard=gapGuard(new URLSearchParams(location.search).get('benefit')??'inside');
