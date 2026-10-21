#!/usr/bin/env node
/**
 * Replay a recorded landmark session through the same rep counters the phone page uses.
 * Usage: node replay.js <session.json> [--json]
 * The file comes from the camera page's "rec" control (relay/public/cam/index.html): one entry per video
 * frame with the elapsed time, the active exercise id and the 33 MediaPipe landmarks as [x, y, visibility].
 * Prints reps, per-rep form scores and cues per exercise segment, so a real workout becomes a reproducible
 * test fixture (see replay.test.js, which checks the harness on a synthetic fixture).
 */
import { readFileSync } from "node:fs";
import { createCounters } from "./public/cam/counters.js";

export function replay(session) {
  const counters = createCounters();
  const segments = [];
  let seg = null;
  for (const f of session.frames) {
    if (!seg || seg.exercise !== f.ex) {
      if (seg) segments.push(seg);
      counters[f.ex]?.reset();
      seg = { exercise: f.ex, frames: 0, reps: 0, forms: [], cues: new Set(), calibrated_at_ms: null };
    }
    const c = counters[f.ex];
    if (!c) continue;
    const lm = f.lm.map(([x, y, visibility]) => ({ x, y, visibility }));
    const before = c.reps;
    c.update(lm, f.t);
    seg.frames++;
    if (c.ready && seg.calibrated_at_ms == null) seg.calibrated_at_ms = f.t;
    if (c.reps > before) seg.forms.push(c.form);
    if (c.cue) seg.cues.add(c.cue);
    seg.reps = c.reps;
  }
  if (seg) segments.push(seg);
  return segments.map((s) => ({ ...s, cues: [...s.cues], avg_form: s.forms.length ? Math.round(s.forms.reduce((a, b) => a + b, 0) / s.forms.length) : null }));
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node replay.js <session.json> [--json]"); process.exit(2); }
  const session = JSON.parse(readFileSync(file, "utf8"));
  const out = replay(session);
  if (process.argv.includes("--json")) console.log(JSON.stringify({ source: session.source, recorded_at: session.recorded_at, segments: out }, null, 2));
  else {
    console.log(`${file}: source=${session.source ?? "?"} recorded_at=${session.recorded_at ?? "?"} frames=${session.frames.length}`);
    for (const s of out) console.log(`  ${s.exercise.padEnd(12)} frames ${String(s.frames).padStart(4)}  reps ${String(s.reps).padStart(3)}  forms [${s.forms.join(", ")}]  avg ${s.avg_form ?? "-"}  calibrated@${s.calibrated_at_ms ?? "-"}ms  cues: ${s.cues.join(" | ")}`);
  }
}
