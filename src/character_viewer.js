import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODEL_URL = './models/tripo/schwarz-anime.glb';
const host = document.querySelector('#viewer');
const canvas = document.querySelector('#character-canvas');
const overlay = document.querySelector('#viewer-status');
const statusText = document.querySelector('#status-text');
const retryButton = document.querySelector('#retry-load');
const resetButton = document.querySelector('#reset-view');
const zoomInButton = document.querySelector('#zoom-in');
const zoomOutButton = document.querySelector('#zoom-out');
const controlButtons = [resetButton, zoomInButton, zoomOutButton];

let renderer;
let controls;
let scene;
let camera;
let model;
let bounds;
let resizeObserver;
let disposed = false;
let loading = false;
let loaded = false;
let contextLost = false;
let meshCount = 0;
let skinnedMeshCount = 0;
let vertexCount = 0;
let triangleCount = 0;
let animationCount = 0;
let loadRevision = 0;
let userAdjustedView = false;
const listeners = [];

function listen(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  listeners.push(() => target.removeEventListener(type, handler, options));
}

function showStatus(message, retry = false) {
  statusText.textContent = message;
  overlay.hidden = false;
  retryButton.hidden = !retry;
  host.setAttribute('aria-busy', String(loading));
}

function setControlsEnabled(enabled) {
  controlButtons.forEach((button) => { button.disabled = !enabled; });
  if (controls) controls.enabled = enabled;
}

// GLB raw positions can be in Armature coordinates. getVertexPosition applies
// morphs + bindMatrix + rest bone matrices + bindMatrixInverse before world space.
// A raw geometry Box3 can therefore be dramatically larger than the visible skin.
function visibleBounds(root) {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isSkinnedMesh) object.skeleton.update();
  });
  const result = new THREE.Box3();
  const position = new THREE.Vector3();
  root.traverseVisible((object) => {
    if (!object.isMesh || !object.geometry?.attributes.position) return;
    for (let i = 0; i < object.geometry.attributes.position.count; i += 1) {
      object.getVertexPosition(i, position);
      position.applyMatrix4(object.matrixWorld);
      if (![position.x, position.y, position.z].every(Number.isFinite)) {
        throw new Error('The model contains an invalid posed vertex.');
      }
      result.expandByPoint(position);
    }
    // Keep Three's culling bounds consistent with the same static skin pose.
    if (object.isSkinnedMesh) {
      object.computeBoundingBox();
      object.computeBoundingSphere();
    }
  });
  if (result.isEmpty()) throw new Error('The model contains no visible geometry.');
  return result;
}

function disposeObject(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  const bitmaps = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.skeleton) skeletons.add(object.skeleton);
    const owned = Array.isArray(object.material) ? object.material : [object.material];
    owned.filter(Boolean).forEach((material) => materials.add(material));
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) textures.add(value);
    });
  });
  textures.forEach((texture) => {
    const source = texture.source?.data;
    (Array.isArray(source) ? source : [source]).forEach((image) => {
      if (typeof image?.close === 'function') bitmaps.add(image);
    });
    texture.dispose();
  });
  bitmaps.forEach((bitmap) => bitmap.close());
  skeletons.forEach((skeleton) => skeleton.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  root.removeFromParent();
}

function render() {
  if (!disposed && renderer && !contextLost) renderer.render(scene, camera);
}

function fitCamera() {
  if (!bounds || disposed) return;
  const target = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  // The generated Schwarz asset faces +X; +Z is its right side.
  const direction = new THREE.Vector3(1, 0.035, 0.12).normalize();
  camera.position.copy(target).add(direction);
  camera.lookAt(target);
  const inverseRotation = camera.quaternion.clone().invert();
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanHorizontal = tanVertical * camera.aspect;
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverseRotation);
        distance = Math.max(distance, corner.z + Math.max(
          Math.abs(corner.x) / tanHorizontal,
          Math.abs(corner.y) / tanVertical,
        ));
      }
    }
  }
  distance *= 1.16;
  const radius = size.length() / 2;
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.near = Math.max(0.001, radius / 250);
  camera.far = Math.max(50, distance * 10 + radius * 4);
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.minDistance = radius * 0.35;
  controls.maxDistance = distance * 4;
  controls.update();
  controls.saveState();
  userAdjustedView = false;
  render();
}

function resize() {
  if (!renderer || disposed) return;
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (width <= 0 || height <= 0) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (loaded && !userAdjustedView) fitCamera();
  else render();
}

function zoom(factor) {
  if (!loaded || disposed || contextLost) return;
  userAdjustedView = true;
  const offset = camera.position.clone().sub(controls.target);
  offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(offset);
  controls.update();
}

