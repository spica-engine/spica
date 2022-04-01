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

export interface SyncProvider {
  document: DocumentProvider;
  representative: RepresentativeProvider;
}

@Injectable()
export class Synchronizer {
  private providers: SyncProvider[] = [];
  constructor() {
    setTimeout(() => {
      this._synchronize();
    },5000);
  }

  register({representative, document}: SyncProvider) {
    this.providers.push({representative, document});
  }

  async synchronize() {
    for (const provider of this.providers) {
      const sources = await provider.document.getAll();
      const targets = await provider.representative.getAll();

      const {inserts, updates, deletes} = compareResourceGroups(sources, targets);

      const promises = [];

      promises.push(inserts.map(doc => provider.representative.insert(doc)));
      promises.push(updates.map(doc => provider.representative.update(doc)));
      promises.push(deletes.map(doc => provider.representative.delete(doc)));

      await Promise.all(promises);
    }
  }

  async _synchronize() {
    for (const provider of this.providers) {
      const sources = await provider.representative.getAll();
      const targets = await provider.document.getAll();

      const {inserts, updates, deletes} = compareResourceGroups(sources, targets);

      const promises = [];

      promises.push(inserts.map(doc => provider.document.insert(doc)));
      promises.push(updates.map(doc => provider.document.update(doc)));
      promises.push(deletes.map(doc => provider.document.delete(doc)));

      await Promise.all(promises);
    }
  }
}
