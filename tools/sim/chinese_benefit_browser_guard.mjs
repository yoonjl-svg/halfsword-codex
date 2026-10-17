import {guardClass} from './chinese_benefit_model.mjs';
export const PlayerParryGuard=guardClass(new URLSearchParams(location.search).get('benefit')??'base');
