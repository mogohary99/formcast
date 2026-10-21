#!/usr/bin/env node
/**
 * Validation report for a real landmark recording against manually counted reps.
 *
 * Usage: node analyze-session.js <session.json> [--manual squat=8,pushup=0,jumpingjack=10] [--json]
 *
 * Reports, per exercise segment: frames, duration, effective frame rate, landmark-visibility dropouts,
 * calibration time, auto-counted reps vs manual, per-rep form scores (min/median/max), and the cues seen.
 * It never adjusts anything: discrepancies are printed as-is for the owner to review.
 */
import { readFileSync } from "node:fs";
import { createCounters, L } from "./public/cam/counters.js";

const NEEDED = { squat: [L.LHIP, L.LKNEE, L.LANK], lunge: [L.LHIP, L.LKNEE, L.LANK], pushup: [L.LSH, L.LEL, L.LWR], jumpingjack: [L.LSH, L.RSH, L.LANK, L.RANK] };

export function analyze(session, manual = {}) {
  const counters = createCounters();
  const segs = [];
  let seg = null;
  for (const f of session.frames) {
    if (!seg || seg.exercise !== f.ex) {
      counters[f.ex]?.reset();
      seg = { exercise: f.ex, first_ms: f.t, last_ms: f.t, frames: 0, dropouts: 0, reps: 0, forms: [], rep_times_ms: [], cues: {}, calibrated_at_ms: null, baseline: null, thresholds: null };
      segs.push(seg);
    }
    const c = counters[f.ex];
    if (!c) continue;
    const lm = f.lm.map(([x, y, visibility]) => ({ x, y, visibility }));
    const visible = (NEEDED[f.ex] ?? []).every((i) => (lm[i]?.visibility ?? 1) > 0.5);
    if (!visible) seg.dropouts++;
    const before = c.reps;
    c.update(lm, f.t);
    seg.frames++; seg.last_ms = f.t;
    if (c.ready && seg.calibrated_at_ms == null) { seg.calibrated_at_ms = f.t; seg.baseline = c.baseline ?? null; seg.thresholds = c.downBelow != null ? { down_below: +c.downBelow.toFixed(1), up_above: +c.upAbove.toFixed(1) } : null; }
    if (c.reps > before) { seg.forms.push(c.form); seg.rep_times_ms.push(f.t); }
    if (c.cue) seg.cues[c.cue] = (seg.cues[c.cue] ?? 0) + 1;
    seg.reps = c.reps;
  }
  return segs.map((s) => {
    const dur = (s.last_ms - s.first_ms) / 1000;
    const sorted = [...s.forms].sort((a, b) => a - b);
    const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const man = manual[s.exercise];
    const gaps = s.rep_times_ms.slice(1).map((t, i) => t - s.rep_times_ms[i]);
    return {
      exercise: s.exercise, frames: s.frames, duration_s: +dur.toFixed(1), fps: dur > 0 ? +(s.frames / dur).toFixed(1) : null,
      dropout_frames: s.dropouts, dropout_pct: s.frames ? +((100 * s.dropouts) / s.frames).toFixed(1) : null,
      calibrated_after_ms: s.calibrated_at_ms != null ? s.calibrated_at_ms - s.first_ms : null, baseline_deg: s.baseline != null ? +s.baseline.toFixed(1) : null, thresholds: s.thresholds,
      auto_reps: s.reps, manual_reps: man ?? null, diff: man != null ? s.reps - man : null,
      form: { count: s.forms.length, min: sorted[0] ?? null, median: med, max: sorted[sorted.length - 1] ?? null, all: s.forms },
      rep_interval_ms: gaps.length ? { min: Math.min(...gaps), max: Math.max(...gaps) } : null,
      cues: s.cues,
    };
  });
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node analyze-session.js <session.json> [--manual squat=8,pushup=0] [--json]"); process.exit(2); }
  const mi = process.argv.indexOf("--manual");
  const manual = mi > 0 ? Object.fromEntries(process.argv[mi + 1].split(",").map((kv) => { const [k, v] = kv.split("="); return [k.trim(), Number(v)]; })) : {};
  const session = JSON.parse(readFileSync(file, "utf8"));
  const out = analyze(session, manual);
  if (process.argv.includes("--json")) { console.log(JSON.stringify({ source: session.source, recorded_at: session.recorded_at, segments: out }, null, 2)); process.exit(0); }
  console.log(`${file}: source=${session.source ?? "?"} recorded_at=${session.recorded_at ?? "?"} frames=${session.frames.length}`);
  for (const s of out) {
    console.log(`\n${s.exercise}: ${s.frames} frames, ${s.duration_s}s @ ${s.fps} fps, dropouts ${s.dropout_frames} (${s.dropout_pct}%), calibrated after ${s.calibrated_after_ms} ms (baseline ${s.baseline_deg}°, thresholds ${JSON.stringify(s.thresholds)})`);
    console.log(`  reps: auto ${s.auto_reps}${s.manual_reps != null ? ` vs manual ${s.manual_reps} (diff ${s.diff >= 0 ? "+" : ""}${s.diff})` : " (no manual count given)"}`);
    console.log(`  form: n=${s.form.count} min ${s.form.min} median ${s.form.median} max ${s.form.max} all [${s.form.all.join(", ")}]`);
    if (s.rep_interval_ms) console.log(`  rep interval: ${s.rep_interval_ms.min}–${s.rep_interval_ms.max} ms`);
    console.log(`  cues: ${Object.entries(s.cues).map(([k, v]) => `${k} ×${v}`).join(" | ")}`);
  }
}
