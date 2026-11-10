import {Inject, Injectable, Logger, OnModuleDestroy} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {BUCKET_QUERY, BucketQueryFacade} from "@spica-server/interface-bucket-common";
import {ChangeEvent, ChangeFeed, ChangeFeedOptions, PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {catchError, concatMap, defer, EMPTY, filter, from, NEVER, Observable} from "rxjs";
import {ORM} from "../orm.js";
import {BUCKET_TABLE_PREFIX, BucketLoader, LoadedBucketRow} from "./bucket-loader.js";
import {ChangeNotice} from "./coalescer.js";
import {ChangeListener} from "./listener.js";

const UNKNOWN_FIELD = "*";

@Injectable()
export class PostgresChangeFeed implements ChangeFeed, OnModuleDestroy {
  private readonly logger = new Logger(PostgresChangeFeed.name);
  private readonly listener: ChangeListener;
  private readonly buckets: BucketLoader;
  private readonly loaded = new WeakMap<ChangeNotice, Promise<LoadedBucketRow>>();

  constructor(
    @Inject(PG_POOL) pool: pg.Pool,
    @Inject(ORM) orm: Orm,
    @Inject(BUCKET_QUERY) query: BucketQueryFacade
  ) {
    this.listener = new ChangeListener(pool.options.connectionString as string);
    this.buckets = new BucketLoader(orm, query);
  }

  get gaps() {
    return this.listener.gaps.asObservable();
  }

  ready() {
    return this.listener.start();
  }

  onModuleDestroy() {
    return this.listener.stop();
  }

  watch<T = any>(collection: string, options: ChangeFeedOptions = {}): Observable<ChangeEvent<T>> {
    if (!collection.startsWith(BUCKET_TABLE_PREFIX)) {
      this.logger.warn(`Changes of "${collection}" are not available on PostgreSQL.`);
      return NEVER;
    }

    return defer(() => {
      void this.ready();
      return this.listener.notices;
    }).pipe(
      filter(
        notice =>
          notice.table == collection &&
          (!options.operations || options.operations.includes(notice.operation))
      ),
      concatMap(notice =>
        from(this.eventOf<T>(collection, notice, options)).pipe(
          catchError(error => {
            this.logger.error(`Change ${notice.id} could not be read: ${error.message}`);
            return EMPTY;
          })
        )
      )
    );
  }

  private async eventOf<T>(
    collection: string,
    notice: ChangeNotice,
    options: ChangeFeedOptions
  ): Promise<ChangeEvent<T>> {
    const event: ChangeEvent<T> = {
      id: notice.id,
      operation: notice.operation,
      collection,
      key: notice.key
    };
    if (notice.operation == "delete") {
      return event;
    }

    const {document, changedFields} = await this.load(notice);
    if (notice.operation == "insert" || options.document == "current") {
      event.document = document as T;
    }
    if (notice.operation == "update") {
      event.changes = changesOf(notice, document, changedFields);
    }
    return event;
  }

  private load(notice: ChangeNotice) {
    if (!this.loaded.has(notice)) {
      this.loaded.set(notice, this.buckets.load(notice.table, notice.key, notice.columns));
    }
    return this.loaded.get(notice);
  }
}

function changesOf(
  notice: ChangeNotice,
  document: Record<string, unknown> | undefined,
  changedFields: string[]
): NonNullable<ChangeEvent["changes"]> {
  if (!document) {
    return {updated: {}, removed: []};
  }
  if ((!notice.columns && !notice.fields) || notice.fields?.includes(UNKNOWN_FIELD)) {
    return {updated: document, removed: []};
  }

  const fields = [...new Set([...changedFields, ...(notice.fields ?? [])])];
  const changes: NonNullable<ChangeEvent["changes"]> = {updated: {}, removed: []};
  for (const field of fields) {
    if (document[field] == null) {
      changes.removed.push(field);
    } else {
      changes.updated[field] = document[field];
    }
  }
  return changes;
}
