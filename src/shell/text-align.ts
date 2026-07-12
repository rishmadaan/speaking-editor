// The text-alignment walker: a pure function that maps the document model's word
// sequence onto a rendered reading-mode DOM, expressed as an abstract text-node
// list so it is driven by happy-dom in tests and by real Text nodes at runtime.
//
// The dialect rules (spec 0002) make the model's spoken text a subsequence of the
// rendered text for standard notes; embeds render content the model skips. So the
// walker greedily matches each model word as a contiguous run in the rendered
// text (crossing node boundaries when an inline split, e.g. bold, cuts a word in
// two), and may skip a bounded rendered-only stretch before each word. Alignment
// SUCCEEDS only when every word finds its range in order; otherwise it fails, and
// the caller paints no highlight at all (all-or-nothing: a wrong highlight is
// worse than none).

export interface AlignNode {
  text: string;
}

// A per-word span over the abstract node list: node indices plus in-node
// character offsets. startOffset is inclusive, endOffset exclusive (DOM Range
// convention), and a word may span from startNode to a later endNode.
export interface WordRange {
  startNode: number;
  startOffset: number;
  endNode: number;
  endOffset: number;
}

export type AlignResult = { ok: true; ranges: WordRange[] } | { ok: false; reason: string };

// The most rendered-only characters the walker may skip while looking for the
// next model word. Wide enough to hop a short embed or a callout icon's stray
// text, small enough that a genuine divergence (a note whose rendering does not
// match the model) runs past it and fails, so the note gets no highlight rather
// than a wrong one. Real full-note embeds render far more than this and fail
// safe to no-highlight, which is the intended behaviour.
export const DEFAULT_LOOKAHEAD = 160;

const WORD_CHAR = /[A-Za-z0-9]/;
const isWordChar = (c: string | undefined): boolean => c != null && WORD_CHAR.test(c);

export function alignWords(
  words: string[],
  nodes: AlignNode[],
  lookaheadCap: number = DEFAULT_LOOKAHEAD
): AlignResult {
  // Flatten the node texts into one string, remembering for each flat character
  // which node it came from and its offset within that node, so a match maps
  // back to node-local Range coordinates.
  const nodeOf: number[] = [];
  const offOf: number[] = [];
  let flat = "";
  for (let n = 0; n < nodes.length; n++) {
    const t = nodes[n].text;
    for (let i = 0; i < t.length; i++) {
      nodeOf.push(n);
      offOf.push(i);
    }
    flat += t;
  }

  // A word boundary sits wherever a non-word character separates tokens OR wherever
  // one text node ends and another begins. The node boundary matters because two
  // model words rendered in adjacent block elements (a callout title then its
  // body) carry no separating character in the flat text, yet are genuinely two
  // words. An inline split inside a single word (bold cutting "wo|rd") is the
  // opposite case, but there both halves belong to the one word we match whole,
  // so treating the node seam as a boundary never wrongly splits a word.
  const leftOk = (j: number): boolean =>
    j === 0 || !isWordChar(flat[j - 1]) || nodeOf[j] !== nodeOf[j - 1];
  const rightOk = (e: number): boolean =>
    e >= flat.length || !isWordChar(flat[e]) || nodeOf[e] !== nodeOf[e - 1];

  const ranges: WordRange[] = [];
  let pos = 0;
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    if (word.length === 0) return { ok: false, reason: `empty model word at index ${w}` };

    // Search for the earliest boundary-clean occurrence of the word at or after
    // pos, within the lookahead cap. Boundaries stop "cat" matching inside
    // "scatter" or as a prefix of "cats".
    const maxStart = Math.min(flat.length - word.length, pos + lookaheadCap);
    let found = -1;
    for (let j = pos; j <= maxStart; j++) {
      if (flat[j] !== word[0]) continue;
      if (!leftOk(j)) continue;
      if (!flat.startsWith(word, j)) continue;
      if (!rightOk(j + word.length)) continue;
      found = j;
      break;
    }
    if (found < 0) {
      return { ok: false, reason: `model word ${w} "${word}" not found within lookahead from ${pos}` };
    }

    const lastChar = found + word.length - 1;
    ranges.push({
      startNode: nodeOf[found],
      startOffset: offOf[found],
      endNode: nodeOf[lastChar],
      endOffset: offOf[lastChar] + 1,
    });
    pos = found + word.length;
  }

  return { ok: true, ranges };
}
