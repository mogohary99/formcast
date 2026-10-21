import { test } from "node:test";
import assert from "node:assert/strict";
import { server, rooms } from "./server.js";
import WebSocket from "ws";

test("relay forwards phone→tv and tv→phone within a room, isolates rooms", async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const open = (path) => new Promise((res, rej) => { const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`); ws.on("open", () => res(ws)); ws.on("error", rej); });
  const next = (ws) => new Promise((res) => ws.once("message", (d) => res(JSON.parse(d.toString()))));

  const tv = await open("/tv?room=ABCD");
  await next(tv); // peers
  const phone = await open("/phone?room=ABCD");
  await next(phone); // peers
  await next(tv); // peers update
  const other = await open("/tv?room=ZZZZ");
  await next(other);

  const got = next(tv);
  phone.send(JSON.stringify({ t: "pose", reps: 3 }));
  assert.deepEqual(await got, { t: "pose", reps: 3 });

  const back = next(phone);
  tv.send(JSON.stringify({ t: "exercise", id: "squat" }));
  assert.deepEqual(await back, { t: "exercise", id: "squat" });

  let leaked = false;
  other.once("message", () => (leaked = true));
  phone.send(JSON.stringify({ t: "pose", reps: 4 }));
  await next(tv);
  assert.equal(leaked, false);
  assert.equal(rooms.size, 2);

  for (const ws of [tv, phone, other]) ws.close();
  await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => server.close(r));
});

test("rejects bad rooms and roles", async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const fails = (path) => new Promise((res) => { const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`); ws.on("error", () => res(true)); ws.on("open", () => res(false)); });
  assert.equal(await fails("/tv?room=ab"), true);
  assert.equal(await fails("/nope?room=ABCD"), true);
  await new Promise((r) => server.close(r));
});
