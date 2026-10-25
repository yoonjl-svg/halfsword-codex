import base from './vite.config.js';
// Standalone previews copy only required public assets after building.
const fonts={name:'pappenheimer-relative-fonts',transformIndexHtml:{order:'post',handler:html=>html.replace(/(["'(])\/fonts\//g,'$1./fonts/')}};
export default {...base,plugins:[...base.plugins,fonts],publicDir:false,build:{...base.build,outDir:'dist-pappenheimer'}};
