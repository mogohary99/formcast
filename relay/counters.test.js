import { test } from "node:test";
import assert from "node:assert/strict";
import { createCounters, resetCounter, angle, L, DEFAULTS } from "./public/cam/counters.js";

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

/** Feed frames with a simulated clock (ms between frames). Returns the clock. */
function feed(c, frames, { t = 0, dt = 100 } = {}) {
  for (const f of frames) { t += dt; c.update(f, t); }
  return t;
}
const standing = frame();
// Deep squat: knees forward and hips low → knee angle ~70°
const deep = frame({ [L.LHIP]: { x: 0.45, y: 0.72 }, [L.RHIP]: { x: 0.55, y: 0.72 }, [L.LKNEE]: { x: 0.30, y: 0.80 }, [L.RKNEE]: { x: 0.70, y: 0.80 } });
// Shallow squat: knee angle ~100°
const shallow = frame({ [L.LHIP]: { x: 0.45, y: 0.66 }, [L.RHIP]: { x: 0.55, y: 0.66 }, [L.LKNEE]: { x: 0.33, y: 0.78 }, [L.RKNEE]: { x: 0.67, y: 0.78 } });
const calibrate = (c, pose = standing) => feed(c, Array(DEFAULTS.calibrationFrames).fill(pose));

test("angle() returns 180 for a straight limb and ~90 for a right angle", () => {
  assert.ok(Math.abs(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }) - 180) < 1e-6);
  assert.ok(Math.abs(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }) - 90) < 1e-6);
});

test("calibration learns a standing baseline before counting anything", () => {
  const c = createCounters().squat;
  assert.equal(c.ready, false);
  feed(c, [deep, deep, deep, standing, standing, standing]); // movement during calibration is ignored
  assert.equal(c.reps, 0);
  assert.match(c.cue, /calibrating/);
  calibrate(c);
  assert.equal(c.ready, true);
  assert.equal(c.calib, 1);
  assert.ok(c.baseline > 150, `baseline ${c.baseline}`);
  assert.ok(c.downBelow <= 110 && c.upAbove >= 150);
});

test("squat counter counts a full down/up cycle once, scores depth, and cues shallow reps", () => {
  const c = createCounters().squat;
  let t = calibrate(c);
  t = feed(c, [deep, deep, deep, deep], { t });
  assert.equal(c.phase, "down");
  assert.equal(c.cue, "Nice depth");
  t = feed(c, [standing, standing, standing, standing], { t });
  assert.equal(c.reps, 1);
  assert.equal(c.phase, "up");
  assert.ok(c.form >= 70, `deep rep form ${c.form}`);
  assert.equal(c.cue, "Good rep");
  // Shallow rep scores low and gets a depth cue
  t = feed(c, Array(8).fill(shallow), { t });
  assert.equal(c.phase, "down");
  t = feed(c, Array(5).fill(standing), { t });
  assert.equal(c.reps, 2);
  assert.ok(c.form < 50, `shallow rep form ${c.form}`);
  assert.equal(c.cue, "Go a little deeper");
  assert.ok(c.avgForm > c.form && c.avgForm < 100);
});

test("debounce: jitter across a threshold within minPhaseMs cannot double count", () => {
  const c = createCounters().squat;
  let t = calibrate(c);
  t = feed(c, Array(4).fill(deep), { t });
  t = feed(c, Array(4).fill(standing), { t });
  assert.equal(c.reps, 1);
  // Within 250 ms of the flip, bouncing back below the down threshold must be ignored
  t = feed(c, Array(6).fill(deep), { t, dt: 10 });
  assert.equal(c.phase, "up");
  assert.equal(c.reps, 1);
  // A real second rep (slow enough) still counts
  t = feed(c, Array(4).fill(deep), { t, dt: 100 });
  t = feed(c, Array(4).fill(standing), { t, dt: 100 });
  assert.equal(c.reps, 2);
});

test("squat counter asks the person to step back when legs are not visible", () => {
  const c = createCounters().squat;
  const f = frame({ [L.LANK]: { x: 0.45, y: 0.95, visibility: 0.1 } });
  c.update(f, 1);
  assert.match(c.cue, /Step back/);
  assert.equal(c.reps, 0);
  assert.equal(c.ready, false, "invisible frames do not count toward calibration");
});

