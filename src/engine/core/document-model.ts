// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.
// Inherited TalkToMeBaby MIT grant: see VENDOR.md and THIRD_PARTY_NOTICES.md.

// ─── Exported types ──────────────────────────────────────────────────────────

export interface Offsets {
  start: number;
  end: number;
}

export type BlockKind = "heading" | "paragraph" | "list-item" | "quote" | "code";

export interface Word {
  index: number;
  text: string;
  /**
   * Word source offsets are a BOUNDING BOX: first to last clean character in the
   * source document. When markdown markers sit between a word's characters
   * (e.g. the "**" in "**word**." where the trailing "." belongs to the word),
   * the box spans them — the source slice may include those markers. The reader
   * panel renders from `text` and is unaffected; only editor decorations see this.
   */
  source: Offsets;
}

export interface Sentence {
  index: number;
  text: string;
  words: Word[];
  source: Offsets;
}

export interface Block {
  kind: BlockKind;
  level?: number;
  sentences: Sentence[];
  source: Offsets;
  codeText?: string;
}

export interface DocumentModel {
  uri: string;
  version: number;
  blocks: Block[];
  sentences: Sentence[];
  words: Word[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface CleanText {
  text: string;
  offsets: number[];
}

interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

interface SentenceDraft {
  text: string;
  source: Offsets;
  wordDrafts: { text: string; source: Offsets }[];
}

interface RawBlock {
  kind: BlockKind;
  level?: number;
  startLine: number;
  lines: string[];
}

// ─── Ported verbatim from src/utils/text-parser.ts (vscode-free functions) ───

const ABBREVIATION_PATTERN =
  /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g|a\.m|p\.m)\./gi;
// Replaces dots in abbreviations so the sentence scanner does not split at them.
// Only lives in the `processed` boundary-detection string, never surfaces in output.
const DOT_PLACEHOLDER = "\u0000";

function splitIntoSentenceSpans(text: string): SentenceSpan[] {
  const processed = text.replace(ABBREVIATION_PATTERN, (match) =>
    match.replace(/\./g, DOT_PLACEHOLDER)
  );
  const spans: SentenceSpan[] = [];
  let start = 0;

  for (let i = 0; i < processed.length; i++) {
    if (!/[.!?]/.test(processed[i])) continue;

    let end = i + 1;
    while (end < processed.length && /["')\]]/.test(processed[end])) {
      end++;
    }

    if (end < processed.length && !/\s/.test(processed[end])) {
      continue;
    }

    pushTrimmedSpan(text, spans, start, end);
    while (end < processed.length && /\s/.test(processed[end])) {
      end++;
    }
    start = end;
    i = end - 1;
  }

  pushTrimmedSpan(text, spans, start, text.length);
  return spans;
}

function pushTrimmedSpan(
  source: string,
  spans: SentenceSpan[],
  start: number,
  end: number
) {
  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;

  if (start < end) {
    spans.push({
      text: source.slice(start, end),
      start,
      end,
    });
  }
}

const TAG_CHAR = /[\w/-]/;

// A valid Obsidian tag body: tag chars only, with at least one non-digit.
function tagBodyEnd(line: string, start: number): number {
  let end = start;
  while (end < line.length && TAG_CHAR.test(line[end])) end++;
  if (end === start) return start;
  if (!/\D/.test(line.slice(start, end))) return start;
  return end;
}

// True when the line's readable content is only tags and whitespace.
function isTagOnlyLine(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0) return false;
  return trimmed.split(/\s+/).every((tok) => {
    if (tok[0] !== "#") return false;
    return tagBodyEnd(tok, 1) === tok.length;
  });
}

function cleanLineInto(
  line: string,
  lineOffset: number,
  output: string[],
  offsets: number[]
) {
  const readableStart = getReadableLineStart(line);
  const isQuote = /^\s*>/.test(line);
  if (isTagOnlyLine(line.slice(readableStart))) return;

  let i = readableStart;

  while (i < line.length) {
    // Callout marker "[!type]" (+ optional fold "+"/"-") at a quote line start.
    if (i === readableStart && isQuote) {
      const callout = /^\[![^\]\n]*\][+-]?\s*/.exec(line.slice(i));
      if (callout) {
        i += callout[0].length;
        continue;
      }
    }

    // Embed "![[...]]" is skipped entirely (spec 0002 point 2).
    if (line.startsWith("![[", i)) {
      const close = line.indexOf("]]", i + 3);
      if (close >= 0) {
        i = close + 2;
        continue;
      }
    }

    // Wikilink "[[Target]]" / "[[Target|alias]]": speak the alias, else target.
    if (line.startsWith("[[", i)) {
      const close = line.indexOf("]]", i + 2);
      if (close >= 0) {
        const pipe = line.indexOf("|", i + 2);
        const emitStart = pipe >= 0 && pipe < close ? pipe + 1 : i + 2;
        appendRange(line, lineOffset, emitStart, close, output, offsets);
        i = close + 2;
        continue;
      }
    }

    // Markdown image "![alt](url)" is skipped entirely (spec 0002 point 2).
    if (line.startsWith("![", i)) {
      const closeBracket = line.indexOf("]", i + 2);
      const openParen = closeBracket >= 0 ? line.indexOf("(", closeBracket) : -1;
      const closeParen = openParen >= 0 ? line.indexOf(")", openParen) : -1;
      if (closeBracket >= 0 && openParen === closeBracket + 1 && closeParen >= 0) {
        i = closeParen + 1;
        continue;
      }
    }

    if (line[i] === "[") {
      const closeBracket = line.indexOf("]", i + 1);
      const openParen = closeBracket >= 0 ? line.indexOf("(", closeBracket) : -1;
      const closeParen = openParen >= 0 ? line.indexOf(")", openParen) : -1;
      if (closeBracket >= 0 && openParen === closeBracket + 1 && closeParen >= 0) {
        appendRange(line, lineOffset, i + 1, closeBracket, output, offsets);
        i = closeParen + 1;
        continue;
      }
    }

    // Comment "%%...%%" within a line is skipped entirely (spec 0002 point 6).
    if (line.startsWith("%%", i)) {
      const close = line.indexOf("%%", i + 2);
      if (close >= 0) {
        i = close + 2;
        continue;
      }
    }

    // Highlight "==...==": doubled "=" is a marker (spec 0002 point 5).
    if (line[i] === "=" && line[i + 1] === "=") {
      i += 2;
      continue;
    }

    // Tag "#tag": strip the hash, speak the tag body (spec 0002 point 4).
    if (line[i] === "#" && (i === readableStart || /\s/.test(line[i - 1]))) {
      const end = tagBodyEnd(line, i + 1);
      if (end > i + 1) {
        appendRange(line, lineOffset, i + 1, end, output, offsets);
        i = end;
        continue;
      }
    }

    if (line[i] === "`") {
      const end = line.indexOf("`", i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }

    if (line[i] === "<") {
      const end = line.indexOf(">", i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }

    if (line[i] === "\\" && i + 1 < line.length) {
      i++;
      appendChar(line[i], lineOffset + i, output, offsets);
      i++;
      continue;
    }

    if (/[*_~]/.test(line[i])) {
      i++;
      continue;
    }

    appendChar(line[i], lineOffset + i, output, offsets);
    i++;
  }
}

function getReadableLineStart(line: string): number {
  const markerMatch = line.match(
    /^\s*(?:(?:#{1,6}|>)\s+|(?:[-*+]|\d+[.)])\s+)/
  );
  return markerMatch ? markerMatch[0].length : 0;
}

function appendRange(
  source: string,
  baseOffset: number,
  start: number,
  end: number,
  output: string[],
  offsets: number[]
) {
  for (let i = start; i < end; i++) {
    appendChar(source[i], baseOffset + i, output, offsets);
  }
}

function appendChar(
  char: string,
  offset: number,
  output: string[],
  offsets: number[]
) {
  if (/\s/.test(char)) {
    if (output.length > 0 && !/\s/.test(output[output.length - 1])) {
      output.push(" ");
      offsets.push(offset);
    }
    return;
  }

  output.push(char);
  offsets.push(offset);
}

// ─── New model layer ──────────────────────────────────────────────────────────

function cleanBlockWithOffsets(raw: string, baseOffset: number): CleanText {
  const lines = raw.split("\n");
  const output: string[] = [];
  const offsets: number[] = [];
  let rel = 0;
  for (const line of lines) {
    cleanLineInto(line, baseOffset + rel, output, offsets);
    rel += line.length + 1;
    if (output.length > 0 && !/\s/.test(output[output.length - 1])) {
      output.push(" ");
      offsets.push(baseOffset + rel - 1);
    }
  }
  return { text: output.join(""), offsets };
}

function segmentBlocks(lines: string[], firstLine: number): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: RawBlock | undefined;
  const flush = () => {
    if (current && current.lines.length) blocks.push(current);
    current = undefined;
  };

  let inCode = false;
  for (let i = firstLine; i < lines.length; i++) {
    const line = lines[i];
    // TODO: ~~~ fences not yet supported
    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        inCode = false;
        current?.lines.push(line);
        flush();
      } else {
        flush();
        inCode = true;
        current = { kind: "code", startLine: i, lines: [line] };
      }
      continue;
    }
    if (inCode) {
      current!.lines.push(line);
      continue;
    }
    if (line.trim().length === 0 || /^[-*_]{3,}\s*$/.test(line)) {
      flush();
      continue;
    }

    // TODO: setext headings (=== / --- underlines) not yet supported
    const heading = line.match(/^(#{1,6})\s+/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, startLine: i, lines: [line] });
      continue;
    }
    const isList = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
    const isQuote = /^\s*>/.test(line);
    const kind: BlockKind = isList ? "list-item" : isQuote ? "quote" : "paragraph";
    if (isList) {
      flush();
      current = { kind, startLine: i, lines: [line] };
      continue;
    }
    if (!current || current.kind !== kind) {
      flush();
      current = { kind, startLine: i, lines: [] };
    }
    current.lines.push(line);
  }
  flush();
  return blocks;
}

function sentencesFromBlock(raw: string, baseOffset: number): SentenceDraft[] {
  const clean = cleanBlockWithOffsets(raw, baseOffset);
  return splitIntoSentenceSpans(clean.text).flatMap((span) => {
    const start = clean.offsets[span.start];
    const end = clean.offsets[span.end - 1];
    if (start === undefined || end === undefined) return [];
    const wordDrafts: SentenceDraft["wordDrafts"] = [];
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    const sentenceClean = clean.text.slice(span.start, span.end);
    while ((m = re.exec(sentenceClean)) !== null) {
      const ws = clean.offsets[span.start + m.index];
      const we = clean.offsets[span.start + m.index + m[0].length - 1];
      if (ws === undefined || we === undefined) continue;
      wordDrafts.push({ text: m[0], source: { start: ws, end: we + 1 } });
    }
    return [{ text: span.text, source: { start, end: end + 1 }, wordDrafts }];
  });
}

export function parseDocument(text: string, uri: string, version: number): DocumentModel {
  const lines = text.split("\n");
  const lineOffsets: number[] = [];
  let off = 0;
  for (const l of lines) {
    lineOffsets.push(off);
    off += l.length + 1;
  }

  let firstLine = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) firstLine = end + 1;
  }

  const blocks: Block[] = [];
  const sentences: Sentence[] = [];
  const words: Word[] = [];

  for (const raw of segmentBlocks(lines, firstLine)) {
    const base = lineOffsets[raw.startLine];
    const rawText = raw.lines.join("\n");
    const source: Offsets = { start: base, end: base + rawText.length };

    if (raw.kind === "code") {
      blocks.push({ kind: "code", sentences: [], source, codeText: rawText });
      continue;
    }

    const blockSentences: Sentence[] = [];
    for (const d of sentencesFromBlock(rawText, base)) {
      const s: Sentence = {
        index: sentences.length + blockSentences.length,
        text: d.text,
        source: d.source,
        words: [],
      };
      for (const wd of d.wordDrafts) {
        const w: Word = { index: words.length, text: wd.text, source: wd.source };
        words.push(w);
        s.words.push(w);
      }
      blockSentences.push(s);
    }
    sentences.push(...blockSentences);
    blocks.push({ kind: raw.kind, level: raw.level, sentences: blockSentences, source });
  }

  return { uri, version, blocks, sentences, words };
}
