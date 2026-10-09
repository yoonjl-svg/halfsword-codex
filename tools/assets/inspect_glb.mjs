#!/usr/bin/env node
// Read-only GLB inventory. Counts describe stored topology, not visible scene instances.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const check = (ok, message) => { if (!ok) throw new Error(message); };
const uint = (n) => Number.isSafeInteger(n) && n >= 0;
const ref = (items, index, label) => {
  check(uint(index) && index < items.length, `Invalid ${label} index: ${index}`);
  return items[index];
};
function dimensions(b) {
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && b.toString('ascii', 12, 16) === 'IHDR')
    return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 25 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X' && b.length >= 30) return { format: 'webp', width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
    if (kind === 'VP8 ' && b.length >= 30 && b.subarray(23, 26).equals(Buffer.from('9d012a', 'hex')))
      return { format: 'webp', width: b.readUInt16LE(26) & 16383, height: b.readUInt16LE(28) & 16383 };
    if (kind === 'VP8L' && b[20] === 0x2f) {
      const bits = b.readUInt32LE(21);
      return { format: 'webp', width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
    }
  }
  if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
    for (let p = 2; p + 4 <= b.length;) {
      if (b[p++] !== 255) break;
      while (b[p] === 255) p++;
      const marker = b[p++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (p + 2 > b.length) break;
      const size = b.readUInt16BE(p);
      if (size < 2 || p + size > b.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8)
        return { format: 'jpeg', width: b.readUInt16BE(p + 5), height: b.readUInt16BE(p + 3) };
      p += size;
    }
  }
  return { format: 'unknown', width: null, height: null };
}
function inspect(bytes) {
  check(bytes.length >= 20 && bytes.readUInt32LE(0) === 0x46546c67, 'Not a binary GLB');
  check(bytes.readUInt32LE(4) === 2, 'Only GLB version 2 is supported');
  check(bytes.readUInt32LE(8) === bytes.length, 'GLB declared length does not match file');
  const chunks = [];
  for (let p = 12; p < bytes.length;) {
    check(p + 8 <= bytes.length, 'Truncated chunk header');
    const length = bytes.readUInt32LE(p), type = bytes.readUInt32LE(p + 4);
    check(length % 4 === 0 && p + 8 + length <= bytes.length, 'Invalid chunk length or alignment');
    chunks.push({ type, length, data: bytes.subarray(p + 8, p + 8 + length) });
    p += 8 + length;
  }
  check(chunks[0].type === 0x4e4f534a && chunks.filter(c => c.type === 0x4e4f534a).length === 1, 'Expected one leading JSON chunk');
  const binaries = chunks.filter(c => c.type === 0x004e4942);
  check(binaries.length <= 1 && (!binaries.length || chunks[1] === binaries[0]), 'Invalid BIN chunk order or count');
  const g = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(chunks[0].data));
  check(g.asset?.version === '2.0', 'Expected glTF asset version 2.0');
  const arrays = ['buffers', 'bufferViews', 'accessors', 'scenes', 'nodes', 'meshes', 'materials', 'textures', 'images', 'skins', 'animations'];
  for (const k of arrays) { g[k] ??= []; check(Array.isArray(g[k]), `${k} must be an array`); }
  const buffers = g.buffers.map((b, i) => {
    check(uint(b.byteLength), `Invalid buffer ${i} length`);
    if (b.uri !== undefined) return null; // Never fetch or read external resources.
    check(i === 0 && binaries.length === 1, 'Missing embedded BIN buffer');
    check(binaries[0].length >= b.byteLength && binaries[0].length - b.byteLength <= 3, 'BIN buffer length mismatch');
    return binaries[0].data.subarray(0, b.byteLength);
  });
  const view = (i) => ref(g.bufferViews, i, 'bufferView');
  const viewBytes = (i) => { const v = view(i); return buffers[v.buffer]?.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength) ?? null; };
  for (const [i, v] of g.bufferViews.entries()) {
    const b = ref(g.buffers, v.buffer, 'buffer');
    check(uint(v.byteOffset ?? 0) && uint(v.byteLength) && (v.byteOffset ?? 0) + v.byteLength <= b.byteLength, `Invalid bufferView ${i} range`);
    if (v.byteStride !== undefined) check(uint(v.byteStride) && v.byteStride >= 4 && v.byteStride <= 252 && v.byteStride % 4 === 0, 'Invalid bufferView stride');
  }
  const widths = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  for (const [i, a] of g.accessors.entries()) {
    check(uint(a.count) && a.count > 0 && widths[a.componentType] && components[a.type], `Invalid accessor ${i}`);
    if (a.bufferView === undefined) continue;
    const v = view(a.bufferView), w = widths[a.componentType], side = a.type.startsWith('MAT') ? Number(a.type.slice(3)) : 0;
    const size = side ? side * Math.ceil(side * w / 4) * 4 : components[a.type] * w;
    const stride = v.byteStride ?? size;
    check(uint(a.byteOffset ?? 0) && stride >= size && (a.byteOffset ?? 0) + (a.count - 1) * stride + size <= v.byteLength, `Accessor ${i} exceeds bufferView`);
  }
  const accessor = (i) => ref(g.accessors, i, 'accessor');
  const nodes = g.nodes.map((n, i) => {
    for (const [k, size] of [['matrix', 16], ['translation', 3], ['rotation', 4], ['scale', 3]])
      if (n[k] !== undefined) check(Array.isArray(n[k]) && n[k].length === size && n[k].every(Number.isFinite), `Invalid node ${i} ${k}`);
    check(!n.matrix || !['translation', 'rotation', 'scale'].some(k => n[k] !== undefined), 'Node cannot mix matrix and TRS');
    for (const child of n.children ?? []) ref(g.nodes, child, 'child node');
    if (n.mesh !== undefined) ref(g.meshes, n.mesh, 'mesh');
    if (n.skin !== undefined) ref(g.skins, n.skin, 'skin');
    return { index: i, name: n.name ?? null, children: n.children ?? [], mesh: n.mesh ?? null, skin: n.skin ?? null,
      restTransform: n.matrix ? { matrix: n.matrix } : { translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1], scale: n.scale ?? [1, 1, 1] }, weights: n.weights ?? null };
  });
  const visiting = new Set(), visited = new Set();
  const visit = (i) => { check(!visiting.has(i), 'Node hierarchy contains a cycle'); if (visited.has(i)) return; visiting.add(i); nodes[i].children.forEach(visit); visiting.delete(i); visited.add(i); };
  nodes.forEach((_, i) => visit(i));
  const meshes = g.meshes.map((m, i) => ({ index: i, name: m.name ?? null, weights: m.weights ?? [], targetNames: m.extras?.targetNames ?? [],
    primitives: m.primitives.map((p, j) => {
      const attrs = Object.fromEntries(Object.entries(p.attributes).map(([k, a]) => [k, { accessor: a, count: accessor(a).count }]));
      const count = p.indices !== undefined ? accessor(p.indices).count : attrs.POSITION?.count;
      if (p.indices !== undefined) check(accessor(p.indices).type === 'SCALAR' && [5121, 5123, 5125].includes(accessor(p.indices).componentType), 'Invalid index accessor type');
      const mode = p.mode ?? 4;
      check(uint(mode) && mode <= 6 && uint(count), `Invalid primitive ${i}/${j}`);
      if (mode === 4) check(count % 3 === 0, 'Triangle-list element count is not divisible by three');
      if (p.material !== undefined) ref(g.materials, p.material, 'material');
      const targets = (p.targets ?? []).map(t => Object.fromEntries(Object.entries(t).map(([k, a]) => [k, { accessor: a, count: accessor(a).count }])));
      return { index: j, mode, material: p.material ?? null, attributes: attrs, indices: p.indices ?? null, elementCount: count,
        triangles: mode === 4 ? count / 3 : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0, morphTargets: targets, extensions: Object.keys(p.extensions ?? {}) };
    }) }));
  const images = g.images.map((im, i) => {
    let b = im.bufferView !== undefined ? viewBytes(im.bufferView) : null;
    const dataURI = im.uri?.startsWith('data:');
    if (dataURI) { const match = /^data:([^,]*),(.*)$/s.exec(im.uri); check(match, 'Invalid image data URI'); b = match[1].endsWith(';base64') ? Buffer.from(match[2], 'base64') : Buffer.from(decodeURIComponent(match[2]), 'binary'); }
    check((im.uri !== undefined) !== (im.bufferView !== undefined), `Image ${i} must have exactly one source`);
    return { index: i, name: im.name ?? null, mimeType: im.mimeType ?? null, bufferView: im.bufferView ?? null,
      uri: dataURI ? '(embedded data URI)' : im.uri ?? null, embedded: !!b, bytes: b?.length ?? null, dimensions: b ? dimensions(b) : { format: 'unknown', width: null, height: null } };
  });
  const textures = g.textures.map((t, i) => {
    const sources = [t.source, ...Object.values(t.extensions ?? {}).map(e => e.source)].filter(s => s !== undefined);
    for (const s of sources) ref(images, s, 'image');
    return { index: i, name: t.name ?? null, sources, sampler: t.sampler ?? null, extensions: t.extensions ?? {} };
  });
  const materials = g.materials.map((m, i) => {
    const maps = [];
    const walk = (o, path = '') => { for (const [k, v] of Object.entries(o ?? {})) if (v && typeof v === 'object') {
      if (k.endsWith('Texture') && v.index !== undefined) { ref(textures, v.index, 'texture'); maps.push({ slot: `${path}${k}`, ...v }); }
      else walk(v, `${path}${k}.`);
    } };
    walk(m);
    return { index: i, name: m.name ?? null, alphaMode: m.alphaMode ?? 'OPAQUE', doubleSided: m.doubleSided ?? false, maps };
  });
  const skins = g.skins.map((s, i) => {
    if (s.skeleton !== undefined) ref(nodes, s.skeleton, 'skeleton node');
    if (s.inverseBindMatrices !== undefined) { const a = accessor(s.inverseBindMatrices); check(a.type === 'MAT4' && a.componentType === 5126 && a.count >= s.joints.length, 'Invalid inverse bind matrix accessor'); }
    return { index: i, name: s.name ?? null, skeleton: s.skeleton ?? null, inverseBindMatrices: s.inverseBindMatrices ?? null,
      joints: s.joints.map(index => { const n = ref(nodes, index, 'joint node'); return { node: index, name: n.name, restTransform: n.restTransform }; }) };
  });
  const animations = g.animations.map((a, i) => ({ index: i, name: a.name ?? null,
    channels: a.channels.map(c => { ref(a.samplers, c.sampler, 'animation sampler'); if (c.target.node !== undefined) ref(nodes, c.target.node, 'animation node'); return c; }),
    samplers: a.samplers.map(s => {
      const input = accessor(s.input); accessor(s.output);
      const b = input.bufferView !== undefined ? viewBytes(input.bufferView) : null;
      let range = null;
      if (b && input.componentType === 5126 && input.type === 'SCALAR' && !input.sparse && !view(input.bufferView).extensions?.EXT_meshopt_compression) {
        let min = Infinity, max = -Infinity;
        for (let k = 0; k < input.count; k++) { const t = b.readFloatLE((input.byteOffset ?? 0) + k * (view(input.bufferView).byteStride ?? 4)); check(Number.isFinite(t), 'Nonfinite animation time'); min = Math.min(min, t); max = Math.max(max, t); }
        range = { start: min, end: max, duration: max - min };
      }
      return { ...s, interpolation: s.interpolation ?? 'LINEAR', keyframes: input.count, timeRange: range };
    }) }));
  for (const a of animations) {
    const ranges = a.samplers.map(s => s.timeRange);
    a.timeRange = ranges.length && ranges.every(Boolean) ? { start: Math.min(...ranges.map(r => r.start)), end: Math.max(...ranges.map(r => r.end)) } : null;
    if (a.timeRange) a.timeRange.duration = a.timeRange.end - a.timeRange.start;
  }
  const extensionNames = new Set(g.extensionsUsed ?? []);
  const scan = (o) => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (k === 'extensions') Object.keys(v).forEach(e => extensionNames.add(e)); scan(v); } }; scan(g);
  for (const s of g.scenes) for (const n of s.nodes ?? []) ref(nodes, n, 'scene node');
  if (g.scene !== undefined) ref(g.scenes, g.scene, 'default scene');
  return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, asset: g.asset,
    chunks: chunks.map(({ type, length }) => ({ type: `0x${type.toString(16)}`, bytes: length })), defaultScene: g.scene ?? null, scenes: g.scenes,
    totals: { nodes: nodes.length, meshes: meshes.length, primitives: meshes.reduce((n, m) => n + m.primitives.length, 0), triangles: meshes.flatMap(m => m.primitives).reduce((n, p) => n + p.triangles, 0), embeddedImageBytes: images.reduce((n, im) => n + (im.bytes ?? 0), 0) },
    nodes, meshes, accessors: g.accessors, materials, textures, images, buffers: g.buffers, skins,
    hasAnimationClips: animations.length > 0, hasAnimationChannels: animations.some(a => a.channels.length > 0), animations,
    extensionsRequired: g.extensionsRequired ?? [], extensionsUsed: [...extensionNames].sort(), compression: [...extensionNames].filter(e => /draco|meshopt|basisu|texture_webp/i.test(e)).sort(),
    limitations: ['Header inventory only; texture pixels, compressed geometry, skin weights and deformation are not decoded or validated.', 'External resources are not loaded; sparse or compressed animation time ranges are unknown.', 'Triangle counts include degenerate triangles and exclude node instancing.'] };
}
try {
  check(process.argv.length === 3 && process.argv[2] !== '--help', 'Usage: node tools/assets/inspect_glb.mjs <local-file.glb>');
  console.log(JSON.stringify(inspect(await readFile(process.argv[2])), null, 2));
} catch (error) { console.error(`inspect_glb: ${error.message}`); process.exitCode = 1; }
