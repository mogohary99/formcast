// Live protocol test against a running relay (local `wrangler dev`, the Node relay, or the deployed
// Worker): RELAY_WS=wss://formcast.example.workers.dev node test/relay.live.test.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const WebSocket = require("../../relay/node_modules/ws");

const base = process.env.RELAY_WS ?? "ws://127.0.0.1:8789";
const room = "T" + Math.random().toString(36).slice(2, 5).toUpperCase();
// Messages are queued from the moment the socket is created, so a frame that arrives in the same
// tick as "open" is never lost.
const open = (path) => new Promise((res, rej) => {
  const ws = new WebSocket(`${base}${path}`);
  ws.queue = []; ws.waiters = [];
  ws.on("message", (d) => { const m = JSON.parse(d.toString()); const w = ws.waiters.shift(); if (w) w(m); else ws.queue.push(m); });
  ws.on("open", () => res(ws)); ws.on("error", rej);
});
const next = (ws) => new Promise((res, rej) => { if (ws.queue.length) return res(ws.queue.shift()); ws.waiters.push(res); setTimeout(() => rej(new Error("timeout waiting for message")), 5000); });
const fails = (path) => new Promise((res) => { const ws = new WebSocket(`${base}${path}`); ws.on("error", () => res(true)); ws.on("open", () => { ws.close(); res(false); }); });

let ok = true;
const check = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) ok = false; };

const tv = await open(`/tv?room=${room}`);
const p1 = await next(tv);
check("tv receives peers on join", p1.t === "peers" && p1.tv === 1 && p1.phones === 0);
const phone = await open(`/phone?room=${room}`);
const p2 = await next(phone);
check("phone receives peers on join", p2.t === "peers" && p2.phones === 1 && p2.tv === 1);
const p3 = await next(tv);
check("tv sees the phone join", p3.phones === 1);

const got = next(tv);
phone.send(JSON.stringify({ t: "pose", reps: 3 }));
check("phone→tv forwarded", (await got).reps === 3);
const back = next(phone);
tv.send(JSON.stringify({ t: "exercise", id: "squat", name: "Squats" }));
check("tv→phone forwarded", (await back).id === "squat");

const other = await open(`/tv?room=${room}X`);
await next(other);
phone.send(JSON.stringify({ t: "pose", reps: 4 }));
await next(tv);
await new Promise((r) => setTimeout(r, 150));
check("rooms are isolated", other.queue.length === 0);

check("bad room rejected", await fails("/tv?room=ab"));
check("bad role rejected", await fails(`/nope?room=${room}`));

const left = next(tv);
phone.close();
check("tv sees the phone leave", (await left).phones === 0);
for (const ws of [tv, other]) ws.close();
console.log(ok ? `\nALL PASS against ${base}` : `\nFAILURES against ${base}`);
process.exit(ok ? 0 : 1);
