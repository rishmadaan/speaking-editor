// Per-device API key storage. Keys NEVER enter data.json (a synced vault must
// never carry a secret); they live only in localStorage under a namespaced key.
// Wrapped behind an injectable Storage-like interface so it is unit-testable
// with a fake object (no real localStorage needed in tests).

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class KeyStore {
  constructor(private storage: StorageLike) {}

  private keyFor(providerId: string): string {
    return `speaking-editor:key:${providerId}`;
  }

  get(providerId: string): string | null {
    return this.storage.getItem(this.keyFor(providerId));
  }

  has(providerId: string): boolean {
    return this.get(providerId) !== null;
  }

  set(providerId: string, key: string): void {
    this.storage.setItem(this.keyFor(providerId), key);
  }

  clear(providerId: string): void {
    this.storage.removeItem(this.keyFor(providerId));
  }
}
