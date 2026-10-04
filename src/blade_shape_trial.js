/** Session-only Qinggang contact-profile comparison. Authored mass/inertia stay intact. */
export function configureBladeShapeTrial(params) {
  const model = params.get('bladeShape');
  return {
    active: ['box', 'profile'].includes(model) && params.get('weapon') === 'qinggang' && params.get('onehandArm') === 'manual',
    model: model === 'profile' ? 'profile' : 'box',
    applied: false,
  };
}

export function applyBladeShapeTrial(info, player, R) {
  if (!info.active || info.model !== 'profile' || player.index !== 0 ||
      player.weapon.id !== 'qinggang' || player.onehandArmModel !== 'manual') return false;
  const collider = player.bladeColliders[0], mesh = player.bladeMesh;
  if (player.bladeColliders.length !== 1 || !mesh?.geometry?.attributes.position) return false;
  // The existing mesh and collider share a part-local origin. No COM/part translation here.
  const attribute = mesh.geometry.attributes.position;
  const vertices = new Float32Array(attribute.count * 3);
  for (let i = 0; i < attribute.count; i++) {
    vertices[i * 3] = attribute.getX(i);
    vertices[i * 3 + 1] = attribute.getY(i);
    vertices[i * 3 + 2] = attribute.getZ(i);
  }
  collider.setShape(new R.ConvexPolyhedron(vertices, null));
  player.sword.recomputeMassPropertiesFromColliders();
  return true;
}

export function mountBladeShapeTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  const panel = document.createElement('p');
  panel.id = 'bladeShapeTrialInfo';
  panel.className = 'sub';
  const label = document.createElement('span');
  label.textContent = info.model === 'profile'
    ? '청강검 접촉 비교 B · 칼날 형상 시험 '
    : '청강검 접촉 비교 A · 기존 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#blade-shape-comparison';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.append(label, link);
  menuSub.after(panel);
}
