import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional
} from "@nestjs/common";
import {Validator} from "@spica-server/core-schema";
import {Default} from "@spica-server/interface-core";
import {PreferenceService} from "@spica-server/preference-services";
import {deepCopy} from "@spica-server/core-patch";
import {ids} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";
import {BehaviorSubject, Observable, Subscription} from "rxjs";
import {filter, switchMap} from "rxjs/operators";
import {BucketChangeDispatcher} from "./change-dispatcher.js";
import {
  Bucket,
  BucketPreferences,
  BUCKET_DATA_LIMIT,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER,
  BucketRepository,
  BucketSchemaManager,
  StoredBucket
} from "@spica-server/interface-bucket";

export const bucketIds = () => ids().forCollection("buckets");

@Injectable()
export class BucketService implements OnModuleInit, OnModuleDestroy {
  schemaChangeEmitter: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);

  private readonly logger = new Logger(BucketService.name);
  private schemaCache = new Map<string, Bucket>();
  private cacheSub?: Subscription;
  private destroyed = false;

  constructor(
    @Inject(BUCKET_REPOSITORY) private buckets: BucketRepository,
    @Inject(BUCKET_SCHEMA_MANAGER) private schemaManager: BucketSchemaManager,
    private pref: PreferenceService,
    private validator: Validator,
    private changeDispatcher: BucketChangeDispatcher,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit
  ) {}

  async onModuleInit() {
    await this.warmSchemaCache();
    this.startSchemaCacheWatch();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.cacheSub?.unsubscribe();
  }

  private async warmSchemaCache() {
    const all = await this.buckets.findAll();
    this.schemaCache = new Map(all.map(bucket => [bucket._id.toString(), bucket]));
  }

  private startSchemaCacheWatch() {
    if (this.destroyed) {
      return;
    }
    this.cacheSub = this.changeDispatcher.watch().subscribe({
      next: async change => {
        const id = change.documentKey._id.toString();
        if (change.operationType === "delete") {
          this.schemaCache.delete(id);
          return;
        }
        const bucket = await this.buckets.findById(change.documentKey._id);
        if (bucket) {
          this.schemaCache.set(id, bucket);
        } else {
          this.schemaCache.delete(id);
        }
      },
      error: error =>
        this.logger.error(
          `bucket schema cache watch error: ${error instanceof Error ? error.message : error}`
        )
    });
  }

  resolveSchema = (id: string | Id): Bucket | Promise<Bucket> => {
    const cached = this.schemaCache.get(id.toString());
    return cached ? deepCopy(cached) : this.buckets.findById(bucketIds().parse(id));
  };

  findAll(): Promise<StoredBucket[]> {
    return this.buckets.findAll();
  }

  findById(id: Id): Promise<StoredBucket | null> {
    return this.buckets.findById(id);
  }

  getPreferences() {
    return this.pref.get<BucketPreferences>("bucket");
  }

  emitSchemaChanges() {
    this.schemaChangeEmitter.next(undefined);
  }

  async totalDocCountValidation(count: number) {
    if (!this.bucketDataLimit) {
      return;
    }

    const existing = await this.buckets.sumOfCountLimits();

    if (existing + count > this.bucketDataLimit) {
      throw new Error(`Remained document count limit is ${this.bucketDataLimit - existing}`);
    }
  }

  async insert(bucket: Bucket) {
    await this.totalDocCountValidation(
      bucket.documentSettings ? bucket.documentSettings.countLimit : 0
    );

    return this.schemaManager.create(bucket, inserted => {
      this.schemaCache.set(inserted._id.toString(), deepCopy(inserted));
      this.changeDispatcher.dispatch({operationType: "insert", documentKey: {_id: inserted._id}});
    });
  }

  replaceById(id: Id, bucket: Bucket): Promise<StoredBucket | null> {
    return this.schemaManager.replace(id, bucket, replaced => {
      this.schemaCache.set(replaced._id.toString(), deepCopy(replaced));
      this.changeDispatcher.dispatch({operationType: "replace", documentKey: {_id: replaced._id}});
    });
  }

  async drop(id: string | Id) {
    const dropped = await this.schemaManager.drop(bucketIds().parse(id), schema => {
      this.schemaCache.delete(id.toString());
      this.changeDispatcher.dispatch({operationType: "delete", documentKey: {_id: schema._id}});
    });
    if (!dropped) {
      throw new NotFoundException(`Bucket with ID ${id} does not exist.`);
    }
    return dropped;
  }

  async unsetProperties(id: Id, paths: string[]): Promise<number> {
    const affected = await this.buckets.findById(id);
    const result = await this.buckets.unsetProperties(id, paths);
    if (affected) {
      this.changeDispatcher.dispatch({operationType: "update", documentKey: {_id: affected._id}});
    }
    return result;
  }

  watchBucket(bucketId: string, propagateOnStart: boolean): Observable<Bucket> {
    const _id = bucketIds().parse(bucketId);
    return new Observable(observer => {
      if (propagateOnStart) {
        this.buckets.findById(_id).then(bucket => observer.next(bucket));
      }
      const sub = this.changeDispatcher
        .watch()
        .pipe(
          filter(
            change =>
              bucketIds().equals(change.documentKey._id, _id) && change.operationType !== "delete"
          ),
          switchMap(change => this.buckets.findById(change.documentKey._id))
        )
        .subscribe(bucket => observer.next(bucket));
      return () => sub.unsubscribe();
    });
  }

  watchPreferences(propagateOnStart: boolean): Observable<BucketPreferences> {
    return this.pref.watchPreference("bucket", {propagateOnStart});
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }

  collNameToId(collName: string) {
    return collName.startsWith("bucket_") ? collName.replace("bucket_", "") : undefined;
  }
}
