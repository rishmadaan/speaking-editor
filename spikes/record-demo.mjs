// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Record the README demo GIF: drive a choreographed Speaking Editor session in
// the test vault and capture it via CDP screencast, then assemble frames with
// ffmpeg (palette pass for quality). Usage: node spikes/record-demo.mjs
// Writes frames to a temp dir and the final GIF to docs/demo.gif.
import WebSocket from "ws";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { tmpdir } from "os";

const here = dirname(fileURLToPath(import.meta.url));
const framesDir = join(tmpdir(), `se-demo-frames-${Date.now()}`);
mkdirSync(framesDir, { recursive: true });

const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((t) => t.type === "page" && t.title.includes("test-vault"));
if (!target) { console.error("no test-vault window"); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
await new Promise((res, rej) => { ws.on("open", res); ws.on("error", rej); });

let nextId = 1;
const pending = new Map();
const frames = [];
let firstFrameTs = null;
let lastFrameTs = null;

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    return;
  }
  if (msg.method === "Page.screencastFrame") {
    const { data, metadata, sessionId } = msg.params;
    if (firstFrameTs == null) firstFrameTs = metadata.timestamp;
    lastFrameTs = metadata.timestamp;
    const idx = frames.length;
    frames.push(metadata.timestamp);
    writeFileSync(join(framesDir, `f${String(idx).padStart(5, "0")}.png`), Buffer.from(data, "base64"));
    send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((res, rej) => {
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("timeout " + method)); } }, 30000);
  });
}

const evaluate = (expression) =>
  send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }).then((r) => {
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result?.value;
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Stage: pin the window, open the demo note centered, clean state.
console.log(await evaluate(`(async () => {
  const w = window.electronWindow;
  w.setAlwaysOnTop(true); if (w.isMinimized()) w.restore(); w.show(); w.moveTop(); w.focus();
  require('@electron/remote').app.focus({steal: true});
  const p = app.plugins.plugins['speaking-editor'];
  p.acceptanceDisposeSession?.();
  const file = app.vault.getFiles().find(f => f.name === 'Demo.md');
  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
  await new Promise(r => setTimeout(r, 300));
  // live preview, cursor away, sidebar collapsed for a clean frame
  app.workspace.leftSplit?.collapse?.();
  app.workspace.rightSplit?.collapse?.();
  await new Promise(r => setTimeout(r, 400));
  return 'staged vis=' + document.visibilityState;
})()`));

// 2. Roll camera.
await send("Page.startScreencast", { format: "png", everyNthFrame: 1, maxWidth: 1100, maxHeight: 900 });
await sleep(700); // a beat of stillness before anything happens

// 3. Press play (the tip notice appears once, the pill mounts, karaoke starts).
console.log(await evaluate(`(app.commands.executeCommandById('speaking-editor:play-pause'), 'play pressed')`));
await sleep(6500); // cache-warm start: karaoke begins almost immediately

// 4. Click a word a couple of paragraphs ahead: the jump moment.
console.log(await evaluate(`(async () => {
  const p = app.plugins.plugins['speaking-editor'];
  const cm = app.workspace.activeLeaf.view.editor.cm;
  const st = cm.state.field ? null : null;
  // find the word "remembers" in the doc and click its coordinates
  const text = cm.state.doc.toString();
  const at = text.indexOf('remembers') + 1;
  cm.dispatch({ effects: [] });
  const coords = cm.coordsAtPos(at + 3);
  if (!coords) return 'no coords';
  cm.contentDOM.dispatchEvent(new MouseEvent('mousedown', {
    clientX: (coords.left + coords.right) / 2, clientY: (coords.top + coords.bottom) / 2, bubbles: true,
  }));
  return 'clicked jump target';
})()`));
await sleep(6000); // the voice continues from the clicked word

// 5. One pause/resume beat on the pill for the ending, then stop camera.
console.log(await evaluate(`(document.querySelector('.se-pill-play')?.click(), 'pill pause')`));
await sleep(1600);
await send("Page.stopScreencast");

// 6. Clean the stage.
console.log(await evaluate(`(async () => {
  const p = app.plugins.plugins['speaking-editor'];
  p.acceptanceDisposeSession?.();
  window.electronWindow.setAlwaysOnTop(false);
  return 'unpinned';
})()`));
ws.close();

// 7. Assemble. Real elapsed time -> average fps so playback speed is true.
const durationS = Math.max(1, lastFrameTs - firstFrameTs);
const fps = Math.min(24, Math.max(6, Math.round(frames.length / durationS)));
console.log(`frames=${frames.length} duration=${durationS.toFixed(1)}s fps=${fps}`);
mkdirSync(join(here, "..", "docs"), { recursive: true });
const gif = join(here, "..", "docs", "demo.gif");
const palette = join(framesDir, "palette.png");
execFileSync("ffmpeg", ["-y", "-framerate", String(fps), "-i", join(framesDir, "f%05d.png"), "-vf", "fps=12,scale=880:-1:flags=lanczos,palettegen=stats_mode=diff", palette]);
execFileSync("ffmpeg", ["-y", "-framerate", String(fps), "-i", join(framesDir, "f%05d.png"), "-i", palette, "-lavfi", "fps=12,scale=880:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4", gif]);
console.log("wrote", gif);
rmSync(framesDir, { recursive: true, force: true });
