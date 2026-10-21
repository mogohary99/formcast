/**
 * FormCast rep counters: small, explainable state machines over MediaPipe pose landmarks.
 * Shared by the phone camera page and the Node test-suite (no DOM, no MediaPipe imports).
 *
 * v2 adds what makes counting trustworthy on real bodies and real cameras:
 *   - calibration: the first ~1 s of frames with the needed joints visible sets a standing
 *     baseline per person, so thresholds adapt to leg length, camera height and lens.
 *   - smoothing: joint angles are low-pass filtered (EMA) before thresholds are applied.
 *   - hysteresis + debounce: separate "down" and "up" thresholds and a minimum phase
 *     duration, so jitter around a threshold cannot double-count a rep.
 *   - form score: every rep gets a 0–100 depth/range score relative to the ideal, and a
 *     running average, so the TV can coach quality, not just count.
 */
export const L = { NOSE: 0, LSH: 11, RSH: 12, LEL: 13, REL: 14, LWR: 15, RWR: 16, LHIP: 23, RHIP: 24, LKNEE: 25, RKNEE: 26, LANK: 27, RANK: 28 };
export const EDGES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];

export function angle(a, b, c) { // angle at b in degrees
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
  const dot = v1[0]*v2[0] + v1[1]*v2[1], m = Math.hypot(...v1) * Math.hypot(...v2) || 1e-6;
  return Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180 / Math.PI;
}
const vis = (p) => (p.visibility ?? 1) > 0.5;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const DEFAULTS = {
  calibrationFrames: 15,  // ~1 s at 15 fps
  smoothing: 0.5,         // EMA factor on angles (1 = no smoothing)
  minPhaseMs: 250,        // a phase must last this long before it can flip
};

/**
 * Generic angle-based rep counter.
 *  - `measure(lm)` returns { value, ok, extraCue } where value is the (min) joint angle.
 *  - standing baseline is learned during calibration; `down` fires when value < downBelow,
 *    `up` when value > upAbove (both derived from the baseline, bounded by sane defaults).
 *  - form = how close the deepest point of the rep got to `idealDepth` (angle), 0–100.
 */
function angleCounter({ measure, idealDepth, downOffset, upOffset, downBounds, upBounds, cueDown, cueShallow }, cfg) {
  return {
    reps: 0, phase: "up", cue: "", form: null, forms: [], avgForm: null,
    ready: false, calib: 0, baseline: null, downBelow: downBounds[1], upAbove: upBounds[0],
    _ema: null, _lastFlip: -Infinity, _minInRep: Infinity, _calibSamples: [],
    update(lm, t = nowMs()) {
      const m = measure(lm);
      if (!m.ok) { this.cue = m.visibilityCue; return { ok: false, calibrating: !this.ready }; }
      this._ema = this._ema == null ? m.value : this._ema + cfg.smoothing * (m.value - this._ema);
      const v = this._ema;
      if (!this.ready) {
        this._calibSamples.push(m.value);
        this.calib = this._calibSamples.length / cfg.calibrationFrames;
        this.cue = "Hold still… calibrating";
        if (this._calibSamples.length >= cfg.calibrationFrames) {
          const sorted = [...this._calibSamples].sort((a, b) => a - b);
          this.baseline = sorted[Math.floor(sorted.length / 2)]; // median standing angle
          this.downBelow = clamp(this.baseline - downOffset, downBounds[0], downBounds[1]);
          this.upAbove = clamp(this.baseline - upOffset, upBounds[0], upBounds[1]);
          this.ready = true; this.calib = 1; this.cue = "Ready — go!";
        }
        return { ok: true, calibrating: !this.ready, value: v };
      }
      const canFlip = t - this._lastFlip >= cfg.minPhaseMs;
      if (this.phase === "down") this._minInRep = Math.min(this._minInRep, v);
      if (this.phase === "up" && v < this.downBelow && canFlip) {
        this.phase = "down"; this._lastFlip = t; this._minInRep = v; this.cue = cueDown;
      } else if (this.phase === "down" && v > this.upAbove && canFlip) {
        this.phase = "up"; this._lastFlip = t; this.reps++;
        // 100 = reached the ideal depth; 0 = barely crossed the down threshold.
        const span = Math.max(1, this.downBelow - idealDepth);
        this.form = Math.round(clamp(100 * (this.downBelow - this._minInRep) / span, 0, 100));
        this.forms.push(this.form);
        this.avgForm = Math.round(this.forms.reduce((a, b) => a + b, 0) / this.forms.length);
        this.cue = this.form >= 70 ? "Good rep" : cueShallow;
        this._minInRep = Infinity;
      }
      if (m.extraCue && this.phase === "down") this.cue = m.extraCue;
      return { ok: true, calibrating: false, value: v };
    },
    reset() {
      Object.assign(this, { reps: 0, phase: "up", cue: "", form: null, forms: [], avgForm: null, ready: false, calib: 0, baseline: null, _ema: null, _lastFlip: -Infinity, _minInRep: Infinity, _calibSamples: [] });
      this.downBelow = downBounds[1]; this.upAbove = upBounds[0];
    },
  };
}

