import base from './vite.config.js';
// publicDir=false avoids copying unrelated preview builds. Fonts are copied after
// bundling, so make both their preloads and inline CSS relative to this preview.
const relativeFonts={name:'whip-review-relative-fonts',transformIndexHtml:{order:'post',handler:html=>html.replace(/(["'(])\/fonts\//g,'$1./fonts/')}};
export default {...base,plugins:[...base.plugins,relativeFonts],publicDir:false, build:{...base.build,outDir:'dist-whip-ghost'}};
