import { build } from 'vite';
import { cp, mkdir, rename, writeFile } from 'node:fs/promises';
import { CATALOG_ITEMS, CATALOG_CHARACTERS } from '../../src/encyclopedia_data.js';
await build({ configFile: 'vite.encyclopedia.config.js' });
const files = new Set([...CATALOG_ITEMS, ...CATALOG_CHARACTERS].map(e => e.image).filter(Boolean));
files.add('ui/portraits/grid-overlay.svg');
files.add('ui/wallet/coins.webp');
files.add('ui/wallet/pouch.webp');
for (const file of files) {
  await mkdir(`dist-encyclopedia/${file.slice(0, file.lastIndexOf('/'))}`, { recursive: true });
  await cp(`public/${file}`, `dist-encyclopedia/${file}`);
}
await cp('public/fonts', 'dist-encyclopedia/fonts', { recursive: true });
await rename('dist-encyclopedia/encyclopedia-preview.html', 'dist-encyclopedia/index.html');
await writeFile('dist-encyclopedia/catalog.json', JSON.stringify({ items: CATALOG_ITEMS.map(({ spec, ...e }) => e), characters: CATALOG_CHARACTERS }, null, 2));
