import {Injectable} from "@nestjs/common";
import {compareResourceGroups} from "@spica-server/core/differ";
import {Provider, SyncDirection, SyncProvider} from "./interface";

@Injectable()
export class Synchronizer {
  private providers: SyncProvider[] = [];
  constructor() {}

  register({representative, document}: SyncProvider) {
    this.providers.push({representative, document});
  }

  async synchronize(direction: SyncDirection) {
    for (const provider of this.providers) {
      const {source, target} = this.setSourceAndTarget(provider, direction);

      const sources = await source.getAll();
      const targets = await target.getAll();

      const {inserts, updates, deletes} = compareResourceGroups(sources, targets);

      const promises = [];

      promises.push(inserts.map(doc => target.insert(doc)));
      promises.push(updates.map(doc => target.update(doc)));
      promises.push(deletes.map(doc => target.delete(doc)));

      await Promise.all(promises);
    }
  }

  private setSourceAndTarget(provider: SyncProvider, direction: SyncDirection) {
    let source: Provider;
    let target: Provider;

    if (direction == SyncDirection.RepToDoc) {
      source = provider.representative;
      target = provider.document;
    } else if (direction == SyncDirection.DocToRep) {
      source = provider.document;
      target = provider.representative;
    } else {
      throw Error(`Unknown synchronization direction ${direction}`);
    }

    return {source, target};
  }
}
