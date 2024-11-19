import {Injectable} from "@nestjs/common";
import {compareResourceGroups} from "@spica/core";
import {Provider, SyncDirection, SyncLog, SyncProvider} from "./interface";

@Injectable()
export class Synchronizer {
  private providers: SyncProvider[] = [];

  constructor() {}

  register(provider: SyncProvider) {
    this.providers.push(provider);
  }

  async synchronize(direction: SyncDirection) {
    const syncLog: SyncLog = {resources: [], date: new Date().toISOString()};

    const maxDepth = this.providers.reduce((acc, curr) => {
      if (curr.parents > acc) {
        acc = curr.parents;
      }
      return acc;
    }, 0);

    for (let i = 0; i <= maxDepth; i++) {
      const providers = this.providers.filter(p => p.parents == i);

      const promises = [];

      for (const provider of providers) {
        const {source, target} = this.setSourceAndTarget(provider, direction);

        const sources = await source.getAll();
        const targets = await target.getAll();

        const {insertions, updations, deletions} = compareResourceGroups(
          sources,
          targets,
          provider.comparisonOptions
        );

        promises.push(...insertions.map(doc => target.insert(doc)));
        promises.push(...updations.map(doc => target.update(doc)));
        promises.push(...deletions.map(doc => target.delete(doc)));

        const resource = {module: provider.name, insertions: [], updations: [], deletions: []};

        resource.insertions.push(...insertions);
        resource.updations.push(...updations);
        resource.deletions.push(...deletions);

        syncLog.resources.push(resource);
      }

      await Promise.all(promises);
    }

    return syncLog;
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
