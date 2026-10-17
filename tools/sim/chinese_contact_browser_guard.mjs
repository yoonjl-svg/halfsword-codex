import {contactGuard} from './chinese_contact_guard.mjs';
export const PlayerParryGuard=contactGuard(new URLSearchParams(location.search).get('benefit')??'path-fit');
