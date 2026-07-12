// Evaluate a JS expression in an Obsidian window via CDP.
// Usage: node spikes/cdp-eval.mjs <title-substring> <expression>
import WebSocket from "ws";

const [, , titleSub, expr] = process.argv;
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((t) => t.type === "page" && t.title.includes(titleSub));
if (!target) { console.error("no target matching", titleSub); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });

const result = await new Promise((res, rej) => {
  ws.on("message", (m) => {
    const msg = JSON.parse(m.toString());
    if (msg.id === 1) res(msg.result);
  });
  // rAF-driven code under test needs an unoccluded window: Chromium throttles
  // or pauses requestAnimationFrame in occluded windows, which starves any
  // frame-synced loop and skews timing measurements.
  ws.send(JSON.stringify({ id: 0, method: "Page.bringToFront" }));
  ws.send(JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: { expression: expr, awaitPromise: true, returnByValue: true },
  }));
  setTimeout(() => rej(new Error("cdp timeout")), 30000);
});
ws.close();
if (result.exceptionDetails) {
  console.error("EXCEPTION:", JSON.stringify(result.exceptionDetails, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result.result?.value, null, 2));
