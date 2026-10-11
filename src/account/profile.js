export const DEFAULT_SETTINGS = Object.freeze({ difficulty: 'normal', pixel: false, blood: true, sound: true, invertTilt: false, moveMode: 'stick', skill: '0.7', guardNames: true, trail: true, fpsCap: true });
const choices = { difficulty: ['easy', 'normal', 'hard'], moveMode: ['stick', 'tilt'], skill: ['0', '0.4', '0.7', '1'] };
export function cleanSettings(value) {
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, fallback] of Object.entries(result)) {
    if (choices[key]?.includes(value?.[key]) || (typeof fallback === 'boolean' && typeof value?.[key] === 'boolean')) result[key] = value[key];
  }
  return result;
}
export function cleanName(value) {
  const name = String(value ?? '').trim();
  if (!name || [...name].length > 24 || /[\u0000-\u001f\u007f-\u009f]/u.test(name)) throw new Error('이름은 1–24자로 적어주세요.');
  return name;
}
export function cleanProfile(value) {
  return { display_name: cleanName(value?.display_name || '여행자'), settings: cleanSettings(value?.settings) };
}
export function namespace(appId) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(appId)) throw new Error('Invalid application ID');
  return `stillness-account:v1:${appId}:`;
}
