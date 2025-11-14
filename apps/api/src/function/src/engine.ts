import {Inject, Injectable, Optional, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {Scheduler} from "@spica-server/function/scheduler";
import {DelegatePkgManager} from "@spica-server/interface/function/pkgmanager";
import {event} from "@spica-server/function/queue/proto";
import fs from "fs";
import {JSONSchema7} from "json-schema";
import path from "path";
import {rimraf} from "rimraf";
import {Observable} from "rxjs";
import {FunctionService} from "@spica-server/function/services";
import {
  CollectionSlug,
  Options,
  FUNCTION_OPTIONS,
  COLL_SLUG,
  Function,
  ChangeKind,
  TargetChange,
  SCHEMA,
  SchemaWithName,
  EnvRelation,
  FunctionWithContent
} from "@spica-server/interface/function";

import {createTargetChanges} from "./change";

import HttpSchema from "./schema/http.json" with {type: "json"};
import ScheduleSchema from "./schema/schedule.json" with {type: "json"};
import FirehoseSchema from "./schema/firehose.json" with {type: "json"};
import SystemSchema from "./schema/system.json" with {type: "json"};
import RabbitMQSchema from "./schema/rabbitmq.json" with {type: "json"};
import * as CRUD from "./crud";
import {ClassCommander} from "@spica-server/replication";
import {CommandType} from "@spica-server/interface/replication";
import {Package} from "@spica-server/interface/function/pkgmanager";
import chokidar from "chokidar";
import {FunctionModule} from "./function.module";

@Injectable()
export class FunctionEngine implements OnModuleInit, OnModuleDestroy {
  readonly schemas = new Map<string, unknown>([
    ["http", HttpSchema],
    ["schedule", ScheduleSchema],
    ["firehose", FirehoseSchema],
    ["system", SystemSchema],
    ["rabbitmq", RabbitMQSchema]
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
    return CRUD.find(this.fs, this, {resolveEnvRelations: EnvRelation.Resolved}).then(fns => {
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
    return path.join(this.options.root, fn.name);
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
      main: path.join(
        ".",
        this.options.outDir,
        fn.name,
        functionLanguage.description.entrypoints.runtime
      )
    };

    return fs.promises.writeFile(
      path.join(functionRoot, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
  }

  deleteFunction(fn: Function) {
    const functionRoot = this.getFunctionRoot(fn);
    const buildDir = path.join(this.options.root, this.options.outDir, fn.name);
    return Promise.all([rimraf(functionRoot), rimraf(buildDir)]);
  }

  compile(fn: Function) {
    const language = this.getFunctionLanguage(fn);
    const outDirRelative = path.join("..", this.options.outDir, fn.name);
    return language.compile({
      cwd: this.getFunctionRoot(fn),
      outDir: outDirRelative,
      entrypoints: language.description.entrypoints
    });
  }

  update(fn: Function, index: string): Promise<void> {
    const filePath = this.getFunctionBuildEntrypoint(fn);

    return fs.promises.writeFile(filePath, index);
  }

  read(fn: Function, scope: "index" | "dependency"): Promise<string> {
    let filePath = this.getFunctionBuildEntrypoint(fn);
    if (scope === "dependency") {
      filePath = path.join(this.getFunctionRoot(fn), "package.json");
    }
    return fs.promises
      .readFile(filePath)
      .then(b => b.toString())
      .catch(e => {
        if (e.code == "ENOENT") {
          return Promise.reject("Not Found");
        }
        throw Error(e);
      });
  }

  deleteIndex(fn: Function): Promise<void> {
    const filePath = this.getFunctionBuildEntrypoint(fn);
    return fs.promises.rm(filePath);
  }

  deleteDependency(fn: Function): Promise<void> {
    const filePath = path.join(this.getFunctionRoot(fn), "package.json");
    return fs.promises.rm(filePath);
  }

  watch(
    scope: "index" | "dependency"
  ): Observable<{fn: FunctionWithContent; type: "create" | "update" | "delete"}> {
  watch(scope: "index" | "dependency"): Observable<FunctionWithContent> {
    let files = [];

    switch (scope) {
      case "index":
        files = ["index.mjs", "index.ts"];
        break;
      case "dependency":
        files = ["package.json"];
        break;
    }
    const moduleDir = this.options.root;
    fs.mkdirSync(moduleDir, {recursive: true});

    return new Observable(observer => {
      const watcher = chokidar.watch(moduleDir, {
        ignored: /(^|[/\\])\../,
        persistent: true,
        depth: 2
      });

      const handleFileEvent = async (path: string, type: "create" | "update" | "delete") => {
        const relativePath = path.slice(moduleDir.length + 1);
        const parts = relativePath.split(/[/\\]/);

        const isCorrectDepth = parts.length == 2;
        const isTrackedFile = files.some(file => parts[1] == file);
        if (!isCorrectDepth || !isTrackedFile) return;

        const dirName = parts[0];

        let contentPromise: Promise<string> | null;
        let content: string | null;
        let fn: Function | null;
        if (type == "delete") {
          contentPromise = Promise.resolve(null);
        } else {
          contentPromise = fs.promises.readFile(path).then(b => b.toString());
        }

        await Promise.all([
          CRUD.findByName(this.fs, dirName, {
            resolveEnvRelations: EnvRelation.NotResolved
          }).then(r => (fn = r)),
          contentPromise.then(c => (content = c))
        ]);

        if (!fn) return;

        observer.next({fn: {...fn, content}, type});
      };

      watcher.on("change", path => handleFileEvent(path, "update"));
      watcher.on("unlink", path => handleFileEvent(path, "delete"));
      watcher.on("add", path => handleFileEvent(path, "create"));

      watcher.on("error", err => observer.error(err));

      return () => watcher.close();
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
        cwd: path.join(this.options.root, change.target.name),
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
        cwd: path.join(this.options.root, change.target.name),
        handler: change.target.handler
      });
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
