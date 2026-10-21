import { test } from "node:test";
import assert from "node:assert/strict";
import { replay } from "./replay.js";
import { L } from "./public/cam/counters.js";

/** Synthetic session in the recorder's file format: standing calibration, then 3 squats, then 2 jumping jacks. */
function lm(overrides = {}) {
  const base = {};
  const set = (i, x, y) => (base[i] = [x, y, 1]);
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
const jackOut = lm({ [L.LWR]: [0.35, -0.1, 1], [L.RWR]: [0.65, -0.1, 1], [L.LANK]: [0.26, 0.95, 1], [L.RANK]: [0.74, 0.95, 1] });

function session() {
  const frames = []; let t = 0;
  const push = (ex, f, n, dt = 100) => { for (let i = 0; i < n; i++) { t += dt; frames.push({ t, ex, lm: f }); } };
  push("squat", standing, 15);
  for (let r = 0; r < 3; r++) { push("squat", deep, 4); push("squat", standing, 4); }
  push("jumpingjack", standing, 15);
  for (let r = 0; r < 2; r++) { push("jumpingjack", jackOut, 3); push("jumpingjack", standing, 3); }
  return { version: 1, recorded_at: "2026-10-22T00:00:00Z", room: "TEST", source: "synthetic-fixture", frames };
}

test("replay() runs a recorded session through the counters and reports reps and form per exercise segment", () => {
  const out = replay(session());
  assert.equal(out.length, 2);
  assert.equal(out[0].exercise, "squat");
  assert.equal(out[0].reps, 3);
  assert.equal(out[0].forms.length, 3);
  assert.ok(out[0].forms.every((f) => f >= 70), `deep squats score well: ${out[0].forms}`);
  assert.ok(out[0].calibrated_at_ms <= 1500, "calibration finishes after ~15 frames");
  assert.equal(out[1].exercise, "jumpingjack");
  assert.equal(out[1].reps, 2);
  assert.ok(out[1].avg_form >= 90, `full jacks score well: ${out[1].avg_form}`);
});
