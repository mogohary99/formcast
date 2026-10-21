import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { replay } from "./replay.js";

/**
 * Replays every real recording in ./fixtures that has an *.expected.json sibling (ground truth written by the
 * person who did the set) through the production counters. Skips cleanly when no real fixture exists yet.
 */
const dir = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "fixtures");
const fixtures = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".expected.json") && existsSync(join(dir, f.replace(/\.json$/, ".expected.json")))) : [];

test(`real-session fixtures (${fixtures.length} found)`, { skip: fixtures.length === 0 && "no real recording in relay/fixtures yet" }, () => {
  for (const f of fixtures) {
    const session = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const expected = JSON.parse(readFileSync(join(dir, f.replace(/\.json$/, ".expected.json")), "utf8"));
    assert.equal(session.source, "phone-camera", `${f}: only recordings from the camera page count as real`);
    const out = replay(session);
    console.log(`  ${f}: ${out.map((s) => `${s.exercise} reps=${s.reps} avg_form=${s.avg_form} forms=[${s.forms.join(",")}]`).join("; ")}`);
    assert.equal(out.length, expected.segments.length, `${f}: segment count`);
    expected.segments.forEach((e, i) => {
      const s = out[i];
      assert.equal(s.exercise, e.exercise, `${f}: segment ${i} exercise`);
      assert.ok(Math.abs(s.reps - e.reps) <= (e.reps_tolerance ?? 0), `${f}: ${e.exercise} counted ${s.reps}, person did ${e.reps}`);
      if (e.min_avg_form != null) assert.ok(s.avg_form >= e.min_avg_form, `${f}: ${e.exercise} avg form ${s.avg_form} < ${e.min_avg_form}`);
      assert.ok(s.calibrated_at_ms != null, `${f}: ${e.exercise} never calibrated`);
    });
  }
});
