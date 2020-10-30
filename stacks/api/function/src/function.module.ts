import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {SchedulerModule} from "@spica-server/function/scheduler";
import {WebhookModule} from "@spica-server/function/webhook";
import {register, Store} from "@spica-server/machinery";
import {store} from "@spica-server/machinery/src/store";
import * as path from "path";
import {FunctionEngine} from "./engine";
import {FunctionController} from "./function.controller";
import {FunctionService} from "./function.service";
import {Function} from "./interface";
import {LogModule} from "./log";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver";

async function v1_trigger_to_internal(object: any) {
  const bucketStore = new Store({
    group: "bucket",
    resource: "schemas"
  });

  const triggerRaw = {
    active: true,
    type: object.spec.type,
    options: {}
  };

  if (object.spec.type == "http") {
    triggerRaw.options = object.spec.httpOptions;
  } else if (object.spec.type == "bucket") {
    const bkt = object.spec.bucketOptions.bucket;

    const bucket = await bucketStore.get(bkt.resourceFieldRef.bucketName);

    // TODO: think about a better way to handle this
    if (!bucket) {
      triggerRaw.active = false;
    } else {
      triggerRaw.options = {
        ...object.spec.bucketOptions,
        bucket: bucket.metadata.uid,
        phase: object.spec.bucketOptions.phase.toUpperCase()
      };
    }
  } else if (object.spec.type == "firehose") {
    triggerRaw.options = object.spec.firehoseOptions;
  } else if (object.spec.type == "schedule") {
    triggerRaw.options = {
      frequency: object.spec.scheduleOptions.cronSpec,
      timezone: object.spec.scheduleOptions.timezone
    };
  } else if (object.spec.type == "system") {
    triggerRaw.options = object.spec.systemOptions;
  }

  return triggerRaw;
}

async function v1_function_to_internal(object: any) {
  const {spec} = object;

  const bucketStore = new Store({
    group: "bucket",
    resource: "schemas"
  });

  const apiKeyStore = new Store<any>({
    group: "passport",
    resource: "apikeys"
  });

  const env = {};

  for (const {name, value, valueFrom} of spec.environment) {
    if (value) {
      env[name] = String(value);
    } else if (valueFrom) {
      const ref = valueFrom.resourceFieldRef;
      if (ref) {
        if (ref.bucketName) {
          const bucket = await bucketStore.get(ref.bucketName);
          if (bucket) {
            env[name] = String(bucket.metadata.uid);
          } else {
            // TODO: Handle missing buckets
            continue;
          }
        } else if (ref.apiKeyName) {
          const apiKey = await apiKeyStore.get(ref.apiKeyName);
          if (apiKey) {
            env[name] = String(apiKey.spec.key);
          } else {
            // TODO: Handle missing apikeys
            continue;
          }
        }
      }
    }
  }

  return <Function>{
    name: spec.title,
    description: spec.description,
    language: spec.runtime.language.toLowerCase(),
    timeout: spec.timeout,
    triggers: {},
    env
  };
}

