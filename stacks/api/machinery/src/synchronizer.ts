import {compareResourceGroups} from "@spica-server/core/differ";

export interface RepresentativeProvider<T = any> {
  kind: string;
  convert: (document: DocumentProvider) => T;
  getAll: () => Promise<T[]>;
  insert: (document: DocumentProvider) => Promise<T>;
  update: (id: string, document: DocumentProvider) => Promise<T>;
  delete: (id: string) => Promise<void>;
}

export interface DocumentProvider<T = any> {
  kind: string;
  convert: (rep: RepresentativeProvider) => T;
  getAll: () => Promise<T[]>;
  insert: (rep: RepresentativeProvider) => Promise<T>;
  update: (id: string, rep: RepresentativeProvider) => Promise<T>;
  delete: (rep: RepresentativeProvider) => Promise<void>;
}

export class Synchronizer {
  constructor(
    private repsProviders: RepresentativeProvider[],
    private docsProviders: DocumentProvider[]
  ) {}

  async synchronize(modules: string[] = []) {
    for (const module of modules) {
      const repsProvider = this.repsProviders.find(p => p.kind == module);
      const docsProvider = this.docsProviders.find(p => p.kind == module);

      const sources = await docsProvider.getAll();
      const targets = await repsProvider.getAll();

      const {inserts, updates, deletes} = compareResourceGroups(sources, targets);

      const promises = [];

      promises.push(inserts.map(insert => docsProvider.insert(insert)));
      promises.push(updates.map(update => docsProvider.update(update._id, update)));
      promises.push(deletes.map(del => docsProvider.delete(del._id)));

      await Promise.all(promises);
    }
  }
}
