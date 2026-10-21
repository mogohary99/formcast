/**
 * FormCast relay as a Cloudflare Durable Object.
 *
 * Same wire protocol as ../relay/server.js (the local Node relay):
 *   TV    connects to  wss://<host>/tv?room=CODE
 *   phone connects to  wss://<host>/phone?room=CODE
 *   JSON text frames are forwarded phone→TV and TV→phone untouched; both sides receive
 *   {"t":"peers","phones":n,"tv":n} whenever membership changes.
 *
 * One Durable Object per room code gives strong ordering within a room and lets the Free plan
 * host it (SQLite-backed DOs + WebSocket hibernation cost nothing while idle). The relay never
 * sees video: only pose landmarks and rep events pass through.
 */
import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ASSETS?: Fetcher;
}

const ROOM = /^[A-Z0-9]{4,8}$/;
const MAX_FRAME = 64 * 1024;

export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
    const url = new URL(request.url);
    const role = url.pathname === "/tv" ? "tv" : url.pathname === "/phone" ? "phone" : null;
    if (!role) return new Response("bad role", { status: 400 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server, [role]);
    // Announce membership after the 101 has been delivered, so clients that attach their
    // message handler on "open" (browsers, OkHttp) never miss the first peers frame.
    setTimeout(() => this.notify(), 0);
    return new Response(null, { status: 101, webSocket: client });
  }

  private count(role: string, except?: WebSocket) {
    return this.ctx.getWebSockets(role).filter((s) => s !== except).length;
  }

  /** Broadcast membership. `leaving` is a socket that is closing but may still be listed by the runtime. */
  private notify(leaving?: WebSocket) {
    const msg = JSON.stringify({ t: "peers", phones: this.count("phone", leaving), tv: this.count("tv", leaving) });
    for (const ws of this.ctx.getWebSockets()) if (ws !== leaving) this.safeSend(ws, msg);
  }

  private safeSend(ws: WebSocket, msg: string) {
    try {
      ws.send(msg);
    } catch {
      /* socket already closing */
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string" || message.length > MAX_FRAME) return; // JSON text only
    const role = this.ctx.getTags(ws)[0];
    const targets = this.ctx.getWebSockets(role === "tv" ? "phone" : "tv");
    for (const peer of targets) this.safeSend(peer, message);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      /* already closed */
    }
    this.notify(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, "error");
    } catch {
      /* ignore */
    }
    this.notify(ws);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // workers.dev also answers plain HTTP. Send everything to HTTPS (308 keeps the method);
    // local `wrangler dev` is plain HTTP on a loopback host and must keep working.
    // loopback and private-network hosts (wrangler dev reached from an emulator as 10.0.2.2, or a LAN device)
    const loopback = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname === "localhost" || url.hostname === "[::1]";
    if (!loopback && (url.protocol === "http:" || /"scheme":"http"/.test(request.headers.get("cf-visitor") ?? ""))) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, runtime: "cloudflare-workers", relay: "durable-object", time: new Date().toISOString() }), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/tv" || url.pathname === "/phone") {
      const code = (url.searchParams.get("room") ?? "").toUpperCase();
      if (!ROOM.test(code)) return new Response("bad room", { status: 400 });
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("expected websocket", { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      return stub.fetch(request);
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
