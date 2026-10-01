// Read-only support evidence from Rapier's current narrow phase; no gait/load cache.
// farmO is a forearm collider proxy, not a finger/hand rigid body.
const GROUPS = Object.freeze({ footF: ['footF'], footB: ['footB'], shinF: ['shinF'], shinB: ['shinB'], handO: ['farmO'] });
const V = (v) => ({ x: v.x, y: v.y, z: v.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
function rotate(q, local) {
  const t = scale(cross(q, local), 2), r = cross(q, t);
  return { x: local.x + q.w * t.x + r.x, y: local.y + q.w * t.y + r.y, z: local.z + q.w * t.z + r.z };
}
function multiplyQ(a, b) {
  return { x: a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y, y: a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x, z: a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w, w: a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z };
}
// Native collider world poses can lag a body setter until the next physics step.
function currentPose(collider) {
  const body = collider.parent(), local = collider.translationWrtParent(), localRotation = collider.rotationWrtParent();
  if (body && local && localRotation) {
    const p = body.translation(), q = body.rotation(), r = rotate(q, local);
    return { p: { x:p.x+r.x, y:p.y+r.y, z:p.z+r.z }, q: multiplyQ(q, localRotation) };
  }
  return { p: V(collider.translation()), q: collider.rotation() };
}
function worldPoint(pose, local) {
  const r = rotate(pose.q, local);
  return { x:pose.p.x+r.x, y:pose.p.y+r.y, z:pose.p.z+r.z };
}
function poseMismatch(collider, pose) {
  const p = collider.translation(), q = collider.rotation(), sign = q.x*pose.q.x+q.y*pose.q.y+q.z*pose.q.z+q.w*pose.q.w < 0 ? -1 : 1;
  return Math.hypot(p.x-pose.p.x,p.y-pose.p.y,p.z-pose.p.z)>1e-6 || Math.max(...['x','y','z','w'].map(k=>Math.abs(q[k]-sign*pose.q[k])))>1e-6;
}
const valid = (x) => !!x && (typeof x.isValid !== 'function' || x.isValid());
const finiteVector = (x) => !!x && Number.isFinite(x.x) && Number.isFinite(x.y) && Number.isFinite(x.z);
function velocityAt(body, point) { return body ? V(body.velocityAtPoint(point)) : { x: 0, y: 0, z: 0 }; }

/**
 * collectSupportContacts(fighter, {contactSlopM=1e-4, up={x:0,y:1,z:0}, detail=true})
 * returns a fresh object on every call. Call after world.step for current engine manifolds.
 * touchingEnvironment requires a non-sensor static/kinematic non-fighter collider,
 * an engine solver point within slop, AND an engine geometry contact whose reported
 * distance and freshly transformed surface gap are within slop. Positive prediction
 * distances stay distinct from penetrating/touching distances; slop is geometric tolerance.
 * hasSupport adds normalTowardBody dot up > 1e-6; impulse positivity is separately reported.
 * Raw impulse entries and native solver points are separate arrays, never index-matched.
 * Raw impulse/dt is retained without load calibration (in particular no 6/7 correction).
 * Current-body + collider-local poses also handle deferred collider transforms after setters.
 * A fresh read-only shape query is used only for pose/normal/tangential stale evidence
 * (or verifyCurrentShape:'always' for reference validation); synchronized manifolds use no new shape query.
 * Deleting a collider or separating its current geometry cannot retain support in this getter.
 */
export function collectSupportContacts(fighter, options = {}) {
  if (!fighter?.world || !fighter.bodies) throw new TypeError('A fighter with world and bodies is required.');
  const world = fighter.world, slop = options.contactSlopM ?? 1e-4, detail = options.detail !== false;
  if (!(slop >= 0) || !Number.isFinite(slop)) throw new RangeError('contactSlopM must be finite and nonnegative.');
  const inputUp = options.up ?? { x: 0, y: 1, z: 0 }, length = Math.hypot(inputUp.x, inputUp.y, inputUp.z);
  if (!(length > 0) || !Number.isFinite(length)) throw new RangeError('up must be a finite nonzero vector.');
  const up = scale(inputUp, 1 / length), dt = world.timestep;
  const fighterBodies = new Set();
  for (const f of [fighter, fighter.foe].filter(Boolean)) {
    for (const b of Object.values(f.bodies || {})) if (b) fighterBodies.add(b.handle);
    for (const b of [f.sword, f.anchor]) if (b) fighterBodies.add(b.handle);
  }
  const groups = {};
  const diagnostics = { manifolds: 0, freshShapeQueries: 0 };
  for (const [name, parts] of Object.entries(GROUPS)) {
    const group = { parts: [...parts], available: false, detached: false, touchingEnvironment: false, hasSupport: false,
      rawNormalImpulseNs: 0, rawNormalForceN: 0, supportRawNormalImpulseNs: 0, contacts: [] };
    if (name === 'handO') group.proxy = 'farmO forearm collider; no separate hand/fingers';
    for (const part of parts) {
      const body = fighter.bodies[part];
      if (fighter.detachedParts?.has(part)) { group.detached = true; continue; }
      if (!valid(body)) continue;
      group.available = true;
      for (let ci = 0; ci < body.numColliders(); ci++) {
        const own = body.collider(ci);
        if (!valid(own) || own.isSensor()) continue;
        world.contactPairsWith(own, (other) => {
          if (!valid(other)) return;
          const environmentBody = other.parent(), info = fighter.colliderInfo?.get(other.handle);
          const fighterCollider = !!info?.fighter || (environmentBody && fighterBodies.has(environmentBody.handle));
          const fixed = environmentBody ? valid(environmentBody) && environmentBody.isFixed() : true;
          const kinematic = valid(environmentBody) && environmentBody.isKinematic();
          const environment = !other.isSensor() && !fighterCollider && (!!fixed || !!kinematic);
          const ownPose = currentPose(own), otherPose = currentPose(other);
          const posesUnsynchronized = poseMismatch(own, ownPose) || poseMismatch(other, otherPose);
          let pairFreshShape; // per-call/per-pair only, never retained across getter calls
          const readFreshShape = () => {
            if (pairFreshShape === undefined) {
              diagnostics.freshShapeQueries++;
              pairFreshShape = own.shape.contactShape(ownPose.p, ownPose.q, other.shape, otherPose.p, otherPose.q, slop);
            }
            return pairFreshShape;
          };
          world.contactPair(own, other, (manifold, flipped) => {
            diagnostics.manifolds++;
            const rawNormal = V(manifold.normal());
            // Rapier normal points canonical first -> second; flipped means own is second.
            const normalTowardBody = scale(rawNormal, flipped ? 1 : -1);
            const alignment = dot(normalTowardBody, up);
            let freshContact = false, solverWithinSlop = false, engineTouching = false, freshTouching = false, tangentGeometryStale = false;
            let rawImpulse = 0, rawTangentX = 0, rawTangentY = 0, minimumFreshGapM = null, minimumSolverDistanceM = null;
            const geometryContacts = [], impulseEntries = [], solverPoints = [];
            for (let i = 0; i < manifold.numContacts(); i++) {
              const reportedDistanceM = manifold.contactDist(i), localBody = flipped ? manifold.localContactPoint2(i) : manifold.localContactPoint1(i), localEnvironment = flipped ? manifold.localContactPoint1(i) : manifold.localContactPoint2(i);
              let pointBody = null, pointEnvironment = null, freshNormalGapM = null;
              if (finiteVector(localBody) && finiteVector(localEnvironment)) {
                pointBody = worldPoint(ownPose, localBody); pointEnvironment = worldPoint(otherPose, localEnvironment);
                const separation = sub(pointBody, pointEnvironment);
                freshNormalGapM = dot(separation, normalTowardBody);
                const tangent = sub(separation, scale(normalTowardBody, freshNormalGapM));
                tangentGeometryStale ||= Math.hypot(tangent.x, tangent.y, tangent.z) > Math.max(slop, 1e-6);
                if (Number.isFinite(freshNormalGapM)) {
                  minimumFreshGapM = minimumFreshGapM === null ? freshNormalGapM : Math.min(minimumFreshGapM, freshNormalGapM);
                  freshContact ||= Number.isFinite(reportedDistanceM) && reportedDistanceM <= slop && freshNormalGapM <= slop;
                  freshTouching ||= freshNormalGapM <= 0;
                }
              }
              engineTouching ||= Number.isFinite(reportedDistanceM) && reportedDistanceM <= 0;
              const normalImpulseNs = manifold.contactImpulse(i), tangentImpulseXNs = manifold.contactTangentImpulseX(i), tangentImpulseYNs = manifold.contactTangentImpulseY(i);
              rawImpulse += normalImpulseNs; rawTangentX += tangentImpulseXNs; rawTangentY += tangentImpulseYNs;
              if (detail) {
                geometryContacts.push({ localBody: localBody && V(localBody), localEnvironment: localEnvironment && V(localEnvironment), pointBody, pointEnvironment, reportedDistanceM, freshNormalGapM,
                  predictionContact: reportedDistanceM > 0, withinSlop: Number.isFinite(freshNormalGapM) && reportedDistanceM <= slop && freshNormalGapM <= slop });
                impulseEntries.push({ normalImpulseNs, tangentImpulseXNs, tangentImpulseYNs, reportedDistanceM });
              }
            }
            let representativePoint = null;
            for (let i = 0; i < manifold.numSolverContacts(); i++) {
              const point = V(manifold.solverContactPoint(i)), distanceM = manifold.solverContactDist(i), withinSlop = Number.isFinite(distanceM) && distanceM <= slop;
              if (Number.isFinite(distanceM)) minimumSolverDistanceM = minimumSolverDistanceM === null ? distanceM : Math.min(minimumSolverDistanceM, distanceM);
              solverWithinSlop ||= withinSlop;
              if (!representativePoint || withinSlop) representativePoint = point;
              if (detail) {
                const pointVelocityBody = velocityAt(body, point), pointVelocityEnvironment = velocityAt(environmentBody, point), relativeVelocity = sub(pointVelocityBody, pointVelocityEnvironment), normalSpeedMps = dot(relativeVelocity, normalTowardBody), tangent = sub(relativeVelocity, scale(normalTowardBody, normalSpeedMps));
                solverPoints.push({ point, distanceM, predictionContact: distanceM > 0, withinSlop, pointVelocityBody, pointVelocityEnvironment, relativeVelocity, normalSpeedMps, relativeTangentialSpeedMps: Math.hypot(tangent.x, tangent.y, tangent.z) });
              }
            }
            const canonicalPose = flipped ? otherPose : ownPose;
            const currentCanonicalNormal = rotate(canonicalPose.q, manifold.localNormal1());
            const normalGeometryStale = Math.hypot(currentCanonicalNormal.x-rawNormal.x,currentCanonicalNormal.y-rawNormal.y,currentCanonicalNormal.z-rawNormal.z)>1e-6;
            const freshShapeNeeded = posesUnsynchronized || tangentGeometryStale || normalGeometryStale || options.verifyCurrentShape === 'always';
            const freshShape = freshShapeNeeded ? readFreshShape() : null;
            const freshShapeWithinSlop = !freshShapeNeeded || (!!freshShape && Number.isFinite(freshShape.distance) && freshShape.distance <= slop);
            const freshShapeNormalAlignment = freshShape ? dot(freshShape.normal2, up) : null;
            const touchingEnvironment = environment && solverWithinSlop && freshContact && freshShapeWithinSlop;
            const hasSupport = touchingEnvironment && alignment > 1e-6 && (freshShapeNormalAlignment === null || freshShapeNormalAlignment > 1e-6);
            const contact = { part, bodyHandle: body.handle, colliderHandle: own.handle, environmentBodyHandle: environmentBody?.handle ?? null, environmentColliderHandle: other.handle,
              environmentBodyType: fixed ? (environmentBody ? 'fixed' : 'fixed-unattached') : kinematic ? 'kinematic' : environmentBody ? 'dynamic' : 'none', fixed: !!fixed, kinematic: !!kinematic, fighterCollider, sensor: other.isSensor(), isEnvironment: environment,
              flipped, normalRaw: rawNormal, normalTowardBody, normalTowardEnvironment: scale(normalTowardBody, -1), normalAlignmentWithUp: alignment, geometryContactCount: manifold.numContacts(), solverPointCount: manifold.numSolverContacts(), minimumFreshGapM, minimumSolverDistanceM,
              engineTouching, freshTouching, solverWithinSlop, freshContactWithinSlop: freshContact, posesUnsynchronized, tangentGeometryStale, normalGeometryStale, freshShapeNeeded, freshShapeWithinSlop, freshShapeNormalAlignment, touchingEnvironment, hasSupport,
              rawNormalImpulseNs: rawImpulse, rawNormalImpulseOnBodyNs: scale(normalTowardBody, rawImpulse), rawNormalImpulseOnEnvironmentNs: scale(normalTowardBody, -rawImpulse), rawNormalForceN: dt > 0 ? rawImpulse / dt : 0, rawTangentImpulseXNs: rawTangentX, rawTangentImpulseYNs: rawTangentY,
              loaded: hasSupport && rawImpulse > 0, representativeSolverPoint: representativePoint, calibrationApplied: false };
            if (detail) Object.assign(contact, { currentShapeContact: freshShape ? { distanceM: freshShape.distance, pointBody: V(freshShape.point1), pointEnvironment: V(freshShape.point2), normalTowardBody: V(freshShape.normal2) } : null, geometryContacts, rawImpulseEntries: impulseEntries, solverPoints, arrayCorrespondence: 'Geometry/impulse entries and solver points are separate arrays; no index correspondence asserted.' });
            group.contacts.push(contact); group.touchingEnvironment ||= touchingEnvironment; group.hasSupport ||= hasSupport;
            if (touchingEnvironment) group.rawNormalImpulseNs += rawImpulse;
            if (hasSupport) group.supportRawNormalImpulseNs += rawImpulse;
          });
        });
      }
    }
    group.rawNormalForceN = dt > 0 ? group.rawNormalImpulseNs / dt : 0;
    groups[name] = group;
  }
  return { dt, solverIterations: world.integrationParameters.numSolverIterations, up, contactSlopM: slop, groups, diagnostics, anyEnvironmentTouch: Object.values(groups).some(g => g.touchingEnvironment), anySupport: Object.values(groups).some(g => g.hasSupport),
    queryTiming: 'Current Rapier narrow phase from latest world.step; freshly transformed local surface gaps additionally reject separated geometry.', rawImpulseDefinition: 'Native contactImpulse sum, uncalibrated; solver points are a separate native array.' };
}
