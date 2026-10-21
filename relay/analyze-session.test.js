import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "./analyze-session.js";
import { L } from "./public/cam/counters.js";

function lm(overrides = {}) {
  const base = {};
  const set = (i, x, y, v = 1) => (base[i] = [x, y, v]);
  set(L.NOSE, 0.5, 0.1); set(L.LSH, 0.42, 0.25); set(L.RSH, 0.58, 0.25);
  set(L.LEL, 0.40, 0.40); set(L.REL, 0.60, 0.40); set(L.LWR, 0.40, 0.55); set(L.RWR, 0.60, 0.55);
  set(L.LHIP, 0.45, 0.55); set(L.RHIP, 0.55, 0.55); set(L.LKNEE, 0.45, 0.75); set(L.RKNEE, 0.55, 0.75);
  set(L.LANK, 0.45, 0.95); set(L.RANK, 0.55, 0.95);
  for (const [k, v] of Object.entries(overrides)) base[k] = v;
  const arr = []; for (let i = 0; i < 33; i++) arr[i] = base[i] ?? [0.5, 0.5, 1];
  return arr;
}
const standing = lm();
const deep = lm({ [L.LHIP]: [0.45, 0.72, 1], [L.RHIP]: [0.55, 0.72, 1], [L.LKNEE]: [0.30, 0.80, 1], [L.RKNEE]: [0.70, 0.80, 1] });
const hidden = lm({ [L.LANK]: [0.45, 0.95, 0.1] });

test("analyze() reports fps, dropouts, calibration, auto vs manual reps and form stats without changing anything", () => {
  const frames = []; let t = 0;
  const push = (f, n, dt = 100) => { for (let i = 0; i < n; i++) { t += dt; frames.push({ t, ex: "squat", lm: f }); } };
  push(standing, 15); push(hidden, 3); for (let r = 0; r < 3; r++) { push(deep, 4); push(standing, 4); }
  const out = analyze({ frames, source: "synthetic-fixture" }, { squat: 4 });
  assert.equal(out.length, 1);
  const s = out[0];
  assert.equal(s.exercise, "squat");
  assert.equal(s.frames, 42);
  assert.equal(s.dropout_frames, 3);
  assert.ok(Math.abs(s.fps - 10.2) < 0.05, `fps ${s.fps}`); // 42 frames over 4.1 s of elapsed time
  assert.equal(s.auto_reps, 3);
  assert.equal(s.manual_reps, 4);
  assert.equal(s.diff, -1, "a missed rep is reported as a negative diff, not hidden");
  assert.equal(s.form.count, 3);
  assert.ok(s.form.median >= 70);
  assert.ok(s.calibrated_after_ms <= 1500);
  assert.ok(s.thresholds.down_below < s.thresholds.up_above);
});
