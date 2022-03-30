import {compareResourceGroups} from "@spica-server/core/differ";

export interface RepresentativeProvider<T = any> {
  module: string;
  getAll: () => Promise<T[]>;
  insert: (document: T) => Promise<T>;
  update: (document: T) => Promise<T>;
  delete: (id: string) => Promise<void>;
}

export interface DocumentProvider<T = any> {
  module: string;
  getAll: () => Promise<T[]>;
  insert: (rep: T) => Promise<T>;
  update: (rep: T) => Promise<T>;
  delete: (rep: T) => Promise<void>;
}

export class Synchronizer {
  constructor(
    private repsProviders: RepresentativeProvider[],
    private docsProviders: DocumentProvider[]
  ) {}

  async synchronize(modules: string[] = []) {
    // documents => representative
    for (const module of modules) {
      const repsProvider = this.repsProviders.find(p => p.module == module);
      const docsProvider = this.docsProviders.find(p => p.module == module);

      const sources = await docsProvider.getAll();
      const targets = await repsProvider.getAll();

      const {inserts, updates, deletes} = compareResourceGroups(sources, targets);

      const promises = [];

      promises.push(inserts.map(doc => repsProvider.insert(doc)));
      promises.push(updates.map(doc => repsProvider.update(doc)));
      promises.push(deletes.map(doc => repsProvider.delete(doc)));

      await Promise.all(promises);
    }
  }
}