function nowMs() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }

export function createCounters(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const kneeAngle = (lm) => Math.min(angle(lm[L.LHIP], lm[L.LKNEE], lm[L.LANK]), angle(lm[L.RHIP], lm[L.RKNEE], lm[L.RANK]));
  return {
    squat: angleCounter({
      measure(lm) {
        const ok = vis(lm[L.LHIP]) && vis(lm[L.LKNEE]) && vis(lm[L.LANK]);
        if (!ok) return { ok: false, visibilityCue: "Step back: show hips to ankles" };
        // knees caving: knees narrower than ankles by a margin
        const kneeW = Math.abs(lm[L.LKNEE].x - lm[L.RKNEE].x), ankW = Math.abs(lm[L.LANK].x - lm[L.RANK].x);
        return { ok: true, value: kneeAngle(lm), extraCue: kneeW < ankW * 0.7 ? "Push knees out" : "" };
      },
      idealDepth: 80, downOffset: 70, upOffset: 15, downBounds: [85, 110], upBounds: [150, 172],
      cueDown: "Nice depth", cueShallow: "Go a little deeper",
    }, cfg),
    pushup: angleCounter({
      measure(lm) {
        const ok = vis(lm[L.LSH]) && vis(lm[L.LEL]) && vis(lm[L.LWR]);
        if (!ok) return { ok: false, visibilityCue: "Show shoulders, elbows and wrists" };
        const e = Math.min(angle(lm[L.LSH], lm[L.LEL], lm[L.LWR]), angle(lm[L.RSH], lm[L.REL], lm[L.RWR]));
        const hipSag = angle(lm[L.LSH], lm[L.LHIP], lm[L.LKNEE]);
        return { ok: true, value: e, extraCue: hipSag < 150 ? "Keep hips in line" : "" };
      },
      idealDepth: 75, downOffset: 70, upOffset: 15, downBounds: [85, 100], upBounds: [145, 170],
      cueDown: "Lower", cueShallow: "Elbows to 90°",
    }, cfg),
    lunge: angleCounter({
      measure(lm) {
        const ok = vis(lm[L.LHIP]) && vis(lm[L.LKNEE]) && vis(lm[L.LANK]);
        if (!ok) return { ok: false, visibilityCue: "Step back: show hips to ankles" };
        return { ok: true, value: kneeAngle(lm), extraCue: "" };
      },
      idealDepth: 90, downOffset: 65, upOffset: 15, downBounds: [90, 115], upBounds: [150, 172],
      cueDown: "Hold", cueShallow: "Front knee to 90°",
    }, cfg),
    jumpingjack: {
      reps: 0, phase: "in", cue: "", form: null, forms: [], avgForm: null, ready: false, calib: 0, _lastFlip: -Infinity, _calib: [], _shW: null,
      update(lm, t = nowMs()) {
        const ok = vis(lm[L.LSH]) && vis(lm[L.RSH]) && vis(lm[L.LANK]) && vis(lm[L.RANK]);
        if (!ok) { this.cue = "Step back: show shoulders to ankles"; return { ok: false, calibrating: !this.ready }; }
        const shW = Math.abs(lm[L.LSH].x - lm[L.RSH].x), ankW = Math.abs(lm[L.LANK].x - lm[L.RANK].x);
        if (!this.ready) {
          this._calib.push(shW); this.calib = this._calib.length / cfg.calibrationFrames; this.cue = "Hold still… calibrating";
          if (this._calib.length >= cfg.calibrationFrames) { this._shW = [...this._calib].sort((a, b) => a - b)[Math.floor(this._calib.length / 2)]; this.ready = true; this.calib = 1; this.cue = "Ready — go!"; }
          return { ok: true, calibrating: !this.ready };
        }
        const handsUp = lm[L.LWR].y < lm[L.NOSE].y && lm[L.RWR].y < lm[L.NOSE].y;
        const feetOut = ankW > this._shW * 1.4;
        const canFlip = t - this._lastFlip >= cfg.minPhaseMs;
        if (this.phase === "in" && handsUp && feetOut && canFlip) { this.phase = "out"; this._lastFlip = t; this.cue = "Out"; }
        else if (this.phase === "out" && !handsUp && !feetOut && canFlip) {
          this.phase = "in"; this._lastFlip = t; this.reps++;
          this.form = 100; this.forms.push(100); this.avgForm = 100; this.cue = "Good rep";
        } else if (this.phase === "in" && handsUp && !feetOut) this.cue = "Feet wider";
        else if (this.phase === "in" && !handsUp && feetOut) this.cue = "Hands overhead";
        return { ok: true, calibrating: false };
      },
      reset() { Object.assign(this, { reps: 0, phase: "in", cue: "", form: null, forms: [], avgForm: null, ready: false, calib: 0, _lastFlip: -Infinity, _calib: [], _shW: null }); },
    },
  };
}

export function resetCounter(counters, id) {
  counters[id]?.reset();
}
