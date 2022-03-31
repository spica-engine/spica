import {Injectable} from "@nestjs/common";
import {compareResourceGroups} from "@spica-server/core/differ";

export interface RepresentativeProvider {
  module: string;
  getAll: () => Promise<any[]>;
  insert: (document) => Promise<any>;
  update: (document) => Promise<any>;
  delete: (id) => Promise<void>;
}

export interface DocumentProvider {
  module: string;
  getAll: () => Promise<any[]>;
  insert: (rep) => Promise<any>;
  update: (rep) => Promise<any>;
  delete: (rep) => Promise<void>;
}

@Injectable()
export class Synchronizer {
  private repsProviders: RepresentativeProvider[] = [];
  private docsProviders: DocumentProvider[] = [];
  constructor() {}

  register(rep: RepresentativeProvider, doc: DocumentProvider) {
    this.repsProviders.push(rep);
    this.docsProviders.push(doc);
    setTimeout(() => {
      this.synchronize(["bucket"]);
    },5000);
  }

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
