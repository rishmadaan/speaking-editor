import { describe, it, expect, vi } from "vitest";
import { PassThrough } from "stream";
import { Chunk } from "../core/chunker";

// Fake msedge-tts: records the text it was asked to speak and replays the
// boundary events the real service sends (escaped, as observed live).
const sent: string[] = [];
let boundaries: string[] = [];
vi.mock("msedge-tts", () => ({
  OUTPUT_FORMAT: { AUDIO_24KHZ_48KBITRATE_MONO_MP3: "mp3" },
  MsEdgeTTS: class {
    async setMetadata() {}
    close() {}
    toStream(text: string) {
      sent.push(text);
      const audioStream = new PassThrough();
      const metadataStream = new PassThrough();
      queueMicrotask(() => {
        boundaries.forEach((t, i) =>
          metadataStream.write(JSON.stringify({
            Metadata: [{ Type: "WordBoundary", Data: { Offset: i * 1_000_000, Duration: 1_000_000, text: { Text: t } } }],
          }))
        );
        audioStream.end(Buffer.from([1, 2, 3]));
      });
      return { audioStream, metadataStream };
    }
  },
}));

const { EdgeProvider } = await import("./edge");

const chunk: Chunk = {
  index: 0,
  text: "Tom & ample < b",
  sentenceIndexes: [0],
  words: [
    { wordIndex: 0, charStart: 0, charEnd: 3 },   // Tom
    { wordIndex: 1, charStart: 4, charEnd: 5 },   // &
    { wordIndex: 2, charStart: 6, charEnd: 11 },  // ample
    { wordIndex: 3, charStart: 12, charEnd: 13 }, // <
    { wordIndex: 4, charStart: 14, charEnd: 15 }, // b
  ],
};

describe("EdgeProvider SSML escaping (spec 0015)", () => {
  it("escapes & < > in the text sent to Edge, and aligns escaped boundaries", async () => {
    boundaries = ["Tom", "&amp;", "ample", "&lt;", "b"];
    const out = await new EdgeProvider().synthesize(chunk, "en-US-AriaNeural", new AbortController().signal);
    expect(sent.at(-1)).toBe("Tom &amp; ample &lt; b");
    // "&amp;" must not steal "ample": each real word keeps its own boundary.
    expect(out.timings.words).toEqual([
      { wordIndex: 0, start: 0, end: 100 },
      { wordIndex: 2, start: 200, end: 300 },
      { wordIndex: 4, start: 400, end: 500 },
    ]);
  });
});
