import {Inject, Injectable, Optional, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {Scheduler} from "@spica-server/function/scheduler";
import {DelegatePkgManager, Package, PackageManager} from "@spica-server/function/pkgmanager";
import {event} from "@spica-server/function/queue/proto";
import fs from "fs";
import {JSONSchema7} from "json-schema";
import path from "path";
import {rimraf} from "rimraf";
import {Observable} from "rxjs";
import {
  FunctionService,
  FUNCTION_OPTIONS,
  Options,
  COLL_SLUG,
  CollectionSlug
} from "@spica-server/function/services";
import {EnvRelation, Function} from "@spica-server/interface/function";

import {ChangeKind, TargetChange} from "./change";
import {SCHEMA, SchemaWithName} from "./schema/schema";
import {createTargetChanges} from "./change";

import HttpSchema from "./schema/http.json" with {type: "json"};
import ScheduleSchema from "./schema/schedule.json" with {type: "json"};
import FirehoseSchema from "./schema/firehose.json" with {type: "json"};
import SystemSchema from "./schema/system.json" with {type: "json"};
import {ClassCommander, CommandType} from "@spica-server/replication";
import * as CRUD from "./crud";

@Injectable()
export class FunctionEngine implements OnModuleInit, OnModuleDestroy {
  readonly schemas = new Map<string, unknown>([
    ["http", HttpSchema],
    ["schedule", ScheduleSchema],
    ["firehose", FirehoseSchema],
    ["system", SystemSchema]
  ]);
  readonly runSchemas = new Map<string, JSONSchema7>();
  private cmdSubs: {unsubscribe: () => void};
  private watchEnvSubs: {unsubscribe: () => void};

  constructor(
    private fs: FunctionService,
    private db: DatabaseService,
    private scheduler: Scheduler,
    @Optional() private commander: ClassCommander,
    @Inject(FUNCTION_OPTIONS) private options: Options,
    @Optional() @Inject(SCHEMA) schema: SchemaWithName,
    @Optional() @Inject(COLL_SLUG) collSlug: CollectionSlug
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
        console.error(
          `Error received on listening functions for environment variable changes. Reason: ${JSON.stringify(err)}`
        )
    });
  }

  onModuleInit() {
    this.registerTriggers().then(() => {
      if (this.commander) {
        // trigger updates should be published to the other replicas except initial trigger registration
        this.cmdSubs = this.commander.register(this, [this.categorizeChanges], CommandType.SYNC);
      }
    });
  }

  registerTriggers() {
    return this.updateTriggers(ChangeKind.Added);
  }

  unregisterTriggers() {
    return this.updateTriggers(ChangeKind.Removed);
  }

  private updateTriggers(kind: ChangeKind) {
    return CRUD.find(this.fs, {resolveEnvRelations: EnvRelation.Resolved}).then(fns => {
      const targetChanges: TargetChange[] = [];
      for (const fn of fns) {
        targetChanges.push(...createTargetChanges(fn, kind));
      }
      this.categorizeChanges(targetChanges);
    });
  }

  onModuleDestroy() {
    if (this.commander) {
      this.cmdSubs.unsubscribe();
    }
    this.watchEnvSubs.unsubscribe();
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
  }

  private getDefaultPackageManager(): DelegatePkgManager {
    return this.scheduler.pkgmanagers.get("node");
  }

  private getFunctionRoot(fn: Function) {
    return path.join(this.options.root, fn._id.toString());
  }

  getPackages(fn: Function): Promise<Package[]> {
    return this.getDefaultPackageManager().ls(this.getFunctionRoot(fn), true);
  }

  addPackage(fn: Function, qualifiedNames: string | string[]): Observable<number> {
    return this.getDefaultPackageManager().install(this.getFunctionRoot(fn), qualifiedNames);
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
      name: fn.name.replace(" ", "-").toLowerCase(),
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
    return rimraf(this.getFunctionRoot(fn));
  }

  compile(fn: Function) {
    const language = this.getFunctionLanguage(fn);
    return language.compile({
      cwd: this.getFunctionRoot(fn),
      outDir: this.options.outDir,
      entrypoints: language.description.entrypoints
    });
  }

  update(fn: Function, index: string): Promise<void> {
    const language = this.getFunctionLanguage(fn);
    return fs.promises.writeFile(
      path.join(this.getFunctionRoot(fn), language.description.entrypoints.build),
      index
    );
  }

  read(fn: Function): Promise<string> {
    const language = this.getFunctionLanguage(fn);

    return fs.promises
      .readFile(path.join(this.getFunctionRoot(fn), language.description.entrypoints.build))
      .then(b => b.toString())
      .catch(e => {
        if (e.code == "ENOENT") {
          return Promise.reject("Not Found");
        }
        throw Error(e);
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

  private subscribe(change: TargetChange) {
    const enqueuer = this.getEnqueuer(change.type);
    if (enqueuer) {
      const target = new event.Target({
        id: change.target.id,
        cwd: path.join(this.options.root, change.target.id),
        handler: change.target.handler,
        context: new event.SchedulingContext({
          env: Object.keys(change.target.context.env).reduce((envs, key) => {
            envs.push(
              new event.SchedulingContext.Env({
                key,
                value: change.target.context.env[key]
              })
            );
            return envs;
          }, []),
          timeout: change.target.context.timeout
        })
      });
      enqueuer.subscribe(target, change.options);
    } else {
      console.warn(`Couldn't find enqueuer ${change.type}.`);
    }
  }

  private updateSubscription(change: TargetChange) {
    this.unsubscribe(change);
    this.subscribe(change);
  }

  private unsubscribe(change: TargetChange) {
    for (const enqueuer of this.scheduler.enqueuers) {
      const target = new event.Target({
        id: change.target.id,
        cwd: path.join(this.options.root, change.target.id),
        handler: change.target.handler
      });
      enqueuer.unsubscribe(target);
    }
  }

  private getFunctionLanguage(fn: Function) {
    return this.scheduler.languages.get(fn.language);
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
