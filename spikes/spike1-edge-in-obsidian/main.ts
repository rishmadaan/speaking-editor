/**
 * Spike 1: prove the vendored TalkToMeBaby engine's Edge TTS provider works
 * inside Obsidian's plugin environment on macOS: synthesis over the free Edge
 * endpoint, word-boundary timing normalized by the engine, and audio playback
 * through the renderer's Audio element.
 *
 * Throwaway code. On load it reads "Spike Note.md" from the vault, parses it
 * with the vendored document model, synthesizes chunk 0 with EdgeProvider,
 * checks the timing invariants, plays ~1.5s of audio, and writes everything it
 * found to spike1-report.md in the vault root, so the result is readable from
 * outside Obsidian. Every failure path still writes the report.
 */
import { Plugin } from "obsidian";
import { parseDocument, buildChunks } from "../../src/engine/core";
import { EdgeProvider } from "../../src/engine/synthesis/edge";

const REPORT = "spike1-report.md";
const NOTE = "Spike Note.md";

export default class Spike1Plugin extends Plugin {
  async onload() {
    this.app.workspace.onLayoutReady(() => {
      this.run().catch(async (e) => {
        await this.write([`# Spike 1 report`, ``, `RESULT: FAIL (unhandled)`, ``, String(e?.stack ?? e)]);
      });
    });
  }

  private async write(lines: string[]) {
    await this.app.vault.adapter.write(REPORT, lines.join("\n") + "\n");
  }

  private async run() {
    const lines: string[] = [`# Spike 1 report`, ``];
    const checks: { name: string; pass: boolean; detail: string }[] = [];
    const check = (name: string, pass: boolean, detail: string) => {
      checks.push({ name, pass, detail });
      lines.push(`- ${pass ? "PASS" : "FAIL"}: ${name}. ${detail}`);
    };

    // Environment
    lines.push(`Environment: platform=${process.platform}, node=${process.versions?.node ?? "none"}, electron=${process.versions?.electron ?? "none"}, chrome=${process.versions?.chrome ?? "none"}`);
    lines.push(``);

    // 1. Read the note and build the document model
    const text = await this.app.vault.adapter.read(NOTE);
    const model = parseDocument(text, NOTE, 1);
    const chunks = buildChunks(model);
    check(
      "document model in Obsidian",
      model.words.length > 0 && chunks.length > 0,
      `${model.blocks.length} blocks, ${model.sentences.length} sentences, ${model.words.length} words, ${chunks.length} chunk(s)`
    );
    const fmLeak = model.words.some((w) => ["title:", "tags:"].includes(w.text.toLowerCase()));
    const codeLeak = model.words.some((w) => w.text.includes("console.log"));
    check("frontmatter and code block skipped", !fmLeak && !codeLeak, `frontmatterLeak=${fmLeak} codeLeak=${codeLeak}`);

    // 2. List voices over the network
    const provider = new EdgeProvider();
    let voiceCount = 0;
    let voicesLive = false;
    try {
      const voices = await provider.listVoices();
      voiceCount = voices.length;
      voicesLive = voiceCount > 5; // fallback list is exactly 5
    } catch (e) {
      lines.push(`listVoices threw: ${e}`);
    }
    check("live voice list (network reached)", voicesLive, `${voiceCount} en voices (5 would mean fallback list)`);

    // 3. Synthesize chunk 0 with word boundaries
    const chunk = chunks[0];
    const t0 = Date.now();
    const result = await provider.synthesize(chunk, provider.defaultVoice, new AbortController().signal);
    const synthMs = Date.now() - t0;
    check(
      "Edge synthesis in Obsidian",
      result.audio.byteLength > 1000 && result.format === "mp3",
      `${result.audio.byteLength} bytes ${result.format} in ${synthMs}ms for ${chunk.text.length} chars`
    );

    // 4. Timing invariants: exact ms unit, coverage, monotonic starts
    const t = result.timings;
    const coverage = t.words.length / chunk.words.length;
    let monotonic = true;
    for (let i = 1; i < t.words.length; i++) if (t.words[i].start < t.words[i - 1].start) monotonic = false;
    check(
      "word timings exact and sane",
      t.unit === "ms" && coverage > 0.9 && monotonic,
      `unit=${t.unit}, ${t.words.length}/${chunk.words.length} words timed (${Math.round(coverage * 100)}%), monotonic=${monotonic}`
    );
    const sample = t.words.slice(0, 5)
      .map((w) => `"${model.words[w.wordIndex]?.text}" ${Math.round(w.start)}..${Math.round(w.end)}ms`)
      .join(", ");
    lines.push(`  First timings: ${sample}`);

    // 5. Playback through the renderer's Audio element
    const url = URL.createObjectURL(new Blob([result.audio.slice().buffer as ArrayBuffer], { type: "audio/mpeg" }));
    const audio = new Audio(url);
    const meta = await new Promise<boolean>((res) => {
      audio.onloadedmetadata = () => res(true);
      audio.onerror = () => res(false);
      setTimeout(() => res(false), 5000);
    });
    let played = false;
    let position = 0;
    if (meta) {
      try {
        await audio.play();
        await new Promise((r) => setTimeout(r, 1500));
        position = audio.currentTime;
        audio.pause();
        played = position > 0.5;
      } catch (e) {
        lines.push(`  play() threw: ${e}`);
      }
    }
    URL.revokeObjectURL(url);
    check(
      "audio playback in renderer",
      meta && played,
      `metadata=${meta}, duration=${audio.duration?.toFixed(2)}s, position after 1.5s=${position.toFixed(2)}s`
    );

    const allPass = checks.every((c) => c.pass);
    lines.splice(2, 0, `RESULT: ${allPass ? "ALL PASS" : "FAILURES PRESENT"} (${checks.filter((c) => c.pass).length}/${checks.length})`, ``);
    await this.write(lines);
  }
}