test("push-up counter counts elbow flexion/extension and flags hip sag", () => {
  const c = createCounters().pushup;
  const up = frame({ [L.LWR]: { x: 0.42, y: 0.60 }, [L.RWR]: { x: 0.58, y: 0.60 }, [L.LEL]: { x: 0.42, y: 0.43 }, [L.REL]: { x: 0.58, y: 0.43 } });
  const down = frame({ [L.LWR]: { x: 0.42, y: 0.60 }, [L.RWR]: { x: 0.58, y: 0.60 }, [L.LEL]: { x: 0.25, y: 0.40 }, [L.REL]: { x: 0.75, y: 0.40 }, [L.LSH]: { x: 0.42, y: 0.55 }, [L.RSH]: { x: 0.58, y: 0.55 } });
  let t = calibrate(c, up);
  assert.equal(c.reps, 0);
  t = feed(c, Array(4).fill(down), { t });
  assert.equal(c.phase, "down");
  assert.equal(c.cue, "Keep hips in line");
  t = feed(c, Array(4).fill(up), { t });
  assert.equal(c.reps, 1);
});

test("jumping jack counter needs hands overhead AND feet wide, then back in", () => {
  const c = createCounters().jumpingjack;
  const inPose = frame();
  const outPose = frame({ [L.LWR]: { x: 0.35, y: 0.02 }, [L.RWR]: { x: 0.65, y: 0.02 }, [L.LANK]: { x: 0.25, y: 0.95 }, [L.RANK]: { x: 0.75, y: 0.95 } });
  const handsOnly = frame({ [L.LWR]: { x: 0.35, y: 0.02 }, [L.RWR]: { x: 0.65, y: 0.02 } });
  let t = calibrate(c, inPose);
  t = feed(c, [handsOnly], { t });
  assert.equal(c.phase, "in", "hands up without feet out is not 'out'");
  assert.equal(c.cue, "Feet wider");
  t = feed(c, [outPose, outPose], { t });
  assert.equal(c.phase, "out");
  t = feed(c, [inPose, inPose], { t });
  assert.equal(c.reps, 1);
  assert.ok(c.form > 0 && c.form <= 100, `form ${c.form}`);
});

test("jumping jack form scores range of motion: a wide, high jack beats a minimal one", () => {
  const c = createCounters().jumpingjack;
  const inPose = frame();
  // Minimal: feet just past the threshold (1.5× shoulder width), hands barely above the nose.
  const minimal = frame({ [L.LWR]: { x: 0.40, y: 0.09 }, [L.RWR]: { x: 0.60, y: 0.09 }, [L.LANK]: { x: 0.38, y: 0.95 }, [L.RANK]: { x: 0.62, y: 0.95 } });
  // Full: feet 3× shoulder width, hands a full shoulder width above the nose.
  const full = frame({ [L.LWR]: { x: 0.35, y: -0.10 }, [L.RWR]: { x: 0.65, y: -0.10 }, [L.LANK]: { x: 0.26, y: 0.95 }, [L.RANK]: { x: 0.74, y: 0.95 } });
  let t = calibrate(c, inPose);
  t = feed(c, [minimal, minimal, minimal], { t });
  t = feed(c, [inPose, inPose, inPose], { t });
  const small = c.form;
  t = feed(c, [full, full, full], { t });
  t = feed(c, [inPose, inPose, inPose], { t });
  assert.equal(c.reps, 2);
  assert.ok(small < 40, `minimal jack form ${small}`);
  assert.ok(c.form >= 90, `full jack form ${c.form}`);
  assert.ok(c.avgForm > small && c.avgForm < c.form);
});

test("resetCounter clears reps, calibration and form history", () => {
  const counters = createCounters();
  const c = counters.squat;
  let t = calibrate(c);
  t = feed(c, Array(4).fill(deep), { t });
  feed(c, Array(4).fill(standing), { t });
  assert.equal(c.reps, 1);
  resetCounter(counters, "squat");
  assert.equal(c.reps, 0);
  assert.equal(c.ready, false);
  assert.equal(c.form, null);
  assert.deepEqual(c.forms, []);
});
