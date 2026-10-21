/**
 * Synthetic phone for end-to-end testing without a camera: joins a room as a phone and streams
 * a squat-like skeleton (13 joints) plus rep events at ~15 fps. Usage: node fake-phone.js <room> [relayUrl]
 */
import WebSocket from "ws";
const room = (process.argv[2] ?? "DEMO").toUpperCase();
const url = (process.argv[3] ?? "ws://127.0.0.1:8787") + `/phone?room=${room}`;
const ws = new WebSocket(url);
let exercise = "squat", t = 0, reps = 0, phase = "up";
ws.on("open", () => console.log("fake phone joined", room));
ws.on("message", (d) => { const m = JSON.parse(d); if (m.t === "exercise") { exercise = m.id; reps = 0; console.log("exercise:", m.id); } });
function kp(depth) { // depth 0 = standing, 1 = deep squat
  const hipY = 0.55 + 0.17 * depth, kneeX = 0.12 * depth;
  return [
    [0.5, 0.10 + 0.05 * depth, 1],
    [0.42, 0.25 + 0.05 * depth, 1], [0.58, 0.25 + 0.05 * depth, 1],
    [0.38, 0.40, 1], [0.62, 0.40, 1],
    [0.36, 0.50, 1], [0.64, 0.50, 1],
    [0.45, hipY, 1], [0.55, hipY, 1],
    [0.45 - kneeX, 0.78, 1], [0.55 + kneeX, 0.78, 1],
    [0.45, 0.95, 1], [0.55, 0.95, 1],
  ].map((p) => p.map((v) => +v.toFixed(3)));
}
setInterval(() => {
  if (ws.readyState !== 1) return;
  t += 1 / 15;
  const period = exercise === "jumpingjack" ? 1.0 : 2.0;
  const depth = (1 - Math.cos((2 * Math.PI * t) / period)) / 2; // 0→1→0
  const newPhase = depth > 0.6 ? "down" : "up";
  let cue = newPhase === "down" ? "Nice depth" : "";
  if (phase === "down" && newPhase === "up") { reps++; cue = "Good rep"; }
  phase = newPhase;
  ws.send(JSON.stringify({ t: "pose", ex: exercise, reps, phase, cue, kp: kp(depth) }));
}, 66);