@Module({})
export class FunctionModule {
  constructor(fs: FunctionService, fe: FunctionEngine) {
    const handle = async (object: any) => {
      const triggerStore = store({
        group: "function",
        resource: "functions"
      });
      const functionStore = store({
        group: "function",
        resource: "functions"
      });
      const fn = await functionStore.get(object.spec.func);

      if (fn) {
        const trigger = await v1_trigger_to_internal(object);
        await fs.updateOne(
          {_id: new ObjectId(fn.metadata.uid)},
          {$set: {triggers: {[object.spec.name]: trigger}}}
        );
      } else {
        await triggerStore.patch(object.metadata.name, {status: "ErrFuncNotFound"});
      }
    };
    register(
      {
        group: "function",
        resource: "triggers",
        version: "v1"
      },
      {
        add: handle,
        update: handle,
        delete: async object => {
          const functionStore = store({
            group: "function",
            resource: "functions"
          });
          const triggerStore = store({
            group: "function",
            resource: "functions"
          });
          const fn = await functionStore.get(object.spec.func);
          if (fn) {
            const trigger = await v1_trigger_to_internal(object);
            await fs.updateOne(
              {_id: new ObjectId(fn.metadata.uid)},
              {$unset: {[`triggers.${object.spec.name}`]: ""}}
            );
          } else {
            await triggerStore.patch(object.metadata.name, {status: "ErrFuncNotFound"});
          }
        }
      }
    );
    register(
      {
        group: "function",
        resource: "functions",
        version: "v1"
      },
      {
        add: async (obj: any) => {
          const st = store({
            group: "function",
            resource: "functions"
          });
          await st.patch(obj.metadata.name, {status: "Pending"});
          const raw = await v1_function_to_internal(obj);
          const fn = await fs.insertOne(raw);
          await st.patch(obj.metadata.name, {metadata: {uid: String(fn._id)}, status: "Creating"});

          try {
            await fe.createFunction(fn);
            await fe.update(fn, obj.spec.code);
            await fe.compile(fn);

            try {
              const packagesToInstall = [];

              for (const dependency of obj.spec.dependency) {
                packagesToInstall.push(`${dependency.name}@${dependency.version}`);
              }

              await fe.addPackage(fn, packagesToInstall).toPromise();

              await st.patch(obj.metadata.name, {status: "Ready"});
            } catch {
              await st.patch(obj.metadata.name, {status: "ErrInstallB"});
            }
          } catch {
            await st.patch(obj.metadata.name, {status: "ErrCreate"});
          }
        },
        update: async (oldObj, obj: any) => {
          const raw = await v1_function_to_internal(obj);
          const fn = await fs.findOneAndUpdate(
            {_id: new ObjectId(obj.metadata.uid)},
            {$set: raw},
            {returnOriginal: false}
          );
          if (oldObj.spec.code != obj.spec.code) {
            await fe.update(fn, obj.spec.code);
            await fe.compile(fn);
          }

          const newPackageMap = new Map<string, string>();

          for (const dependency of obj.spec.dependency) {
            newPackageMap.set(dependency.name, dependency.version);
          }

          const oldPackageMap = new Map<string, string>();

          for (const dependency of oldObj.spec.dependency) {
            oldPackageMap.set(dependency.name, dependency.version);
          }

          for (const [name, version] of newPackageMap.entries()) {
            if (!oldPackageMap.has(name) || oldPackageMap.get(name) != version) {
              await fe.addPackage(fn, `${name}@${version}`).toPromise();
            }
          }

          for (const name of oldPackageMap.keys()) {
            if (!newPackageMap.has(name)) {
              await fe.removePackage(fn, name);
            }
          }
        },
        delete: async (obj: any) => {
          const id = new ObjectId(obj.metadata.uid);
          const fn = await fs.findOneAndDelete({_id: id});
          fe.deleteFunction(fn);
        }
      }
    );
  }

  static forRoot(options: FunctionOptions): DynamicModule {
    return {
      module: FunctionModule,
      imports: [
        LogModule.forRoot({expireAfterSeconds: options.logExpireAfterSeconds}),
        SchemaModule.forChild({
          schemas: [require("./schema/function.json")]
        }),
        WebhookModule.forRoot({expireAfterSeconds: options.logExpireAfterSeconds}),
        SchedulerModule.forRoot({
          databaseName: options.databaseName,
          databaseReplicaSet: options.databaseReplicaSet,
          databaseUri: options.databaseUri,
          poolSize: options.poolSize,
          poolMaxSize: options.poolMaxSize,
          apiUrl: options.apiUrl,
          timeout: options.timeout,
          experimentalDevkitDatabaseCache: options.experimentalDevkitDatabaseCache,
          corsOptions: options.corsOptions
        })
      ],
      controllers: [FunctionController],
      providers: [
        FunctionEngine,
        FunctionService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: {
            root: path.join(options.path, "functions"),
            timeout: options.timeout
          }
        },
        {
          provide: EnqueuerSchemaResolver,
          useFactory: provideEnqueuerSchemaResolver,
          inject: [Validator, FunctionEngine]
        }
      ]
    };
  }
}
