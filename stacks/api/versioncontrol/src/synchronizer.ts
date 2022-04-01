import {Injectable} from "@nestjs/common";
import {compareResourceGroups} from "@spica-server/core/differ";
import {SynchronizationDirection, SyncProvider} from "./interface";

@Injectable()
export class Synchronizer {
  private providers: SyncProvider[] = [];
  constructor() {}

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

  async _synchronize(direction: SynchronizationDirection) {
    for (const provider of this.providers) {
      let source;
      let target;

      if (direction == SynchronizationDirection.RepresentativeToDatabase) {
        source = provider.representative;
        target = provider.document;
      } else if (direction == SynchronizationDirection.DatabaseToRepresentative) {
        source = provider.document;
        target = provider.representative;
      }

      const sources = await source.getAll();
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
