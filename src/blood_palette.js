// Per-victim appearance only. Bleeding and death still use the human rules.
const RED = Object.freeze({ key: 'red', splash: 0x8a0000, drip: 0x7a0000, blade: 0x5a0808, flesh: 0x4a0a0c, rim: 0x6a1a18 });
const WHITE = Object.freeze({ key: 'white', splash: 0xe8eee7, drip: 0xd8e1d8, blade: 0xd2dcd2, flesh: 0xb7c3ba, rim: 0xe2e9df });
export const bloodPalette = (fighter) => fighter?.physiology?.blood === 'white' ? WHITE : RED;
