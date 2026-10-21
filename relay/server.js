/**
 * FormCast relay.
 *
 * Why a relay: a phone browser only grants camera access on a secure (HTTPS) origin, and an HTTPS page
 * may only open secure WebSockets. A Fire TV cannot present a trusted certificate on the LAN, so both
 * ends connect outward to this relay instead: the TV joins a room, the phone scans the QR code with that
 * room code, and pose/rep messages are forwarded phone→TV while the TV sends exercise selections
 * TV→phone. The relay never stores video; only landmark coordinates and rep events pass through.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const here = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC = join(here, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

/** room code -> { tv: Set<ws>, phones: Set<ws> } */
export const rooms = new Map();
const ROOM = /^[A-Z0-9]{4,8}$/;

function room(code) {
  let r = rooms.get(code);
  if (!r) {
    r = { tv: new Set(), phones: new Set(), created: Date.now() };
    rooms.set(code, r);
  }
  return r;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, time: new Date().toISOString() }));
    return;
  }
  let p = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  if (p === "/" ) p = "/index.html";
  if (p === "/cam" || p === "/cam/") p = "/cam/index.html";
  const file = join(PUBLIC, p);
  if (!file.startsWith(PUBLIC) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream", "cache-control": "no-cache" });
  res.end(readFileSync(file));
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  const role = url.pathname === "/tv" ? "tv" : url.pathname === "/phone" ? "phone" : null;
  const code = (url.searchParams.get("room") ?? "").toUpperCase();
  if (!role || !ROOM.test(code)) {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => join_(ws, role, code));
});

function join_(ws, role, code) {
  const r = room(code);
  const peers = role === "tv" ? r.tv : r.phones;
  const others = () => (role === "tv" ? r.phones : r.tv);
  peers.add(ws);
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  const notify = () => {
    const msg = JSON.stringify({ t: "peers", phones: r.phones.size, tv: r.tv.size });
    for (const s of [...r.tv, ...r.phones]) if (s.readyState === 1) s.send(msg);
  };
  notify();
  ws.on("message", (data, isBinary) => {
    if (isBinary) return; // JSON only
    // Forward to the other side of the room, untouched. Keep it dumb and fast.
    for (const s of others()) if (s.readyState === 1) s.send(data.toString());
  });
  ws.on("close", () => {
    peers.delete(ws);
    notify();
    if (r.tv.size === 0 && r.phones.size === 0) rooms.delete(code);
  });
}

// Heartbeat: drop dead sockets so room counts stay honest.
const hb = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
hb.unref();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, "0.0.0.0", () => console.log(`[formcast-relay] http://0.0.0.0:${PORT}  (ws /tv?room=CODE, /phone?room=CODE; cam page /cam/)`));
}
export { server, wss };
