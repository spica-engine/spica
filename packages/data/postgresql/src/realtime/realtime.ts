import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BUCKET_QUERY, BucketQueryFacade} from "@spica-server/interface-bucket-common";
import {CHANGE_FEED, COLLECTION_QUERY, CollectionQueryFacade} from "@spica-server/interface-data";
import {Document, Realtime, RealtimeOptions, StreamChunk} from "@spica-server/interface-realtime";
import {Observable, throwError} from "rxjs";
import {BUCKET_TABLE_PREFIX, PostgresChangeFeed, trackedEntityOf} from "../change/index.js";
import {fieldRulesOf} from "../access/index.js";
import {ORM} from "../orm.js";
import {StoredBuckets} from "../repositories/bucket/stored-buckets.js";
import {CollectionSource} from "./collection-source.js";
import {fieldsOfExpression} from "./fields.js";
import {prefilterOf} from "./prefilter.js";
import {RealtimeHub} from "./hub.js";
import {Limiter} from "./limiter.js";
import {BucketSource} from "./source.js";
import {RealtimeSubscriber} from "./subscriber.js";
import {RealtimeWindow} from "./window.js";

const MAX_CONCURRENT_EVALUATIONS = 8;

export class RealtimeError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const preferences = () => Promise.reject(new Error("Preferences are not read by realtime."));

function rulesOf(bucket: Bucket, options: RealtimeOptions) {
  return [
    typeof options.filter == "string" ? options.filter : undefined,
    options.applyAcl ? bucket.acl?.read : undefined
  ].filter((rule): rule is string => typeof rule == "string");
}

function relevantFields(bucket: Bucket, options: RealtimeOptions) {
  const dependencies: (Set<string> | undefined)[] = [];
  if (options.filter !== undefined) {
    dependencies.push(
      typeof options.filter == "string" ? fieldsOfExpression(options.filter) : undefined
    );
  }
  if (options.applyAcl && bucket.acl?.read) {
    dependencies.push(fieldsOfExpression(bucket.acl.read));
  }
  if (options.sort) {
    dependencies.push(new Set(Object.keys(options.sort).map(path => path.split(".")[0])));
  }
  const hidesFields = options.applyAcl && fieldRulesOf(bucket).length > 0;
  return hidesFields || dependencies.includes(undefined)
    ? undefined
    : new Set(dependencies.flatMap(fields => [...fields!]));
}

@Injectable()
export class PostgresRealtime implements Realtime {
  readonly filterLanguage = "expression";

  private readonly stored: StoredBuckets;
  private readonly hubs = new Map<string, RealtimeHub>();
  private readonly limiter = new Limiter(MAX_CONCURRENT_EVALUATIONS);

  constructor(
    @Inject(CHANGE_FEED) private readonly feed: PostgresChangeFeed,
    @Inject(BUCKET_QUERY) private readonly query: BucketQueryFacade,
    @Inject(COLLECTION_QUERY) private readonly collections: CollectionQueryFacade,
    @Inject(ORM) orm: Orm
  ) {
    this.stored = new StoredBuckets(orm);
  }

  find<T extends Document = any>(
    name: string,
    options: RealtimeOptions = {}
  ): Observable<StreamChunk<T>> {
    const isBucket = name.startsWith(BUCKET_TABLE_PREFIX);
    const entity = isBucket ? undefined : trackedEntityOf(name);
    if (!isBucket && !entity) {
      return throwError(
        () => new RealtimeError(501, `Realtime of "${name}" is not available on PostgreSQL.`)
      );
    }

    return new Observable<StreamChunk<T>>(observer => {
      const subscriber = new RealtimeSubscriber(
        this.limiter,
        chunks => chunks.forEach(chunk => observer.next(chunk as StreamChunk<T>)),
        error => observer.error(error)
      );
      const leave = this.hubOf(name).join(subscriber);

      const start = async () => {
        await this.feed.ready();
        await subscriber.start(
          entity
            ? new RealtimeWindow(
                new CollectionSource(this.collections, name, entity.idProperty, options),
                {
                  primary: entity.idProperty,
                  sorted: Boolean(options.sort),
                  ranged: Boolean(options.skip || options.limit)
                }
              )
            : await this.bucketWindow(name, options)
        );
      };
      start().catch(error => subscriber.fail(error));

      return () => {
        subscriber.close();
        leave();
      };
    });
  }

  private async bucketWindow(name: string, options: RealtimeOptions) {
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
    return new RealtimeWindow(new BucketSource(this.query, bucket, context, options), {
      primary: bucket.primary,
      sorted: Boolean(options.sort),
      ranged: Boolean(options.skip || options.limit),
      relevant: relevantFields(bucket, options),
      prefilter: prefilterOf(bucket, rulesOf(bucket, options), options.user)
    });
  }

  doesEmitterExist() {
    return false;
  }

  removeEmitter() {}

  private hubOf(name: string) {
    let hub = this.hubs.get(name);
    if (!hub) {
      const created: RealtimeHub = new RealtimeHub(
        this.feed,
        name,
        () => {
          if (this.hubs.get(name) === created) {
            this.hubs.delete(name);
          }
        },
        () => new RealtimeError(503, "The connection to the database was interrupted. Reconnect.")
      );
      this.hubs.set(name, created);
      hub = created;
    }
    return hub;
  }
}
