import {Inject, Injectable, Logger, OnModuleDestroy} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {BUCKET_QUERY, BucketQueryFacade} from "@spica-server/interface-bucket-common";
import {ChangeEvent, ChangeFeed, ChangeFeedOptions, PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {catchError, concatMap, defer, EMPTY, filter, from, NEVER, Observable} from "rxjs";
import {ORM} from "../orm.js";
import {BUCKET_TABLE_PREFIX, BucketLoader} from "./bucket-loader.js";
import {ChangeNotice} from "./coalescer.js";
import {LoadedRow} from "./loaded-row.js";
import {ChangeListener} from "./listener.js";
import {SystemLoader} from "./system-loader.js";
import {trackedEntityOf} from "./tracked.js";

interface Source {
  table: string;
  load(notice: ChangeNotice): Promise<LoadedRow>;
  previousOf(before: Record<string, unknown>): Record<string, unknown> | undefined;
}

@Injectable()
export class PostgresChangeFeed implements ChangeFeed, OnModuleDestroy {
  private readonly logger = new Logger(PostgresChangeFeed.name);
  private readonly listener: ChangeListener;
  private readonly buckets: BucketLoader;
  private readonly orm: Orm;
  private readonly loaded = new WeakMap<ChangeNotice, Promise<LoadedRow>>();
  private readonly systems = new Map<string, Source>();

  constructor(
    @Inject(PG_POOL) pool: pg.Pool,
    @Inject(ORM) orm: Orm,
    @Inject(BUCKET_QUERY) query: BucketQueryFacade
  ) {
    this.listener = new ChangeListener(pool.options.connectionString as string);
    this.buckets = new BucketLoader(orm, query);
    this.orm = orm;
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
    const source = this.sourceOf(collection);
    if (!source) {
      this.logger.warn(`Changes of "${collection}" are not available on PostgreSQL.`);
      return NEVER;
    }

    return defer(() => {
      void this.ready();
      return this.listener.notices;
    }).pipe(
      filter(
        notice =>
          notice.table == source.table &&
          (!options.operations || options.operations.includes(notice.operation))
      ),
      concatMap(notice =>
        from(this.eventOf<T>(source, collection, notice, options)).pipe(
          catchError(error => {
            this.logger.error(`Change ${notice.id} could not be read: ${error.message}`);
            return EMPTY;
          })
        )
      )
    );
  }

  private sourceOf(collection: string): Source | undefined {
    if (collection.startsWith(BUCKET_TABLE_PREFIX)) {
      return {
        table: collection,
        load: notice => this.buckets.load(notice.table, notice.key, notice.columns),
        previousOf: () => undefined
      };
    }

    const entity = trackedEntityOf(collection);
    if (!entity) {
      return undefined;
    }
    if (!this.systems.has(entity.table)) {
      const loader = new SystemLoader(this.orm, entity);
      this.systems.set(entity.table, {
        table: entity.table,
        load: notice => loader.load(notice.key, notice.columns),
        previousOf: before => loader.previous(before)
      });
    }
    return this.systems.get(entity.table);
  }

  private async eventOf<T>(
    source: Source,
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
    if (options.beforeChange == "whenAvailable" && notice.before) {
      event.previousDocument = source.previousOf(notice.before) as T;
    }
    if (notice.operation == "delete" || options.keysOnly) {
      return event;
    }

    const {document, changedFields} = await this.load(source, notice);
    if (notice.operation == "insert" || options.document == "current") {
      event.document = document as T;
    }
    if (notice.operation == "update") {
      event.changes = changesOf(notice, document, changedFields);
    }
    return event;
  }

  private load(source: Source, notice: ChangeNotice) {
    if (!this.loaded.has(notice)) {
      this.loaded.set(notice, source.load(notice));
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
  if (!notice.columns && !notice.fields) {
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
