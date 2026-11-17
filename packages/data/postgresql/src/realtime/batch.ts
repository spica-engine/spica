export class BatchQueries {
  private readonly results = new Map<string, Promise<unknown>>();

  once<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!this.results.has(key)) {
      this.results.set(key, load());
    }
    return this.results.get(key) as Promise<T>;
  }
}
