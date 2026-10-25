import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS, SKILL, INPUT } from "../config.js";
import { Stages } from "../stages.js";
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
}) {
  rapierReady ??= RAPIER.init();
  await rapierReady;
  root.innerHTML = `<style>${style}</style><main class="battle-screen"><canvas aria-label="생사전 동시 전투. 드래그로 베기, 톡 눌러 찌르기"></canvas><div class="battle-top"><div><b class="battle-title">생사전 · 3인의 맹약</b><div class="battle-roster" id="allyHud"></div></div><button id="battlePause">잠시 멈춤</button><div><div class="battle-roster" id="foeHud"></div></div></div><div id="battleLabels"></div><div class="battle-controls"><div class="battle-stick" id="movePad" aria-label="이동 조이스틱"><span class="battle-knob"></span></div><div class="battle-actions"><button id="targetNext">목표 전환</button><button class="guard" id="guardButton">막기</button></div></div><p class="battle-hint">드래그 베기 · 톡 찌르기 · 왼쪽 이동 / PC WASD · F 막기</p><section class="battle-center" id="battleModal"><h2>${pending.allies.length} 대 ${pending.enemies.length}</h2><p>${shortName(pending.allies[0].id)} 직접 조작${pending.allies[1] ? ` · ${shortName(pending.allies[1].id)} AI 동료` : ""}<br>아군에게는 피해를 주지 않습니다.</p><button class="primary" id="battleGo">전투 시작</button></section></main>`;
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
  scene.background = new THREE.Color(0x9caba4);
  scene.fog = new THREE.Fog(0xabb4ae, 18, 60);
  const hemi = new THREE.HemisphereLight(0xe4e5dc, 0x68583f, 1.7),
    sun = new THREE.DirectionalLight(0xffe8bd, 2.5);
  sun.position.set(-3, 8, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;
  scene.add(hemi, sun);
  const stages = new Stages(scene, { hemi, sun }),
    arena = stages.build("poseidon");
  const camera = new THREE.PerspectiveCamera(47, 1, 0.1, 100);
  camera.position.set(-7, 4.5, 6);
  camera.lookAt(0, 1, 0);
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
      '<h2>잠시 멈췄습니다</h2><p>부상과 전투 상태를 저장했습니다.</p><button class="primary" id="resumeBattle">계속 싸우기</button><button id="leaveBattle">대진표로</button>';
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
    modal.innerHTML = `<h2>${r.win ? "승리" : "패배"}</h2><p>${r.members.map((m) => `${shortName(m.id)} · ${m.status === "dead" ? conditionName(m) : `체력 ${Math.round(m.hp)}%`}`).join("<br>")}</p><p>${saved ? "결과를 저장했습니다." : "결과를 저장하지 못했습니다. 다시 시도해 주십시오."}</p><button class="primary" id="saveResult">${saved ? "대진표로" : "다시 저장"}</button>`;
    $("saveResult").onclick = () => {
      if (saved || onComplete(result)) onLeave();
    };
  }
  $("battleGo").onclick = () => {
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
    if (!playing || drag) return;
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
      acc += dt;
      let steps = 0;
      while (acc >= PHYSICS.timestep && steps++ < 6) {
        G.step();
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
      `생사전 · ${G.human.name} 조작 중${G.secret?.open ? " · 비기 준비" : ""}`;
    const h = G.human,
      p = h.bodies.pelvis.translation(),
      foe = h.foe?.bodies.pelvis.translation() || { x: p.x + 2, y: 1, z: p.z };
    let vx = foe.x - p.x,
      vz = foe.z - p.z,
      len = Math.max(0.1, Math.hypot(vx, vz));
    vx /= len;
    vz /= len;
    const live = G.fighters
      .filter((f) => f.alive)
      .map((f) => f.bodies.pelvis.translation());
    const pts = live.length ? live : [p];
    const cx =
        (Math.min(...pts.map((q) => q.x)) + Math.max(...pts.map((q) => q.x))) /
        2,
      cz =
        (Math.min(...pts.map((q) => q.z)) + Math.max(...pts.map((q) => q.z))) /
        2;
    const spread = Math.max(...pts.map((q) => Math.hypot(q.x - cx, q.z - cz)));
    const dist = Math.max(6.7, Math.min(12, 5.5 + spread * 1.2));
    focus.set(cx, 1, cz);
    camPos.set(
      cx - vx * dist - vz * 1.1,
      Math.max(4.5, dist * 0.6),
      cz - vz * dist + vx * 1.1,
    );
    camera.position.lerp(camPos, Math.min(1, dt * 2));
    camera.lookAt(focus);
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
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
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
      stages.clear();
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
