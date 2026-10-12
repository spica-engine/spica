import {DatabaseService} from "@spica-server/database";
import {ICollection} from "@spica-server/database-driver";
import {Observable} from "rxjs";
import {stream as mongoShim} from "./watch-shim";

export interface WatchProbe {
  /** Waits until the watch is set up and **live**; returns `[collectionName, ...watchArguments]`. */
  wait(): Promise<Array<string | object>>;
  change: {
    /** Prepares to wait for the next event. It has to be called BEFORE the event is written. */
    next(): void;
    /** Gives the first event that arrives after `next()`. */
    wait(): Promise<unknown>;
  };
}

/**
 * A test probe that observes `watch()` calls — one API, two implementations.
 *
 * `Observable.subscribe` is synchronous while setting a stream up is a round trip, so a document written
 * right after subscribing can be missed. That is harmless in production (subscriptions are long-lived) but
 * in a test one has to wait for the setup to have **completed**, and `wait()` is that wait: it resolves on
 * the driver's own `onReady` (the Mongo leg keeps the existing cursor-probing shim).
 *
 * It wraps `database.collection`, so it has to be created **before** the observed service: a `watch()` call
 * made in a constructor happens before the wrapping and `wait()` would never resolve.
 */
export function probeWatch(database: DatabaseService): WatchProbe {
  if (database.capabilities.backend === "mongodb") {
    return mongoShim;
  }

  let resolveReady: (value: Array<string | object>) => void;
  const readyPromise: Promise<Array<string | object>> = new Promise(r => (resolveReady = r));

  let resolveChange: (value: unknown) => void;
  let changePromise: Promise<unknown> = new Promise(r => (resolveChange = r));

  // The instance, not the prototype: patching `Db.prototype.collection` works on MongoDB only and relies
  // on the driver using a raw `Db` internally.
  const originalCollection = database.collection.bind(database);

  database.collection = ((name: string, options?: any) => {
    const collection = originalCollection(name, options) as ICollection<any>;
    const originalWatch = collection.watch.bind(collection);

    collection.watch = (pipeline?: object[], watchOptions?: any): Observable<any> =>
      new Observable(observer => {
        const args: Array<string | object> = [name];
        if (pipeline !== undefined) args.push(pipeline);
        if (watchOptions !== undefined) args.push(watchOptions);

        const subscription = originalWatch(pipeline, {
          ...watchOptions,
          onReady: () => {
            watchOptions?.onReady?.();
            resolveReady(args);
          }
        }).subscribe({
          next: value => {
            resolveChange(value);
            observer.next(value);
          },
          error: error => observer.error(error),
          complete: () => observer.complete()
        });

        return () => subscription.unsubscribe();
      });

    return collection;
  }) as typeof database.collection;

  return {
    wait: () => readyPromise,
    change: {
      next() {
        changePromise = new Promise(r => (resolveChange = r));
      },
      wait: () => changePromise
    }
  };
}
