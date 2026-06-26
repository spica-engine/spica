import {ChangeStreamOptions, Collection, Db, Document} from "mongodb";

function withWatchDefaults<T extends Document>(
  col: Collection<T>,
  defaults: ChangeStreamOptions
): Collection<T> {
  return new Proxy(col, {
    get(target, prop, receiver) {
      if (prop !== "watch") return Reflect.get(target, prop, receiver);
      return (pipeline: Document[] = [], opts: ChangeStreamOptions = {}) =>
        Reflect.apply(target.watch, target, [pipeline, {...defaults, ...opts}]);
    }
  });
}

export function withChangeStreamDefaults(db: Db, defaults: ChangeStreamOptions): Db {
  return new Proxy(db, {
    get(target, prop, receiver) {
      if (prop !== "collection") return Reflect.get(target, prop, receiver);
      return (...args: Parameters<Db["collection"]>) =>
        withWatchDefaults(Reflect.apply(target.collection, target, args), defaults);
    }
  });
}
