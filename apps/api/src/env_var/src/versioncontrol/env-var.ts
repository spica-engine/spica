import {IRepresentativeManager} from "@spica-server/interface/representative";
import {SyncProvider} from "@spica-server/versioncontrol";

export const getVCSyncProvider = (manager: IRepresentativeManager): SyncProvider => {
  const name = "env-vars-schema";
  const module = "env-var";

  const getAll = () => Promise.resolve([]);

  const insert = () => Promise.resolve();

  const update = () => Promise.resolve();

  const remove = () => Promise.resolve();

  const document = {
    getAll,
    insert,
    update,
    delete: remove
  };

  const write = () => Promise.resolve();

  const rm = () => Promise.resolve();

  const readAll = () => Promise.resolve([]);

  const representative = {
    getAll: readAll,
    insert: write,
    update: write,
    delete: rm
  };

  return {
    name,
    document,
    representative,
    parents: 0
  };
};
