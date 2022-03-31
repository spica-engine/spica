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
  private modules = [];
  constructor() {
    setTimeout(async () => {
      await this.synchronize();
    }, 5000);
  }

  register(reps: RepresentativeProvider[], docs: DocumentProvider[]) {
    this.repsProviders.push(...reps);
    this.docsProviders.push(...docs);

    this.modules.push(...reps.map(rep => rep.module));
  }

  async synchronize() {
    for (const module of this.modules) {
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
