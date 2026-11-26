export class LruMap<K, V> extends Map<K, V> {
  constructor(private readonly maxEntries: number) {
    super();
  }

  get(key: K): V | undefined {
    if (!super.has(key)) {
      return undefined;
    }
    const value = super.get(key);
    super.delete(key);
    super.set(key, value);
    return value;
  }

  set(key: K, value: V): this {
    super.delete(key);
    super.set(key, value);
    if (this.size > this.maxEntries) {
      super.delete(this.keys().next().value);
    }
    return this;
  }
}
