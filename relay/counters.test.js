import { test } from "node:test";
import assert from "node:assert/strict";
import { createCounters, angle, L } from "./public/cam/counters.js";

/** Build a 33-landmark frame from a few joints; unspecified joints default to a neutral standing pose. */
function frame(overrides = {}) {
  const base = {};
  const set = (i, x, y) => (base[i] = { x, y, visibility: 1 });
  set(L.NOSE, 0.5, 0.1);
  set(L.LSH, 0.42, 0.25); set(L.RSH, 0.58, 0.25);
  set(L.LEL, 0.40, 0.40); set(L.REL, 0.60, 0.40);
  set(L.LWR, 0.40, 0.55); set(L.RWR, 0.60, 0.55);
  set(L.LHIP, 0.45, 0.55); set(L.RHIP, 0.55, 0.55);
  set(L.LKNEE, 0.45, 0.75); set(L.RKNEE, 0.55, 0.75);
  set(L.LANK, 0.45, 0.95); set(L.RANK, 0.55, 0.95);
  for (const [k, v] of Object.entries(overrides)) base[k] = { visibility: 1, ...v };
  const arr = [];
  for (let i = 0; i < 33; i++) arr[i] = base[i] ?? { x: 0.5, y: 0.5, visibility: 1 };
  return arr;
}

test("angle() returns 180 for a straight limb and ~90 for a right angle", () => {
  assert.ok(Math.abs(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }) - 180) < 1e-6);
  assert.ok(Math.abs(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }) - 90) < 1e-6);
});

test("squat counter counts a full down/up cycle once and cues shallow depth", () => {
  const c = createCounters().squat;
  const standing = frame();
  // Deep squat: knees forward and hips low → knee angle ~70°
  const deep = frame({ [L.LHIP]: { x: 0.45, y: 0.72 }, [L.RHIP]: { x: 0.55, y: 0.72 }, [L.LKNEE]: { x: 0.30, y: 0.80 }, [L.RKNEE]: { x: 0.70, y: 0.80 } });
  for (let i = 0; i < 5; i++) c.update(standing);
  assert.equal(c.reps, 0);
  c.update(deep);
  assert.equal(c.phase, "down");
  assert.equal(c.cue, "Nice depth");
  c.update(standing);
  assert.equal(c.reps, 1);
  assert.equal(c.phase, "up");
  // Jitter around the bottom must not double count
  c.update(deep); c.update(deep); c.update(standing); c.update(standing);
  assert.equal(c.reps, 2);
});

test("squat counter asks the person to step back when legs are not visible", () => {
  const c = createCounters().squat;
  const f = frame({ [L.LANK]: { x: 0.45, y: 0.95, visibility: 0.1 } });
  c.update(f);
  assert.match(c.cue, /Step back/);
  assert.equal(c.reps, 0);
});

test("push-up counter counts elbow flexion/extension and flags hip sag", () => {
  const c = createCounters().pushup;
  const up = frame({ [L.LWR]: { x: 0.42, y: 0.60 }, [L.RWR]: { x: 0.58, y: 0.60 }, [L.LEL]: { x: 0.42, y: 0.43 }, [L.REL]: { x: 0.58, y: 0.43 } });
  const down = frame({ [L.LWR]: { x: 0.42, y: 0.60 }, [L.RWR]: { x: 0.58, y: 0.60 }, [L.LEL]: { x: 0.25, y: 0.40 }, [L.REL]: { x: 0.75, y: 0.40 }, [L.LSH]: { x: 0.42, y: 0.55 }, [L.RSH]: { x: 0.58, y: 0.55 } });
  c.update(up); assert.equal(c.reps, 0);
  c.update(down); assert.equal(c.phase, "down");
  c.update(up); assert.equal(c.reps, 1);
});

test("jumping jack counter needs hands overhead AND feet wide, then back in", () => {
  const c = createCounters().jumpingjack;
  const inPose = frame();
  const outPose = frame({ [L.LWR]: { x: 0.35, y: 0.02 }, [L.RWR]: { x: 0.65, y: 0.02 }, [L.LANK]: { x: 0.25, y: 0.95 }, [L.RANK]: { x: 0.75, y: 0.95 } });
  const handsOnly = frame({ [L.LWR]: { x: 0.35, y: 0.02 }, [L.RWR]: { x: 0.65, y: 0.02 } });
  c.update(inPose); c.update(handsOnly);
  assert.equal(c.phase, "in", "hands up without feet out is not 'out'");
  c.update(outPose); assert.equal(c.phase, "out");
  c.update(inPose); assert.equal(c.reps, 1);
});
