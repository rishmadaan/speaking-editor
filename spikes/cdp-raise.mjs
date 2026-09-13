// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Raise (unminimize + front) an Obsidian window via the browser-level CDP
// endpoint. Usage: node spikes/cdp-raise.mjs <title-substring>
import WebSocket from "ws";

const titleSub = process.argv[2];
const version = await (await fetch("http://127.0.0.1:9222/json/version")).json();
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((t) => t.type === "page" && t.title.includes(titleSub));
if (!target) { console.error("no target matching", titleSub); process.exit(1); }

const ws = new WebSocket(version.webSocketDebuggerUrl, { maxPayload: 16 * 1024 * 1024 });
await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((res, rej) => {
    const onMsg = (m) => {
      const msg = JSON.parse(m.toString());
      if (msg.id === id) { ws.off("message", onMsg); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => rej(new Error("timeout " + method)), 10000);
  });
}

const { windowId, bounds } = await send("Browser.getWindowForTarget", { targetId: target.id });
console.log("window", windowId, "state:", bounds.windowState);
if (bounds.windowState !== "normal") {
  await send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
}
ws.close();
console.log("raised");
