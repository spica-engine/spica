import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {SchedulerModule} from "@spica-server/function/scheduler";
import {WebhookModule} from "@spica-server/function/webhook";
import * as path from "path";
import {FunctionEngine} from "./engine";
import {FunctionController} from "./function.controller";
import {FunctionService} from "./function.service";
import {FUNCTION_OPTIONS} from "./options";
import {FunctionOptions} from "./options";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver";
import {LogModule} from "./log";
import { ObjectId } from "@spica-server/database";
import { Function } from "./interface";

@Module({})
export class FunctionModule {
  constructor(fs: FunctionService, fe: FunctionEngine) {
    fs.deleteMany({});

    globalThis["liftFunction"] = async (object, env, store) => {
      const { spec, metadata } = object; 
      const raw: Function = {
        name: spec.title,
        description: spec.description,
        language: spec.language.toLowerCase(),
        timeout: spec.timeout || 10,
        triggers: spec.trigger,
        env
      };



      if ( metadata.uid ) {
        object.status = "Updating";
        const fn = await fs.findOneAndUpdate({_id: new ObjectId(metadata.uid)}, {$set: raw}, {returnOriginal: false});
        await fe.update(fn, spec.code);
        await fe.compile(fn);
        console.log('updating', fn);
      } else {
        object.status = "Creating";
        const fn = await fs.insertOne(raw);
        await fe.createFunction(fn);
        await fe.update(fn, spec.code);
        await fe.compile(fn);
        metadata.uid = String(fn._id);
        console.log('creating', fn);
      }


      object.status = "Ready";
    }
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
