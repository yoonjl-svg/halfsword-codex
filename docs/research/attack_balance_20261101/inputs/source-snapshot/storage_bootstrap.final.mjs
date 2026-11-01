// Kept as an inline classic script by the research HTML transform. It executes
// before any bundled static imports can read the ordinary game's storage.
export const RESEARCH_PREFIX = 'stillness.research.attack-balance-20261101.';
export function installResearchStorage(prefix) {
  try {
    const ls = globalThis.localStorage, P = Storage.prototype;
    if (P.__attackBalanceResearch) return true;
    const { getItem, setItem, removeItem, key, clear } = P;
    const length = Object.getOwnPropertyDescriptor(P, 'length').get;
    const keys = s => Array.from({ length: length.call(s) }, (_, i) => key.call(s, i)).filter(k => k?.startsWith(prefix));
    P.getItem = function(k) { return getItem.call(this, this === ls ? prefix + k : k); };
    P.setItem = function(k, v) { return setItem.call(this, this === ls ? prefix + k : k, v); };
    P.removeItem = function(k) { return removeItem.call(this, this === ls ? prefix + k : k); };
    P.key = function(i) { return this === ls ? keys(this)[i]?.slice(prefix.length) ?? null : key.call(this, i); };
    P.clear = function() { if (this !== ls) return clear.call(this); for (const k of keys(this)) removeItem.call(this, k); };
    Object.defineProperty(P, 'length', { configurable: true, get() { return this === ls ? keys(this).length : length.call(this); } });
    Object.defineProperty(P, '__attackBalanceResearch', { value: true });
    return true;
  } catch { return false; }
}
