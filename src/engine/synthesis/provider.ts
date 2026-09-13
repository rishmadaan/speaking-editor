// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.
// Inherited TalkToMeBaby MIT grant: see VENDOR.md and THIRD_PARTY_NOTICES.md.

import { Chunk } from "../core/chunker";
import { ChunkTimings } from "../core/timing";

export interface VoiceInfo { id: string; label: string }
export interface ChunkAudio { audio: Uint8Array; format: "mp3" | "wav"; timings: ChunkTimings }

export interface TtsProvider {
  readonly id: string;
  readonly label: string;
  readonly requiresKey: boolean;
  readonly timingQuality: "exact" | "estimated";
  readonly maxCharsPerRequest: number;
  readonly defaultVoice: string;
  listVoices(): Promise<VoiceInfo[]>;
  synthesize(chunk: Chunk, voice: string, signal: AbortSignal): Promise<ChunkAudio>;
}
