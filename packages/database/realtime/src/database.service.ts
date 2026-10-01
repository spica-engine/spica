import {Injectable, OnModuleDestroy} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {StreamChunk} from "@spica-server/interface-realtime";
import {from, Observable} from "rxjs";
import {switchMap} from "rxjs/operators";
import {FindOptions} from "@spica-server/interface-database";
import {Emitter} from "./stream.js";
import isEqual from "lodash/isEqual.js";
import {PassThrough, Readable} from "stream";
import {Subscription} from "rxjs";

interface ChangeStreamEntry {
  name: string;
  subscription: Subscription;
  hub: PassThrough;
  /** Resolves once the stream can observe subsequent writes; see `ChangeStreamOptions.onReady`. */
  ready: Promise<void>;
}

@Injectable()
export class RealtimeDatabaseService implements OnModuleDestroy {
  constructor(private database: DatabaseService) {}

  private changeStreams = new Map<string, ChangeStreamEntry>();

  /**
   * One stream per collection; the subscribers are multiplexed through the `hub`.
   *
   * `stream.stream()` (the Node `Readable` of Mongo's `ChangeStream`) is gone: in the
   * contract `watch()` returns an `Observable`. The bridge is one line — the subscription writes to the
   * `hub`. The payload is still the raw Mongo change document (the same rationale as the payload is
   * exposed to users).
   */
  private getChangeStream(name: string): ChangeStreamEntry {
    if (this.changeStreams.has(name)) {
      return this.changeStreams.get(name)!;
    }

    const hub = new PassThrough({objectMode: true});
    // No listener limit: it prevents MaxListenersExceededWarning on a collection with many subscribers.
    hub.setMaxListeners(0);
    // An unhandled 'error' event brings the process down.
    hub.on("error", err => console.error(`[ChangeStream/${name}] hub error: ${err.message}`));

    let announceReady: () => void;
    const ready = new Promise<void>(resolve => (announceReady = resolve));

    const subscription = this.database
      .collection(name)
      .watch([], {
        fullDocument: "updateLookup",
        maxAwaitTimeMS: this.database.changeStreamAwaitTimeMS,
        onReady: () => announceReady()
      })
      .subscribe({
        next: change => {
          // A last event arriving during shutdown can give `ERR_STREAM_WRITE_AFTER_END`.
          if (hub.writable) hub.write(change);
        },
        error: err => {
          console.error(`[ChangeStream/${name}] stream error: ${err.message}`);
          // A stream that failed will never announce readiness; releasing the gate keeps the subscriber
          // from hanging, and the error is already reported.
          announceReady();
        }
      });

    const entry: ChangeStreamEntry = {name, subscription, hub, ready};
    this.changeStreams.set(name, entry);

    return entry;
  }

  private emitters = new Map<string, {value: Emitter<any>; listenerCount: number}>();
  private getEmitter(name: string, options: FindOptions<any>) {
    let emitterName = this.findEmitterName(name, options);

    if (emitterName) {
      const emitter = this.emitters.get(emitterName);
      emitter.listenerCount++;
      return emitter.value;
    }

    const {hub} = this.getChangeStream(name);
    const emitter = {
      value: new Emitter(this.database.collection(name), hub, options),
      listenerCount: 1
    };

    emitterName = this.getUniqueEmitterName(name, options);
    this.emitters.set(emitterName, emitter);

    return emitter.value;
  }

  private findEmitterName(name: string, options: FindOptions<any>) {
    for (const key of this.emitters.keys()) {
      const emitterFilter = key.includes(name) ? JSON.parse(key.replace(name + "_", "")) : false;

      // we have to lose special types like ObjectId, Date in this options in order to compare it with emitterFilter correctly
      const pureOptions = JSON.parse(JSON.stringify(options));
      if (emitterFilter && isEqual(emitterFilter, pureOptions)) {
        return key;
      }
    }

    return undefined;
  }

  doesEmitterExist(name: string, options: FindOptions<any>) {
    return !!this.findEmitterName(name, options);
  }

  async onModuleDestroy() {
    const closedStreams = new Set<string>();
    await Promise.all(
      Array.from(this.emitters).map(([_, emitter]) => {
        const collName = emitter.value.collectionName;
        if (closedStreams.has(collName)) {
          return;
        }
        closedStreams.add(collName);
        const entry = this.changeStreams.get(collName);
        this.changeStreams.delete(collName);
        if (entry) {
          return this.closeStreamSafely(entry);
        }
      })
    );
    this.emitters.clear();
    this.changeStreams.clear();
  }

  removeEmitter(name: string, options: FindOptions<any>) {
    const emitterName = this.findEmitterName(name, options);

    const emitter = this.emitters.get(emitterName);

    emitter.listenerCount--;

    if (emitter.listenerCount == 0) {
      this.emitters.delete(emitterName);
      const collName = emitter.value.collectionName;

      const streamListenersRemain = Array.from(this.emitters.values())
        .map(v => v.value.collectionName)
        .some(name => name == collName);

      if (!streamListenersRemain) {
        const entry = this.changeStreams.get(collName);
        if (entry) {
          this.closeStreamSafely(entry);
        }
        this.changeStreams.delete(collName);
      }
    }
  }

  getUniqueEmitterName(name: string, options: FindOptions<any>) {
    return `${name}_${JSON.stringify(options)}`;
  }

  /**
   * The initial read waits for the change stream to be live.
   *
   * The two have to be ordered, and the order is not free: a subscriber is told `EndOfInitial` and then
   * writes, and on MongoDB the stream's start point is only fixed when the server runs the `aggregate` —
   * a few milliseconds after `watch()` returns. Reading first meant the subscriber's own write could
   * land inside that window and produce **no event at all**. Deferring the initial read closes it:
   * by the time anything is sent to the client, every later write is inside the stream's window.
   */
  find<T extends Document = any>(
    name: string,
    options: FindOptions<T> = {}
  ): Observable<StreamChunk<T>> {
    const {ready} = this.getChangeStream(name);
    return from(ready).pipe(switchMap(() => this.getEmitter(name, options).getObservable()));
  }

  /** The order matters: calling `hub.end()` before the production is stopped gives `ERR_STREAM_WRITE_AFTER_END`. */
  private closeStreamSafely(entry: ChangeStreamEntry) {
    if (!entry) return;

    if (entry.subscription.closed) {
      console.warn(`Change stream for collection ${entry.name} is already closed.`);
      return;
    }

    entry.subscription.unsubscribe();
    entry.hub.end();
  }
}
