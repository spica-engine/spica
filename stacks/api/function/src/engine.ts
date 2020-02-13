import {Inject, Injectable} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import {Horizon} from "@spica-server/function/horizon";
import {Package, PackageManager} from "@spica-server/function/pkgmanager";
import {Event} from "@spica-server/function/queue/proto";
import * as fs from "fs";
import {JSONSchema7} from "json-schema";
import * as path from "path";
import {ChangeKind, FunctionService, TargetChange} from "./function.service";
import {Function, FUNCTION_OPTIONS, Options} from "./interface";

@Injectable()
export class FunctionEngine {
  readonly schemas = new Map<string, JSONSchema7 | (() => Promise<JSONSchema7>)>([
    ["http", require("./schema/http.json")],
    ["schedule", require("./schema/schedule.json")],
    ["firehose", require("./schema/firehose.json")],
    ["database", () => getDatabaseSchema(this.db)]
  ]);
  readonly runSchemas = new Map<string, JSONSchema7>();

  constructor(
    private fs: FunctionService,
    private db: DatabaseService,
    private horizon: Horizon,
    @Inject(FUNCTION_OPTIONS) private options: Options
  ) {
    this.fs.targets().subscribe(change => {
      switch (change.kind) {
        case ChangeKind.Added:
          this.subscribe(change);
          break;
        case ChangeKind.Updated:
          this.unsubscribe(path.join(this.options.root, change.target.id));
          this.subscribe(change);
          break;
        case ChangeKind.Removed:
          this.unsubscribe(path.join(this.options.root, change.target.id));
          break;
      }
    });
  }

  private getDefaultPackageManager(): PackageManager {
    return this.horizon.pkgmanagers.get(this.horizon.runtime.description.name);
  }

  getPackages(fn: Function): Promise<Package[]> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return this.getDefaultPackageManager().ls(functionRoot);
  }

  addPackage(fn: Function, qualifiedName: string): Promise<void> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return this.getDefaultPackageManager().install(functionRoot, qualifiedName);
  }

  removePackage(fn: Function, name: string): Promise<void> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return this.getDefaultPackageManager().uninstall(functionRoot, name);
  }

  async update(fn: Function, index: string): Promise<void> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    await fs.promises.mkdir(functionRoot, {recursive: true});
    await fs.promises.writeFile(path.join(functionRoot, "index.ts"), index);
    // See: https://docs.npmjs.com/files/package.json#dependencies
    const packageJson = {
      name: fn.name,
      description: fn.description || "No description.",
      version: "0.0.1",
      private: true,
      main: "index.ts",
      keywords: ["spica", "function", "node.js"],
      license: "UNLICENSED"
    };

    await fs.promises.writeFile(
      path.join(functionRoot, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
    return this.horizon.runtime.compile({
      cwd: functionRoot,
      entrypoint: "index.ts"
    });
  }

  read(fn: Function): Promise<string> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return fs.promises.readFile(path.join(functionRoot, "index.ts")).then(b => b.toString());
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
    const enq = Array.from(this.horizon.enqueuers);
    return enq.find(e => e.description.name == name);
  }

  private subscribe(change: TargetChange) {
    const enqueuer = this.getEnqueuer(change.type);
    if (enqueuer) {
      const target = new Event.Target();
      target.cwd = path.join(this.options.root, change.target.id);
      target.handler = change.target.handler;
      enqueuer.subscribe(target, change.options);
    } else {
      console.warn(`Couldn't find enqueuer ${change.type}.`);
    }
  }

  private unsubscribe(cwd: string) {
    for (const enqueuer of this.horizon.enqueuers) {
      const target = new Event.Target();
      target.cwd = cwd;
      enqueuer.unsubscribe(target);
    }
  }
}

export function getDatabaseSchema(db: DatabaseService): Promise<JSONSchema7> {
  return db
    .listCollections()
    .toArray()
    .then(collections => {
      const scheme: JSONSchema7 = {
        $id: "http://spica.internal/function/enqueuer/database",
        type: "object",
        required: ["collection", "type"],
        properties: {
          collection: {
            title: "Collection Name",
            type: "string",
            enum: collections.map(c => c.name).sort((a, b) => a.localeCompare(b))
          },
          type: {
            title: "Operation type",
            description: "Event Type",
            type: "string",
            enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
          }
        },
        additionalProperties: false
      };
      return scheme;
    });
}
