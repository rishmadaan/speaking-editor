// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { KeyStore, StorageLike } from "./key-store";

// A fake Storage-like object backed by a plain Map, mirroring the localStorage
// contract the real store wraps.
function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("KeyStore", () => {
  it("round-trips a key under the namespaced format", () => {
    const storage = fakeStorage();
    const store = new KeyStore(storage);
    store.set("elevenlabs", "sk-secret");
    expect(store.get("elevenlabs")).toBe("sk-secret");
    expect(storage.map.get("speaking-editor:key:elevenlabs")).toBe("sk-secret");
  });

  it("returns null for a provider with no stored key", () => {
    const store = new KeyStore(fakeStorage());
    expect(store.get("elevenlabs")).toBeNull();
    expect(store.has("elevenlabs")).toBe(false);
  });

  it("has() reports presence", () => {
    const store = new KeyStore(fakeStorage());
    store.set("elevenlabs", "sk-secret");
    expect(store.has("elevenlabs")).toBe(true);
  });

  it("clear removes the stored key", () => {
    const storage = fakeStorage();
    const store = new KeyStore(storage);
    store.set("elevenlabs", "sk-secret");
    store.clear("elevenlabs");
    expect(store.get("elevenlabs")).toBeNull();
    expect(store.has("elevenlabs")).toBe(false);
    expect(storage.map.has("speaking-editor:key:elevenlabs")).toBe(false);
  });

  it("keys are namespaced per provider and do not collide", () => {
    const store = new KeyStore(fakeStorage());
    store.set("elevenlabs", "eleven");
    store.set("openai", "open");
    expect(store.get("elevenlabs")).toBe("eleven");
    expect(store.get("openai")).toBe("open");
  });

  it("stores nothing anywhere but localStorage (no plaintext leaks to a settings object)", () => {
    const storage = fakeStorage();
    const store = new KeyStore(storage);
    store.set("elevenlabs", "sk-secret");
    // the only place the secret lives is the storage map, under the key namespace
    expect([...storage.map.keys()]).toEqual(["speaking-editor:key:elevenlabs"]);
  });
});