async function loadModel() {
  if (loading || disposed || contextLost) return;
  loading = true;
  loaded = false;
  setControlsEnabled(false);
  showStatus('슈바르츠 외형을 불러오는 중입니다…');
  const revision = ++loadRevision;
  let asset;
  let candidate;
  try {
    asset = await new GLTFLoader().loadAsync(MODEL_URL, (progress) => {
      if (disposed || revision !== loadRevision || contextLost) return;
      if (progress.lengthComputable && progress.total > 0) {
        const percent = Math.min(100, Math.round(100 * progress.loaded / progress.total));
        showStatus(`슈바르츠 외형을 불러오는 중입니다… ${percent}%`);
      }
    });
    if (disposed || revision !== loadRevision) {
      disposeObject(asset.scene);
      return;
    }
    candidate = new THREE.Group();
    candidate.add(asset.scene);
    // Preserve the authored rest pose; no AnimationMixer or skeleton.pose().
    const originalBounds = visibleBounds(candidate);
    const height = originalBounds.max.y - originalBounds.min.y;
    if (!Number.isFinite(height) || height <= 0) throw new Error('The model has no usable height.');
    const scale = 2.4 / height;
    const center = originalBounds.getCenter(new THREE.Vector3());
    candidate.scale.setScalar(scale);
    candidate.position.set(-center.x * scale, -originalBounds.min.y * scale, -center.z * scale);
    const normalizedBounds = visibleBounds(candidate);
    meshCount = 0;
    skinnedMeshCount = 0;
    vertexCount = 0;
    triangleCount = 0;
    candidate.traverseVisible((object) => {
      if (!object.isMesh) return;
      meshCount += 1;
      skinnedMeshCount += Number(Boolean(object.isSkinnedMesh));
      vertexCount += object.geometry.attributes.position?.count || 0;
      triangleCount += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    });
    animationCount = asset.animations.length;
    disposeObject(model);
    model = candidate;
    bounds = normalizedBounds;
    scene.add(model);
    loading = false;
    loaded = true;
    host.setAttribute('aria-busy', 'false');
    if (!contextLost) {
      overlay.hidden = true;
      setControlsEnabled(true);
    }
    resize();
  } catch (error) {
    disposeObject(candidate || asset?.scene);
    if (disposed || revision !== loadRevision) return;
    loading = false;
    loaded = false;
    console.error('Character viewer could not load its model:', error);
    showStatus('외형을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.', true);
  }
}

function dispose() {
  if (disposed) return;
  disposed = true;
  loading = false;
  loaded = false;
  loadRevision += 1;
  resizeObserver?.disconnect();
  listeners.splice(0).forEach((remove) => remove());
  controls?.dispose();
  disposeObject(scene);
  renderer?.dispose();
  renderer?.forceContextLoss();
}

function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#403c36');
    camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 1.2, 6);
    scene.add(new THREE.HemisphereLight('#fff6e5', '#736d65', 2.5));
    const key = new THREE.DirectionalLight('#fff6e7', 3.1);
    key.position.set(3, 5, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight('#e0e5e9', 1.4);
    fill.position.set(-4, 2, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#f4dfc0', 2.1);
    rim.position.set(1, 4, -4);
    scene.add(rim);

    controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.autoRotate = false;
    controls.minPolarAngle = 0.06;
    controls.maxPolarAngle = Math.PI - 0.06;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.8;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    controls.addEventListener('change', render);
    controls.addEventListener('start', () => { userAdjustedView = true; });
    listen(resetButton, 'click', fitCamera);
    listen(zoomInButton, 'click', () => zoom(0.8));
    listen(zoomOutButton, 'click', () => zoom(1.25));
    listen(retryButton, 'click', loadModel);
    listen(canvas, 'keydown', (event) => {
      if (!loaded || contextLost) return;
      if (['+', '=', '-', '_', 'Home'].includes(event.key)) {
        event.preventDefault();
        if (event.key === 'Home') fitCamera();
        else zoom(['+', '='].includes(event.key) ? 0.8 : 1.25);
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        userAdjustedView = true;
        const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
        if (event.key === 'ArrowLeft') spherical.theta -= 0.13;
        if (event.key === 'ArrowRight') spherical.theta += 0.13;
        if (event.key === 'ArrowUp') spherical.phi -= 0.13;
        if (event.key === 'ArrowDown') spherical.phi += 0.13;
        spherical.phi = THREE.MathUtils.clamp(spherical.phi, controls.minPolarAngle, controls.maxPolarAngle);
        camera.position.setFromSpherical(spherical).add(controls.target);
        controls.update();
      }
    });
    listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault();
      contextLost = true;
      setControlsEnabled(false);
      showStatus('화면을 다시 준비하고 있습니다. 잠시만 기다려 주세요.');
    });
    listen(canvas, 'webglcontextrestored', () => {
      contextLost = false;
      if (loaded) {
        overlay.hidden = true;
        setControlsEnabled(true);
        resize();
      } else if (!loading) loadModel();
      else showStatus('슈바르츠 외형을 불러오는 중입니다…');
    });
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    loadModel();
  } catch (error) {
    console.error('Character viewer could not initialize:', error);
    dispose();
    showStatus('이 브라우저에서 3D 화면을 열지 못했습니다. 다른 브라우저에서 다시 열어 주세요.');
  }
}

// Fresh frozen values only: browser verification cannot mutate the live scene.
Object.defineProperty(window, 'characterViewer', {
  configurable: true,
  get: () => Object.freeze({
    loaded, loading, disposed, contextLost, modelUrl: MODEL_URL,
    meshCount, skinnedMeshCount, vertexCount, triangleCount, animationCount,
    playingAnimations: 0,
    bounds: bounds ? Object.freeze({
      min: Object.freeze(bounds.min.toArray()),
      max: Object.freeze(bounds.max.toArray()),
    }) : null,
    camera: camera ? Object.freeze({
      position: Object.freeze(camera.position.toArray()),
      target: Object.freeze(controls?.target.toArray() || [0, 0, 0]),
      aspect: camera.aspect,
    }) : null,
    renderer: renderer ? Object.freeze({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }) : null,
  }),
});

listen(window, 'pagehide', (event) => {
  // A cached page keeps its resources for the browser's back/forward restore.
  if (!event.persisted) dispose();
});
if (import.meta.hot) import.meta.hot.dispose(dispose);
initialize();
