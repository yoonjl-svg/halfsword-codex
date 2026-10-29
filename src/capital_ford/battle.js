import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS, SKILL, INPUT, TIME } from "../config.js";
import { buildCapitalFord } from "./stage.js";
import { moveScaleAt, TERRAIN } from "./ground.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sound } from "../sound.js";
import { attachHands } from "../hands.js";
import { createSwordTrails } from "../sword_trail.js";
import { tickDebris, clearDebris } from "../debris.js";
import { mapMobileHandDelta } from "../mobile_intent.js";
import { createTeamWorld } from "./combat.js";
import { shortName, conditionName } from "./catalog.js";
let rapierReady;
export async function mountBattle({
  root,
  style,
  pending,
  onCheckpoint,
  onLeave,
  onComplete,
  isCurrent = () => true,
}) {
  rapierReady ??= RAPIER.init();
  await rapierReady;
  if (!isCurrent()) return null;
  root.innerHTML = `<style>${style}</style><main class="battle-screen"><canvas aria-label="생사전 동시 전투. 드래그로 베기, 톡 눌러 찌르기"></canvas><div class="battle-top"><div><b class="battle-title">수도 근교 여울</b><div class="battle-roster" id="allyHud"></div></div><div class="mode-buttons"><button id="battlePause">멈춤</button><button id="viewMode">인물 시점</button><button id="exploreMode">탐방</button><button id="duelMode">1:1</button><button id="teamMode">2:2</button></div><div><div class="battle-roster" id="foeHud"></div></div></div><div id="battleLabels"></div><div class="battle-controls"><div class="battle-stick" id="movePad" aria-label="이동 조이스틱"><span class="battle-knob"></span></div><div class="battle-actions"><button id="targetNext">목표 전환</button><button class="guard" id="guardButton">막기</button></div></div><p class="battle-hint">드래그 베기 · 톡 찌르기 · 왼쪽 이동 / PC WASD · F 막기</p><section class="battle-center" id="battleModal"><h2>${pending.mode === "explore" ? "수도 근교 여울" : `${pending.allies.length} 대 ${pending.enemies.length}`}</h2><p>${pending.mode === "explore" ? "다리와 여울을 걸어보세요.<br>왼쪽 이동 · 화면 드래그 베기" : "첫 캐릭터를 직접 조작합니다.<br>동료는 함께 싸우며 아군 피해는 없습니다."}</p><button class="primary" id="battleGo">${pending.mode === "explore" ? "걸어보기" : "대련 시작"}</button></section></main>`;
  const $ = (id) => root.getElementById(id),
    canvas = root.querySelector("canvas"),
    events = new AbortController();
  const listen = (el, type, fn) =>
    el.addEventListener(type, fn, { signal: events.signal });
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb5c1b9);
  scene.fog = new THREE.Fog(0xb5c1b9, 28, 82);
  const hemi = new THREE.HemisphereLight(0xe4e5dc, 0x68583f, 1.5),
    sun = new THREE.DirectionalLight(0xffedcc, 2.2);
  sun.position.set(-8, 14, 7);
  sun.shadow.bias=-.0003;
  sun.shadow.normalBias=.035;
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -17;
  sun.shadow.camera.right = 17;
  sun.shadow.camera.top = 17;
  sun.shadow.camera.bottom = -17;
  scene.add(hemi, sun);
  const arena = buildCapitalFord(scene);
  const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 100);
  camera.position.set(-18, 14, 18);
  camera.lookAt(0, 0, 0);
  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(0, 0, 0); orbit.enableDamping=true; orbit.minDistance=4; orbit.maxDistance=37; orbit.maxPolarAngle=Math.PI*.47;
  let view="wide";
  const sound = new Sound();
  const G = createTeamWorld(RAPIER, scene, pending, {
    onWound: (a, v, r) => {
      if (sound.ctx)
        sound.impact({
          a: a.weapon.material || "steel",
          b: "flesh",
          energy: r.energy || 20,
        });
    },
    onClash: (p, s, info) => {
      if (info.fresh && sound.ctx) sound.clash(Math.max(5, info.vn * 8));
    },
  });
  const extras = G.fighters.map(attachHands).filter(Boolean),
    trailGroups = [createSwordTrails(scene), createSwordTrails(scene)];
  trailGroups[0].attach(G.fighters.filter((f) => f.eventTeam === 0));
  trailGroups[1].attach(G.fighters.filter((f) => f.eventTeam === 1));
  const labels = new Map();
  for (const f of G.fighters) {
    const el = document.createElement("div");
    el.className = `fighter-label ${f.eventTeam ? "foe" : ""}`;
    el.innerHTML = `<span>${f.name}</span><i></i>`;
    $("battleLabels").append(el);
    labels.set(f, el);
  }
  let playing = false,
    disposed = false,
    last = performance.now(),
    acc = 0,
    raf = 0,
    lastSave = 0,
    result = null,
    drag = null,
    guardHeld = false,
    stickId = null,
    dx = 0,
    dy = 0,
    taps = 0,
    stick = { x: 0, y: 0 };
  const keys = new Set();
  const modal = $("battleModal");
  function resetInput() {
    drag = null;
    guardHeld = false;
    stickId = null;
    dx = dy = taps = 0;
    stick = { x: 0, y: 0 };
    keys.clear();
    $("movePad").firstElementChild.style.transform = "";
    if (G.guard) G.guard.held = false;
    G.human.move.set(0, 0);
  }
  function pause() {
    if (!playing) return;
    playing = false;
    acc = 0;
    resetInput();
    onCheckpoint(G.checkpoint());
    modal.hidden = false;
    modal.innerHTML =
      '<h2>잠시 멈췄습니다</h2><p>다시 시작하거나 다른 모드를 고를 수 있습니다.</p><button class="primary" id="resumeBattle">계속 싸우기</button><button id="leaveBattle">처음으로</button>';
    $("resumeBattle").onclick = () => {
      playing = true;
      modal.hidden = true;
      last = performance.now();
    };
    $("leaveBattle").onclick = onLeave;
  }
  function finish(r) {
    result = r;
    playing = false;
    acc = 0;
    resetInput();
    onCheckpoint(G.checkpoint());
    const saved = onComplete(result);
    modal.hidden = false;
    modal.innerHTML = `<h2>${r.win ? "승리" : "패배"}</h2><p>${r.members.map((m) => `${shortName(m.id)} · ${m.status === "dead" ? conditionName(m) : `체력 ${Math.round(m.hp)}%`}`).join("<br>")}</p><p>${saved ? "대련을 마쳤습니다." : "결과를 저장하지 못했습니다. 다시 시도해 주십시오."}</p><button class="primary" id="saveResult">${saved ? "처음으로" : "다시 저장"}</button>`;
    $("saveResult").onclick = () => {
      if (saved || onComplete(result)) onLeave();
    };
  }
  $("viewMode").onclick=()=>{view=view==="wide"?"player":"wide";orbit.enabled=view==="wide";if(view==="wide"){camera.position.set(-18,14,18);orbit.target.set(0,0,0);}$("viewMode").textContent=view==="wide"?"인물 시점":"전체 보기";};
  for(const [id,mode]of [["exploreMode","explore"],["duelMode","duel"],["teamMode","team"]])$(id).onclick=()=>{const u=new URL(location.href);u.searchParams.set("mode",mode);location.href=u;};
  $("battleGo").onclick = () => {
    view="player";orbit.enabled=false;$("viewMode").textContent="전체 보기";
    sound.unlock();
    modal.hidden = true;
    playing = true;
    last = performance.now();
  };
  $("battlePause").onclick = pause;
  $("targetNext").onclick = () => G.targetNext();
  listen($("guardButton"), "pointerdown", (e) => {
    e.preventDefault();
    guardHeld = true;
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    listen($("guardButton"), ev, () => (guardHeld = false));
  listen(canvas, "pointerdown", (e) => {
    if (!playing || drag || view === "wide") return;
    canvas.setPointerCapture(e.pointerId);
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      sx: e.clientX,
      sy: e.clientY,
      t: performance.now(),
      dist: 0,
    };
  });
  listen(canvas, "pointermove", (e) => {
    if (!playing || drag?.id !== e.pointerId) return;
    const d = mapMobileHandDelta({
      dx: e.clientX - drag.x,
      dy: e.clientY - drag.y,
      height: innerHeight,
      sensitivity: INPUT.touchSensitivity,
      pointerType: e.pointerType,
      verticalGain: 1.35,
    });
    dx += d.x;
    dy += d.y;
    drag.dist += Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  listen(canvas, "pointerup", (e) => {
    if (drag?.id === e.pointerId) {
      if (performance.now() - drag.t < INPUT.tapMs && drag.dist < INPUT.tapPx)
        taps++;
      drag = null;
    }
  });
  listen(canvas, "pointercancel", () => (drag = null));
  const pad = $("movePad"),
    knob = pad.firstElementChild;
  function moveStick(e) {
    const r = pad.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / 40,
      y = (e.clientY - r.top - r.height / 2) / 40,
      l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    stick = { x: Math.abs(x) < 0.1 ? 0 : x, y: Math.abs(y) < 0.1 ? 0 : -y };
    knob.style.transform = `translate(${x * 32}px,${y * 32}px)`;
  }
  listen(pad, "pointerdown", (e) => {
    if (!playing) return;
    stickId = e.pointerId;
    pad.setPointerCapture(stickId);
    moveStick(e);
  });
  listen(pad, "pointermove", (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(pad, ev, () => {
      stickId = null;
      stick = { x: 0, y: 0 };
      knob.style.transform = "";
    });
  listen(window, "keydown", (e) => {
    if (
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "KeyF",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(e.code)
    ) {
      keys.add(e.code);
      e.preventDefault();
    }
    if (e.code === "Tab" && playing) {
      e.preventDefault();
      G.targetNext();
    }
    if (e.code === "Escape") pause();
  });
  listen(window, "keyup", (e) => keys.delete(e.code));
  listen(window, "blur", pause);
  listen(document, "visibilitychange", () => {
    if (document.hidden) pause();
  });
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  const vp = new THREE.Vector3(),
    camPos = new THREE.Vector3(),
    focus = new THREE.Vector3();
  function frame(t) {
    if (disposed) return;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (playing) {
      if (!G.human.alive) G.takeControl();
      const h = G.human,
        g = G.guard;
      const swipe = Math.hypot(dx, dy) / Math.max(dt, 0.008) > SKILL.swingSpeed,
        S = G.secret;
      let busy = h.stamina.exhausted || !!h.skill.secretPhase;
      const move = {
        x: stick.x + (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
        y: stick.y + (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
      };
      const spin = S?.spinStick(dt, move, !busy && h.alive),
        circle = S?.spinCircle(dt, { x: dx, y: dy }, !!drag, !busy && h.alive);
      if (
        !busy &&
        h.alive &&
        ((((S?.open && !S.stickOwns() && !S.circleOwns()) ||
          (S?.S?.do?.gilmok && S?.gilArm?.armed)) &&
          (taps || (swipe && !S?.S?.do?.tapOnly))) ||
          spin ||
          circle)
      ) {
        const o = S.open ? S.fire() : S.fireArmed();
        if (o) {
          o.dir = [dx, dy];
          busy = !!h.skill.secret(o);
        }
      }
      if (!busy && h.alive && (taps || swipe) && S?.canBuffer())
        S.buffer([dx, dy]);
      const buffered = !busy && !!S?.bufferHold;
      if (busy || buffered) taps = 0;
      h.skill.uniq?.feed(
        dx,
        dy,
        dt,
        guardHeld || keys.has("KeyF") || buffered || busy,
      );
      if (g) {
        g.held = guardHeld || keys.has("KeyF");
        if (
          g.broken &&
          (!g.held || (!h.skill.swinging && !h.skill.tap && !swipe && !taps))
        )
          g.broken = false;
        if (g.held && (swipe || taps)) g.broken = true;
      }
      if (h.alive && !h.stamina.exhausted) {
        if (!busy && !buffered && (!g?.held || g.broken)) {
          h.handOffset.x += dx;
          h.handOffset.y += dy;
        }
        h.handHeld = !!drag;
        h.inputActive =
          !busy && !buffered && Math.abs(dx) + Math.abs(dy) > 1e-5;
        if (taps) h.skill.thrust();
        let mx =
            stick.x +
            (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
          my =
            stick.y +
            (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
            (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
          l = Math.max(1, Math.hypot(mx, my));
        if (h.skill.secretPhase === "stiff") mx = my = 0;
        h.move.set(mx / l, my / l);
        h.stickX = mx / l;
        h.stickY = my / l;
      } else h.move.set(0, 0);
      dx = dy = taps = 0;
      acc += dt*TIME.tempo;
      let steps = 0;
      while (acc >= PHYSICS.timestep && steps++ < 6) {
        const ps=performance.now(); G.step(); window.__ford.metrics.physicsStepMs=performance.now()-ps;
        trailGroups.forEach((x) => x.sample(PHYSICS.timestep));
        tickDebris(PHYSICS.timestep);
        acc -= PHYSICS.timestep;
        const r = G.result();
        if (r) {
          finish(r);
          break;
        }
      }
      if (steps >= 6) acc = 0;
      if (G.elapsed - lastSave > 3) {
        onCheckpoint(G.checkpoint());
        lastSave = G.elapsed;
      }
    }
    G.fighters.forEach((f) => f.syncMeshes());
    arena.update?.(dt);
    trailGroups.forEach((x) => x.update(dt));
    extras.forEach((e) => e.update?.(dt));
    root.querySelector(".battle-title").textContent =
      `수도 근교 여울`;
    const h = G.human,
      p = h.bodies.pelvis.translation(),
      foe = h.foe?.bodies.pelvis.translation() || { x: p.x + 2, y: 1, z: p.z };
    let vx = foe.x - p.x,
      vz = foe.z - p.z,
      len = Math.max(0.1, Math.hypot(vx, vz));
    vx /= len;
    vz /= len;
    if(view==='wide'){orbit.update();}else{
      if(pending.mode==='explore'){vx=1;vz=0;}
      focus.set(p.x+vx*2.2,1.05+TERRAIN.heightAt(p.x,p.z),p.z+vz*2.2);
      camPos.set(p.x-vx*5.6-vz*.9,3.5+TERRAIN.heightAt(p.x,p.z),p.z-vz*5.6+vx*.9);
      camera.position.lerp(camPos,Math.min(1,dt*5));camera.lookAt(focus);
    }
    camera.updateMatrixWorld();
    for (const f of G.fighters) {
      const hp = f.bodies.head.translation();
      vp.set(hp.x, hp.y + 0.38, hp.z).project(camera);
      const el = labels.get(f);
      el.hidden = vp.z > 1 || vp.z < -1;
      el.style.left = `${((vp.x + 1) / 2) * canvas.clientWidth}px`;
      el.style.top = `${((1 - vp.y) / 2) * canvas.clientHeight}px`;
      el.firstElementChild.textContent = `${f === G.human ? "◆ " : ""}${f.name}${!f.alive ? (f.causeOfDeath === "기절" ? " · 기절" : " · 전사") : ""}`;
      el.lastElementChild.style.width = `${Math.max(0, f.stamina.ratio) * 55}px`;
    }
    for (const team of [0, 1])
      $(team ? "foeHud" : "allyHud").innerHTML = G.fighters
        .filter((f) => f.eventTeam === team)
        .map(
          (f) =>
            `<span class="battle-fighter ${team ? "foe" : ""}">${f.name} ${f.alive ? Math.round(f.blood * 100) + "%" : f.causeOfDeath === "기절" ? "기절" : "전사"}</span>`,
        )
        .join("");
    const ts=performance.now();renderer.render(scene, camera);
    window.__ford.metrics.renderMs=performance.now()-ts;window.__ford.metrics.calls=renderer.info.render.calls;window.__ford.metrics.triangles=renderer.info.render.triangles;
    window.__ford.metrics.surface=G.human.surfaceSpeedScale;
    raf = requestAnimationFrame(frame);
  }
  window.__ford={G,scene,camera,renderer,arena,orbit,metrics:{},get playing(){return playing;},setView(v){view=v;orbit.enabled=v==="wide";},setPlaying(v){playing=v;modal.hidden=v;last=performance.now();},relocate(x,z){const f=G.human,p=f.bodies.pelvis.translation(),h=TERRAIN.heightAt(x,z)-TERRAIN.heightAt(p.x,p.z);for(const b of Object.values(f.bodies)){const q=b.translation();b.setTranslation({x:q.x+x-p.x,y:q.y+h,z:q.z+z-p.z},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);}},get view(){return view;}};
  raf = requestAnimationFrame(frame);
  return {
    G,
    pause,
    get playing() {
      return playing;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      cancelAnimationFrame(raf);
      events.abort();
      ro.disconnect();
      resetInput();
      sound.on = false;
      sound.ctx?.close();
      for (const t of sound._timers || []) clearTimeout(t);
      extras.forEach((x) => x.dispose?.());
      clearDebris();
      orbit.dispose();
      arena.dispose();
      G.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
