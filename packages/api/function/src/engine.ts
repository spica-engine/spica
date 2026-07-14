import {
  Inject,
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  OnModuleInit
} from "@nestjs/common";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {Scheduler} from "@spica-server/function-scheduler";
import {DelegatePkgManager} from "@spica-server/interface-function-pkgmanager";
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
  FunctionChangePlan,
  SCHEMA,
  SchemaWithName
} from "@spica-server/interface-function";

import {createPlan, mergePlans} from "./change.js";
import {PlanExecutor} from "./plan-executor.js";
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
    private executor: PlanExecutor,
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
            : CRUD.environment.reload(fn._id, this)
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
            : CRUD.secret.reload(fn._id, this)
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
        this.cmdSubs = this.commander.register(this, [this.applyChangePlan], CommandType.SYNC);
      }
    };
    return startupSequence();
  }

  registerTriggers() {
    return this.updateTriggers(true);
  }

  unregisterTriggers() {
    return this.updateTriggers(false);
  }

  private updateTriggers(register: boolean) {
    return this.fs.find().then(fns => {
      // Registering treats each function as a create (subscribe + reconcile); unregistering as
      // a delete (unsubscribe + outdate + reconcile). createPlan derives the right shape from
      // the null side, so startup and shutdown fall out of the same call.
      const plan = mergePlans(
        fns.map(fn => (register ? createPlan(null, fn) : createPlan(fn, null)))
      );
      return this.applyChangePlan(plan);
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

  // Replication seam: the ClassCommander SYNC command, so every plan applied on one replica is
  // re-applied on the others. The mechanics live in PlanExecutor; this only forwards. Returns
  // the executor's promise so callers can await context resolution before proceeding.
  applyChangePlan(plan: FunctionChangePlan): Promise<void> {
    return this.executor.apply(plan);
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
