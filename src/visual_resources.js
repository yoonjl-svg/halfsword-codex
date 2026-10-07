// Fighter visuals normally belong to one round. Effects may explicitly retain
// session-wide geometry/materials; texture caches always keep their own lifetime.
const retained = new WeakSet();

export function retainVisualResources(...resources) {
  for (const resource of resources) retained.add(resource);
}

export function disposeVisualTrees(roots) {
  const resources = new Set();
  for (const root of roots) root.traverse((object) => {
    // THREE.Sprite geometry is a library-wide singleton, not tree-owned.
    if (object.geometry && !object.isSprite) resources.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (material) resources.add(material);
  });
  for (const resource of resources) if (!retained.has(resource)) resource.dispose();
}
