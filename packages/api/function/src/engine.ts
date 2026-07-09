import {Inject, Injectable, Logger, Optional, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {Scheduler} from "@spica-server/function-scheduler";
import {DEFAULT_EVENT_CONCURRENCY} from "@spica-server/interface-function-scheduler";
import {DelegatePkgManager} from "@spica-server/interface-function-pkgmanager";
import {event} from "@spica-server/function-queue-proto";
import fs from "fs";
import {JSONSchema7} from "json-schema";
import path from "path";
import {FunctionService, FunctionAssetService} from "@spica-server/function-services";
import {
  CollectionSlug,
  Options,
  FUNCTION_OPTIONS,
  COLL_SLUG,
  Function,
  ChangeKind,
  TargetChange,
  SCHEMA,
  SchemaWithName
} from "@spica-server/interface-function";
import {SECRET_DECRYPTOR, SecretDecryptor} from "@spica-server/interface-secret";

import {createTargetChanges} from "./change.js";
import {FunctionAssetReconciler} from "./asset-reconciler.js";
import {SelfWriteTracker} from "./asset-write-tracker.js";
import {FunctionPreparationService} from "./function-preparation.service.js";
import {applyAssetChange} from "./asset-pipeline.js";
import {FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";

import HttpSchema from "./schema/http.json" with {type: "json"};
import ScheduleSchema from "./schema/schedule.json" with {type: "json"};
import FirehoseSchema from "./schema/firehose.json" with {type: "json"};
import SystemSchema from "./schema/system.json" with {type: "json"};
import RabbitMQSchema from "./schema/rabbitmq.json" with {type: "json"};
import GrpcSchema from "./schema/grpc.json" with {type: "json"};
import * as CRUD from "./crud.js";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface-replication";
import {Package} from "@spica-server/interface-function-pkgmanager";

@Injectable()
export class FunctionEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FunctionEngine.name);

  readonly schemas = new Map<string, unknown>([
    ["http", HttpSchema],
    ["schedule", ScheduleSchema],
    ["firehose", FirehoseSchema],
    ["system", SystemSchema],
    ["rabbitmq", RabbitMQSchema],
    ["grpc", GrpcSchema]
  ]);
  readonly runSchemas = new Map<string, JSONSchema7>();
  private cmdSubs: {unsubscribe: () => void};
  private watchEnvSubs: {unsubscribe: () => void};
  private watchSecretSubs: {unsubscribe: () => void};

  constructor(
    private fs: FunctionService,
    private db: DatabaseService,
    private scheduler: Scheduler,
    @Optional() private commander: ClassCommander,
    @Inject(FUNCTION_OPTIONS) private options: Options,
    @Optional() @Inject(SCHEMA) schema: SchemaWithName,
    @Optional() @Inject(COLL_SLUG) collSlug: CollectionSlug,
    @Inject(SECRET_DECRYPTOR) public secretDecryptor: SecretDecryptor,
    private reconciler: FunctionAssetReconciler,
    private assetService: FunctionAssetService,
    private tracker: SelfWriteTracker,
    private preparationService: FunctionPreparationService
  ) {
    if (schema) {
      this.schemas.set(schema.name, schema.schema);
    }

    this.schemas.set("database", () => getDatabaseSchema(this.db, collSlug));

    this.watchEnvSubs = this.fs.watchFunctionsForEnvChanges().subscribe({
      next: ({fns, envVarId, operationType}) =>
        fns.map(fn =>
          operationType == "delete"
            ? CRUD.environment.eject(this.fs, fn._id, this, envVarId)
            : CRUD.environment.reload(this.fs, fn._id, this)
        ),
      error: err =>
        this.logger.error(
          `Error received on listening functions for environment variable changes. Reason: ${JSON.stringify(err)}`
        )
    });

    this.watchSecretSubs = this.fs.watchFunctionsForSecretChanges().subscribe({
      next: ({fns, secretId, operationType}) =>
        fns.map(fn =>
          operationType == "delete"
            ? CRUD.secret.eject(this.fs, fn._id, this, secretId)
            : CRUD.secret.reload(this.fs, fn._id, this)
        ),
      error: err =>
        this.logger.error(
          `Error received on listening functions for secret changes. Reason: ${JSON.stringify(err)}`
        )
    });
  }

  onModuleInit() {
    const startupSequence = async () => {
      const fns = await this.fs.find();
      await this.reconciler.reconcileAll(fns);
      await this.registerTriggers();
      if (this.commander) {
        // trigger updates should be published to the other replicas except initial trigger registration
        this.cmdSubs = this.commander.register(this, [this.categorizeChanges], CommandType.SYNC);
      }
    };
    return startupSequence();
  }

  registerTriggers() {
    return this.updateTriggers(ChangeKind.Added);
  }

  unregisterTriggers() {
    return this.updateTriggers(ChangeKind.Removed);
  }

  private updateTriggers(kind: ChangeKind) {
    return CRUD.findForRuntime(this.fs).then(fns => {
      const targetChanges: TargetChange[] = [];
      for (const fn of fns) {
        targetChanges.push(...createTargetChanges(fn, kind, this.secretDecryptor));
      }
      this.categorizeChanges(targetChanges);
    });
  }

  onModuleDestroy() {
    if (this.commander) {
      this.cmdSubs.unsubscribe();
    }
    this.watchEnvSubs.unsubscribe();
    if (this.watchSecretSubs) {
      this.watchSecretSubs.unsubscribe();
    }
    return this.unregisterTriggers();
  }

  categorizeChanges(changes: TargetChange[]) {
    for (const change of changes) {
      switch (change.kind) {
        case ChangeKind.Added:
          this.subscribe(change);
          break;
        case ChangeKind.Updated:
          this.updateSubscription(change);
          break;
        case ChangeKind.Removed:
          this.unsubscribe(change);
          break;
      }
    }

    // Warm-worker reserve AND per-function event concurrency are per-function settings, so
    // reconcile them once per affected function from the function's authoritative state —
    // not per trigger. Driving it per trigger would let removing one trigger of a
    // multi-trigger function drain the whole reserve, and a multi-trigger update thrash it.
    const affectedFunctionIds = new Set(changes.map(change => change.target.id));
    for (const functionId of affectedFunctionIds) {
      this.reconcileRuntimeForFunction(functionId);
    }
  }

  private async reconcileRuntimeForFunction(functionId: string): Promise<void> {
    const fn = await this.findFunctionForRuntime(functionId);

    // the function no longer exists (deleted / invalid id) — drain whatever reserve it holds
    if (!fn) {
      this.scheduler.reconcileWarmWorkers(new event.Target({id: functionId}), 0);
      // reset to the default concurrency, which clears the function's sparse-map entry
      this.scheduler.reconcileConcurrency(
        new event.Target({id: functionId}),
        DEFAULT_EVENT_CONCURRENCY
      );
      return;
    }

    const triggers = fn.triggers || {};
    const hasActiveTrigger = Object.keys(triggers).some(handler => triggers[handler]?.active);
    const desired = hasActiveTrigger ? fn.warmWorkers ?? 0 : 0;
    const [change] = createTargetChanges(fn, ChangeKind.Added, this.secretDecryptor);
    const target = change ? this.buildTarget(change) : new event.Target({id: functionId});
    this.scheduler.reconcileWarmWorkers(target, desired);
    this.scheduler.reconcileConcurrency(target, fn.concurrency ?? DEFAULT_EVENT_CONCURRENCY);
  }

  private async findFunctionForRuntime(functionId: string) {
    try {
      return await CRUD.findOneForRuntime(this.fs, new ObjectId(functionId));
    } catch {
      return null;
    }
  }

  private getDefaultPackageManager(): DelegatePkgManager {
    return this.scheduler.pkgmanagers.get("node");
  }

  private getFunctionRoot(fn: Function) {
    return path.join(this.options.root, fn.name);
  }

  /**
   * Run npm install + compile for a function. Used by reconciler after restoring
   * assets from storage, and by CRUD pipeline after writing new files.
   */
  async prepareFunction(fn: Function): Promise<void> {
    return this.preparationService.prepare(fn);
  }

  /**
   * Store a single asset file for a function via the configured strategy.
   *
   * @param fn        The function whose asset is being changed.
   * @param filename  The asset filename (e.g. "index.ts" or "package.json").
   * @param op        Callback that performs all disk writes / installs / compiles
   *                  and returns the new file buffer to upload.
   */
  async storeAssets(
    fn: Function & {_id: ObjectId},
    filename: FunctionAssetFilename,
    op: () => Promise<Buffer>
  ): Promise<void> {
    return applyAssetChange(fn, filename, op, this.reconciler, this.assetService, this.tracker);
  }

  /**
   * Returns the asset storage filename (e.g. "index.ts" or "index.mjs") for
   * the function's build entrypoint, based on its language configuration.
   */
  getIndexFilename(fn: Function): FunctionAssetFilename {
    return this.getFunctionLanguage(fn).description.entrypoints.build as FunctionAssetFilename;
  }

  /**
   * Delete all stored assets for a function from both storage and metadata.
   * No-op when asset storage is not configured.
   */
  async removeAssets(fn: Function & {_id: ObjectId}): Promise<void> {
    return this.reconciler.deleteAll(fn);
  }

  getPackages(fn: Function): Promise<Package[]> {
    return this.getDefaultPackageManager().ls(this.getFunctionRoot(fn));
  }

  installPackages(fn: Function, qualifiedNames: string | string[]): Promise<void> {
    return this.preparationService.installPackages(fn, qualifiedNames);
  }

  removePackage(fn: Function, name: string): Promise<void> {
    return this.getDefaultPackageManager().uninstall(this.getFunctionRoot(fn), name);
  }

  async createFunction(fn: Function) {
    const functionRoot = this.getFunctionRoot(fn);
    const functionLanguage = this.getFunctionLanguage(fn);
    await fs.promises.mkdir(functionRoot, {recursive: true});
    // See: https://docs.npmjs.com/files/package.json#dependencies
    const packageJson = {
      name: fn.name,
      description: fn.description || "No description.",
      version: "0.0.1",
      private: true,
      keywords: ["spica", "function", "node.js"],
      license: "UNLICENSED",
      main: path.join(".", this.options.outDir, functionLanguage.description.entrypoints.runtime)
    };

    return fs.promises.writeFile(
      path.join(functionRoot, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
  }

  deleteFunction(fn: Function) {
    return this.preparationService.deleteFunctionDirectory(fn.name);
  }

  compile(fn: Function) {
    return this.preparationService.compile(fn);
  }

  async update(fn: Function, index: string): Promise<void> {
    return this.preparationService.writeFileBuffer(
      fn,
      this.getIndexFilename(fn),
      Buffer.from(index, "utf-8")
    );
  }

  read(fn: Function, scope: "index" | "dependency" | "tsconfig"): Promise<string> {
    let filename: string;
    switch (scope) {
      case "index":
        filename = this.getIndexFilename(fn);
        break;
      case "dependency":
        filename = "package.json";
        break;
      case "tsconfig":
        filename = "tsconfig.json";
        break;
      default:
        throw new Error(`Unknown read scope: "${scope}"`);
    }
    return this.preparationService.readFileBuffer(fn, filename).then(buf => {
      if (buf === null) return Promise.reject("Not Found");
      return buf.toString();
    });
  }

  getSchema(name: string): Promise<JSONSchema7 | null> {
    const schema = this.schemas.get(name);
    if (schema) {
      if (typeof schema == "function") {
        return schema();
      } else {
        return Promise.resolve(schema);
      }
    }
    return Promise.resolve(null);
  }

  getEnqueuer(name: string) {
    const enq = Array.from(this.scheduler.enqueuers);
    return enq.find(e => e.description.name == name);
  }

  private buildTarget(change: TargetChange): event.Target {
    return new event.Target({
      id: change.target.id,
      cwd: path.join(this.options.root, change.target.name),
      handler: change.target.handler,
      context: new event.SchedulingContext({
        env: Object.keys(change.target.context?.env || {}).reduce((envs, key) => {
          envs.push(
            new event.SchedulingContext.Env({
              key,
              value: change.target.context.env[key]
            })
          );
          return envs;
        }, []),
        timeout: change.target.context?.timeout
      })
    });
  }

  private subscribe(change: TargetChange) {
    const enqueuer = this.getEnqueuer(change.type);
    if (enqueuer) {
      enqueuer.subscribe(this.buildTarget(change), change.options);
    } else {
      this.logger.warn(`Couldn't find enqueuer ${change.type}.`);
    }
  }

  private updateSubscription(change: TargetChange) {
    this.unsubscribe(change);
    this.subscribe(change);
  }

  private unsubscribe(change: TargetChange) {
    const target = new event.Target({
      id: change.target.id,
      cwd: path.join(this.options.root, change.target.name),
      handler: change.target.handler
    });

    for (const enqueuer of this.scheduler.enqueuers) {
      enqueuer.unsubscribe(target);
    }
  }

  private getFunctionLanguage(fn: Function) {
    return this.scheduler.languages.get(fn.language);
  }

  getFunctionBuildEntrypoint(fn: Function) {
    const language = this.getFunctionLanguage(fn);
    return path.join(this.options.root, fn.name, language.description.entrypoints.build);
  }
}

export function getDatabaseSchema(
  db: DatabaseService,
  collSlug: CollectionSlug = id => Promise.resolve(id)
): Promise<JSONSchema7> {
  return db.collections().then(async collections => {
    const collSlugMap: Map<string, string> = new Map();

    for (const collection of collections) {
      collSlugMap.set(collection.collectionName, await collSlug(collection.collectionName));
    }

    const schema: JSONSchema7 = {
      $id: "http://spica.internal/function/enqueuer/database",
      type: "object",
      required: ["collection", "type"],
      properties: {
        collection: {
          title: "Collection Name",
          type: "string",
          //@ts-ignore
          viewEnum: Array.from(collSlugMap.values()),
          enum: Array.from(collSlugMap.keys()),
          description: "Collection name that the event will be tracked on"
        },
        type: {
          title: "Operation type",
          description: "Operation type that must be performed in the specified collection",
          type: "string",
          enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
        }
      },
      additionalProperties: false
    };
    return schema;
  });
}
