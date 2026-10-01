// Regression: Gait.update calls tiltDeg while driveBalance still needs its forward axis.
import assert from 'node:assert/strict';
import { newRound, DT, THREE } from './harness_m.mjs';

let cases = 0;
for (const heading of [0, Math.PI / 2, Math.PI, -0.7]) {
  for (const tilt of [0, 0.3, -0.6]) {
    for (const velocity of [[1, 0, 0], [0, 0, -1], [-0.7, 0.2, 0.4]]) {
      const G = newRound({ seed: 1, walls: false });
      try {
        const f = G.player;
        f.heading = heading;
        f.yaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
        f.bodies.chest.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt), true);
        f.bodies.pelvis.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
        const expectedFwd = f.forward(new THREE.Vector3());
        const expectedRight = f.right(new THREE.Vector3());
        const update = f.gait.update;
        let observed = false;
        f.gait.update = function (dt, want, fwd, right) {
          update.call(this, dt, want, fwd, right);
          observed = true;
          assert.ok(fwd.distanceTo(expectedFwd) < 1e-12, `forward overwritten: heading=${heading}, tilt=${tilt}`);
          assert.ok(right.distanceTo(expectedRight) < 1e-12, 'right overwritten');
        };
        f.driveBalance(DT);
        // Rapier stores velocities as float32; compare with the velocity actually read by the controller.
        const v = new THREE.Vector3().copy(f.bodies.pelvis.linvel());
        const forwardSpeed = v.dot(expectedFwd);
        assert.ok(observed, 'actual Gait.update was not exercised');
        assert.ok(Math.abs(f.localVel.x - forwardSpeed) < 1e-12, 'wrong forward speed');
        assert.ok(Math.abs(f.localVel.y - v.dot(expectedRight)) < 1e-12, 'wrong lateral speed');
        assert.ok(Math.abs(f.lean - THREE.MathUtils.clamp(-forwardSpeed * 0.05, -0.12, 0.12)) < 1e-12, 'wrong lean');
        cases++;
      } finally {
        G.eventQueue.free();
        G.world.free();
      }
    }
  }
}
console.log(JSON.stringify({ test: 'balance axes across real gait update', cases, pass: true }));
