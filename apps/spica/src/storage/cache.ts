export class LastUpdateCache {
  private lastUpdates: Map<string, string> = new Map();

  private now() {
    return new Date().getTime().toString();
  }

  register(id: string) {
    if (!this.lastUpdates.has(id)) {
      this.lastUpdates.set(id, this.now());
    }

    return this.lastUpdates.get(id);
  }

  unregister(id: string) {
    this.lastUpdates.delete(id);
  }
}
