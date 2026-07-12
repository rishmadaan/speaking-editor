// Compile-time flag replaced by esbuild's define. True in dev builds (the
// acceptance-checks command is present), false in --prod builds.
declare const DEV_ACCEPTANCE: boolean;

// The CSS Custom Highlight API. TypeScript's lib.dom declares Highlight and
// HighlightRegistry but omits their setlike/maplike members (add/clear on a
// Highlight, set/get/delete on CSS.highlights), which the RangeSurface relies on.
// Augment the existing global interfaces (declaration merging) with just those
// members; Electron in Obsidian supports the API at runtime.
interface Highlight {
  add(range: AbstractRange): void;
  clear(): void;
  delete(range: AbstractRange): boolean;
  has(range: AbstractRange): boolean;
  readonly size: number;
}

interface HighlightRegistry {
  set(name: string, highlight: Highlight): HighlightRegistry;
  get(name: string): Highlight | undefined;
  has(name: string): boolean;
  delete(name: string): boolean;
  clear(): void;
  readonly size: number;
}
