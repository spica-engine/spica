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

  for (const {key, value, valueFrom} of spec.environment) {
    if (value) {
      env[key] = String(value);
    } else if (valueFrom) {
      const ref = valueFrom.resourceFieldRef;
      if (ref) {
        if (ref.bucketName) {
          const bucket = await bucketStore.get(ref.bucketName);
          if (bucket) {
            env[key] = String(bucket.metadata.uid);
          } else {
            // TODO: Handle missing buckets
            continue;
          }
        } else if (ref.apiKeyName) {
          const apiKey = await apiKeyStore.get(ref.apiKeyName);
          if (apiKey) {
            env[key] = String(apiKey.spec.key);
          } else {
            // TODO: Handle missing apikeys
            continue;
          }
        }
      }
    }
  }

  const triggers = {};

  const triggerStore = new Store<any>({
    group: "function",
    resource: "triggers"
  });

  spec.triggers = spec.triggers || []; 

  for (const triggerName of spec.triggers) {
    const trigger = await triggerStore.get(triggerName);

    // TODO: Handle missing triggers
    if (!trigger) {
      continue;
    }

    const triggerRaw = {
      active: true,
      type: trigger.spec.type,
      options: {}
    };

    if (trigger.spec.type == "http") {
      triggerRaw.options = trigger.spec.httpOptions;
    } else if (trigger.spec.type == "bucket") {
      const bkt = trigger.spec.bucketOptions.bucket;
      if (bkt.resourceFieldRef && bkt.resourceFieldRef.bucketName) {
        const bucket = await bucketStore.get(bkt.resourceFieldRef.bucketName);

        // TODO: ?? handle
        if (!bucket) {
          continue;
        }

        triggerRaw.options = {
          ...trigger.spec.bucketOptions,
          bucket: bucket.metadata.uid,
          phase: trigger.spec.bucketOptions.phase.toUpperCase()
        };
      } else {
        // TODO: ?? is this possible?
        continue;
      }
    } else if (trigger.spec.type == "firehose") {
      triggerRaw.options = trigger.spec.firehoseOptions;
    } else if (trigger.spec.type == "schedule") {
      triggerRaw.options = trigger.spec.scheduleOptions;
    } else if (trigger.spec.type == "system") {
      triggerRaw.options = trigger.spec.systemOptions;
    }

    triggers[trigger.spec.name] = triggerRaw;
  }

  return <Function>{
    name: spec.title,
    description: spec.description,
    language: spec.runtime.language.toLowerCase(),
    timeout: spec.timeout || 10,
    triggers,
    env
  };
}

@Module({})
export class FunctionModule {
  constructor(fs: FunctionService, fe: FunctionEngine) {
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
          await st.patch(obj.metadata.name, {status: "Creating"});
          await fe.createFunction(fn);
          await fe.update(fn, obj.spec.code);
          await fe.compile(fn);
          await st.patch(obj.metadata.name, {metadata: {uid: String(fn._id)}, status: "Ready"});
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
