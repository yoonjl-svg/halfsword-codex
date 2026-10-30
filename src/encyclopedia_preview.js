// Preview only: even other lobby controls cannot touch the player's real save.
const memory = new Map();
const storage = { getItem: k => memory.get(String(k)) ?? null, setItem: (k, v) => memory.set(String(k), String(v)), removeItem: k => memory.delete(String(k)), clear: () => memory.clear(), key: n => [...memory.keys()][n] ?? null, get length() { return memory.size; } };
Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
const { mountLobby } = await import('./lobby.js');
const root = document.getElementById('lobbyHost').attachShadow({ mode: 'open' });
const notice = () => { document.getElementById('previewNote').textContent = '도감 미리보기입니다. 전투는 본 게임에서 시작해 주세요.'; };
const lobby = mountLobby({ root, game: { getSkillBookContext: () => ({ test: true }) }, choice: 'continue', onDepart: notice, onBack: notice });
root.getElementById('tabEncyclopedia').click();
root.activeElement?.blur();
if (new URLSearchParams(location.search).get('view') === 'characters') root.getElementById('ecCharactersTab').click();
window.addEventListener('pagehide', () => lobby.destroy(), { once: true });
