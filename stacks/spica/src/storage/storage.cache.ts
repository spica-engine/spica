export class StorageCacheTracker {
  private lastUpdates: Map<string, string> = new Map();

  constructor(initialids?: string[]) {
    if (initialids) {
      for (const id of initialids) {
        this.lastUpdates.set(id, this.getNow());
      }
    }
  }

  private register(id: string) {
    this.lastUpdates.set(id, this.getNow());
  }

  private getNow() {
    return new Date().getTime().toString();
  }

  getLastUpdate(id: string) {
    if (!this.lastUpdates.has(id)) {
      this.register(id);
    }

    return this.lastUpdates.get(id);
  }

  unregister(id: string) {
    this.lastUpdates.delete(id);
  }
}
