import * as THREE from 'three';
import { buildLobbyWeapon, disposeLobbyWeapon } from './lobby_weapon.js';

// 실제 플레이어의 겉모습만 복제한다. 전투의 몸·관절·자세·공유 자원은 변경하지 않는다.
export function createLobbyCharacter(container, fighter) {
  const scene = new THREE.Scene(), model = new THREE.Group();
  let swordArm = null, weapon = null, helmet = null;
  scene.add(model);
  for (const { rb, group, kind } of fighter.meshes) {
    if (kind === 'loose' || kind === 'weapon') continue;
    const copy = group.clone(true), p = rb.translation(), q = rb.rotation();
    if (group === fighter.groups.head) {
      const index = group.children.indexOf(fighter.helmetGroup);
      if (index >= 0) helmet = copy.children[index];
    }
    copy.position.set(p.x, p.y, p.z); copy.quaternion.set(q.x, q.y, q.z, q.w);
    // 로비에서는 빈손을 내린다. 복제한 칼팔 두 조각만 어깨에서 함께 회전한다.
    if (group === fighter.groups.uarmS || group === fighter.groups.farmS) {
      const pelvis = fighter.bodies.pelvis, pr = pelvis.rotation(), pt = pelvis.translation();
      const facing = new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w);
      const shoulder = fighter.localPos.uarmS.clone(); shoulder.x = 0;
      shoulder.sub(fighter.localPos.pelvis).applyQuaternion(facing).add(new THREE.Vector3(pt.x, pt.y, pt.z));
      const drop = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1).applyQuaternion(facing), -Math.PI / 2);
      copy.position.sub(shoulder).applyQuaternion(drop).add(shoulder); copy.quaternion.premultiply(drop);
    }
    if (group === fighter.groups.farmS) copy.traverse(part => {
      // 칼에 붙은 주먹은 복제하지 않으므로 원래 손 메시를 다시 보인다.
      if (part.isMesh && part.geometry.type === 'SphereGeometry' && Math.abs((part.geometry.parameters.radius ?? 0) - .042) < .002 && part.position.y < -.1) part.visible = true;
    });
    copy.visible = true; model.add(copy);
    if (group === fighter.groups.farmS) swordArm = copy;
  }
  const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3());
  for (const part of model.children) part.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const height = bounds.max.y - bounds.min.y;
  const hemi = new THREE.HemisphereLight(0xfff2d7, 0x493827, 2.4);
  const key = new THREE.DirectionalLight(0xffe5bc, 3.0); key.position.set(4, 5, 3);
  const rim = new THREE.DirectionalLight(0xf3e9d8, 1.5); rim.position.set(-3, 3, -4);
  scene.add(hemi, key, rim);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30);
  // 세운 롱소드까지 같은 축척으로 들어온다. 장착/해제 때 인물 크기는 바뀌지 않는다.
  const displayHeight = Math.max(height, 2.16);
  camera.position.set(5, displayHeight * .55, 0); camera.lookAt(0, displayHeight * .5, 0);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setPixelRatio(1); renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const events = new AbortController();
  const listen = (type, fn) => container.addEventListener(type, fn, { signal: events.signal });
  const render = () => {
    container.dataset.angle = String(Math.round(THREE.MathUtils.radToDeg(model.rotation.y)));
    renderer.render(scene, camera);
  };
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h, half = Math.max(displayHeight * .55, .62 / aspect);
    camera.left = -half * aspect; camera.right = half * aspect;
    camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix(); render();
  };
  let drag = null;
  listen('pointerdown', e => { if (e.button !== 0 || drag) return; drag = { id: e.pointerId, x: e.clientX }; container.setPointerCapture(e.pointerId); container.focus({ preventScroll: true }); });
  listen('pointermove', e => {
    if (drag?.id !== e.pointerId) return;
    model.rotation.y += (e.clientX - drag.x) / Math.max(1, container.clientWidth) * Math.PI * 2;
    drag.x = e.clientX; render();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(type, () => { drag = null; });
  listen('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Home') model.rotation.y = 0;
    else model.rotation.y += (e.key === 'ArrowLeft' ? -1 : 1) * Math.PI / 8;
    render();
  });
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  return { setWeapon(id) {
    // 먼저 새 모델을 만들어 실패 시 기존 장착 표시를 보존한다.
    const next = id ? buildLobbyWeapon(id) : null;
    if (weapon) disposeLobbyWeapon(weapon);
    weapon = next;
    if (weapon) {
      weapon.position.copy(new THREE.Vector3(.13, 0, 0).applyQuaternion(swordArm.quaternion).add(swordArm.position));
      weapon.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), .2)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
      model.add(weapon);
    }
    container.dataset.equipped = id || '';
    container.setAttribute('aria-label', `캐릭터 360도 보기. ${id ? (id === 'longsword' ? '롱소드' : '나뭇가지') + ' 장착.' : '맨손.'} 드래그 또는 좌우 방향키로 회전, Home으로 정면`);
    render();
  }, setArmor(id) {
    if (helmet) helmet.visible = id === 'kettle';
    container.dataset.armor = id || '';
    render();
  }, dispose() {
    if (weapon) disposeLobbyWeapon(weapon);
    observer.disconnect(); events.abort(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    // geometry/material은 게임과 공유하므로 dispose하지 않는다.
    scene.clear();
  } };
}
