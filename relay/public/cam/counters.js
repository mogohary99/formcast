/**
 * FormCast rep counters: small, explainable state machines over MediaPipe pose landmarks.
 * Shared by the phone camera page and the Node test-suite.
 */
export const L = { NOSE: 0, LSH: 11, RSH: 12, LEL: 13, REL: 14, LWR: 15, RWR: 16, LHIP: 23, RHIP: 24, LKNEE: 25, RKNEE: 26, LANK: 27, RANK: 28 };
export const EDGES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];

export function angle(a, b, c) { // angle at b in degrees
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
  const dot = v1[0]*v2[0] + v1[1]*v2[1], m = Math.hypot(...v1) * Math.hypot(...v2) || 1e-6;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI;
}
const vis = (p) => (p.visibility ?? 1) > 0.5;

export function createCounters() {
  return {
  squat: { reps: 0, phase: "up", cue: "", update(lm) {
    const k = Math.min(angle(lm[L.LHIP], lm[L.LKNEE], lm[L.LANK]), angle(lm[L.RHIP], lm[L.RKNEE], lm[L.RANK]));
    const ok = vis(lm[L.LHIP]) && vis(lm[L.LKNEE]) && vis(lm[L.LANK]);
    if (!ok) { this.cue = "Step back: show hips to ankles"; return; }
    if (this.phase === "up" && k < 100) { this.phase = "down"; this.cue = k < 80 ? "Nice depth" : "Go a little deeper"; }
    else if (this.phase === "down" && k > 160) { this.phase = "up"; this.reps++; this.cue = "Good rep"; }
    // knees caving: ankles wider than knees by a margin
    const kneeW = Math.abs(lm[L.LKNEE].x - lm[L.RKNEE].x), ankW = Math.abs(lm[L.LANK].x - lm[L.RANK].x);
    if (this.phase === "down" && kneeW < ankW * 0.7) this.cue = "Push knees out";
    return { k };
  } },
  pushup: { reps: 0, phase: "up", cue: "", update(lm) {
    const e = Math.min(angle(lm[L.LSH], lm[L.LEL], lm[L.LWR]), angle(lm[L.RSH], lm[L.REL], lm[L.RWR]));
    const ok = vis(lm[L.LSH]) && vis(lm[L.LEL]) && vis(lm[L.LWR]);
    if (!ok) { this.cue = "Show shoulders, elbows and wrists"; return; }
    if (this.phase === "up" && e < 95) { this.phase = "down"; this.cue = "Lower"; }
    else if (this.phase === "down" && e > 155) { this.phase = "up"; this.reps++; this.cue = "Good rep"; }
    const hipSag = angle(lm[L.LSH], lm[L.LHIP], lm[L.LKNEE]);
    if (hipSag < 150) this.cue = "Keep hips in line";
    return { e };
  } },
  jumpingjack: { reps: 0, phase: "in", cue: "", update(lm) {
    const handsUp = lm[L.LWR].y < lm[L.NOSE].y && lm[L.RWR].y < lm[L.NOSE].y;
    const shW = Math.abs(lm[L.LSH].x - lm[L.RSH].x), ankW = Math.abs(lm[L.LANK].x - lm[L.RANK].x);
    const feetOut = ankW > shW * 1.4;
    if (this.phase === "in" && handsUp && feetOut) { this.phase = "out"; this.cue = "Out"; }
    else if (this.phase === "out" && !handsUp && !feetOut) { this.phase = "in"; this.reps++; this.cue = "Good rep"; }
    return {};
  } },
  lunge: { reps: 0, phase: "up", cue: "", update(lm) {
    const k = Math.min(angle(lm[L.LHIP], lm[L.LKNEE], lm[L.LANK]), angle(lm[L.RHIP], lm[L.RKNEE], lm[L.RANK]));
    if (this.phase === "up" && k < 105) { this.phase = "down"; this.cue = "Hold"; }
    else if (this.phase === "down" && k > 160) { this.phase = "up"; this.reps++; this.cue = "Good rep"; }
    return { k };
  } },
  };
}

export function resetCounter(counters, id) {
  const c = counters[id];
  if (c) { c.reps = 0; c.phase = id === "jumpingjack" ? "in" : "up"; c.cue = ""; }
}
