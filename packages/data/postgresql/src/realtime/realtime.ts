import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {BUCKET_QUERY, BucketQueryFacade} from "@spica-server/interface-bucket-common";
import {CHANGE_FEED} from "@spica-server/interface-data";
import {Document, Realtime, RealtimeOptions, StreamChunk} from "@spica-server/interface-realtime";
import {
  bufferTime,
  filter,
  Observable,
  ReplaySubject,
  Subscription,
  concatMap,
  throwError
} from "rxjs";
import {BUCKET_TABLE_PREFIX, PostgresChangeFeed} from "../change/index.js";
import {ORM} from "../orm.js";
import {StoredBuckets} from "../repositories/bucket/stored-buckets.js";
import {BucketSource} from "./source.js";
import {KeyChange, RealtimeWindow} from "./window.js";

const BATCH_MS = 10;

export class RealtimeError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const preferences = () => Promise.reject(new Error("Preferences are not read by realtime."));

@Injectable()
export class PostgresRealtime implements Realtime {
  private readonly stored: StoredBuckets;

  constructor(
    @Inject(CHANGE_FEED) private readonly feed: PostgresChangeFeed,
    @Inject(BUCKET_QUERY) private readonly query: BucketQueryFacade,
    @Inject(ORM) orm: Orm
  ) {
    this.stored = new StoredBuckets(orm);
  }

  find<T extends Document = any>(
    name: string,
    options: RealtimeOptions = {}
  ): Observable<StreamChunk<T>> {
    if (!name.startsWith(BUCKET_TABLE_PREFIX)) {
      return throwError(
        () => new RealtimeError(501, `Realtime of "${name}" is not available on PostgreSQL.`)
      );
    }

    return new Observable<StreamChunk<T>>(subscriber => {
      const changes = new ReplaySubject<KeyChange>();
      const subscription = new Subscription();
      subscription.add(
        this.feed.watch(name, {keysOnly: true}).subscribe(change => {
          if (change.key !== undefined && change.operation != "drop") {
            changes.next({
              key: change.key,
              operation: change.operation == "replace" ? "update" : change.operation
            });
          }
        })
      );
      subscription.add(
        this.feed.gaps.subscribe(() =>
          subscriber.error(
            new RealtimeError(503, "The connection to the database was interrupted. Reconnect.")
          )
        )
      );

      const start = async () => {
        await this.feed.ready();
        const bucket = await this.stored.find(name.slice(BUCKET_TABLE_PREFIX.length));
        if (!bucket) {
          throw new RealtimeError(404, `The bucket of "${name}" does not exist.`);
        }

        const context = {
          resolveSchema: async (id: unknown) => {
            const found = await this.stored.find(String(id));
            if (!found) {
              throw new RealtimeError(404, `The bucket "${id}" does not exist.`);
            }
            return found;
          },
          preferences,
          hashSecret: options.hashSecret
        };
        const window = new RealtimeWindow(new BucketSource(this.query, bucket, context, options), {
          primary: bucket.primary,
          sorted: Boolean(options.sort),
          ranged: Boolean(options.skip || options.limit)
        });

        for (const chunk of await window.initial()) {
          subscriber.next(chunk as StreamChunk<T>);
        }
        subscription.add(
          changes
            .pipe(
              bufferTime(BATCH_MS),
              filter(batch => batch.length > 0),
              concatMap(batch => window.apply(batch))
            )
            .subscribe({
              next: chunks => chunks.forEach(chunk => subscriber.next(chunk as StreamChunk<T>)),
              error: error => subscriber.error(error)
            })
        );
      };
      start().catch(error => subscriber.error(error));

      return () => subscription.unsubscribe();
    });
  }

  doesEmitterExist() {
    return false;
  }

  removeEmitter() {}
}
