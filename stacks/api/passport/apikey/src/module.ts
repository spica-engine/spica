import {Module, DynamicModule, Global} from "@nestjs/common";
import {ApiKeyController} from "./apikey.controller";
import {ApiKeyService} from "./apikey.service";
import {ApiKeyStrategy} from "./apikey.strategy";
import {SchemaModule} from "@spica-server/core/schema";

import {register} from "@spica-server/machinery";
import * as uniqid from "uniqid";
import {ApiKey} from "./interface";
import {ObjectId} from "@spica-server/database";
import {store} from "@spica-server/machinery/src/store";

function v1_apikey_to_internal(obj: any) {
  const {spec} = obj;

  return <ApiKey>{
    name: spec.name,
    description: spec.description,
    policies: spec.policies,
    key: obj.spec.key,
    active: true
  };
}

@Global()
@Module({})
export class ApiKeyModule {
  constructor(apiKeyService: ApiKeyService) {
    register(
      {
        group: "passport",
        resource: "apikeys",
        version: "v1"
      },
      {
        add: async (obj: any) => {
          const key = (obj.spec.key = uniqid());
          const raw = v1_apikey_to_internal(obj);
          const k = await apiKeyService.insertOne(raw);
          const st = store({
            group: "passport",
            resource: "apikeys"
          });
          await st.patch(obj.metadata.name, {
            spec: {key},
            metadata: {uid: String(k._id)},
            status: "Ready"
          });
        },
        update: async (_, newObj) => {
          const raw = v1_apikey_to_internal(newObj);
          delete raw.key;
          await apiKeyService.updateOne({_id: new ObjectId(newObj.metadata.uid)}, {$set: raw});
        },
        delete: async obj => {
          await apiKeyService.deleteOne({_id: new ObjectId(obj.metadata.uid)});
        }
      }
    );
  }
  static forRoot(): DynamicModule {
    return {
      module: ApiKeyModule,
      imports: [
        SchemaModule.forChild({
          schemas: [require(`./schemas/apikey.json`)]
        })
      ],
      controllers: [ApiKeyController],
      providers: [ApiKeyService, ApiKeyStrategy]
    };
  }
}
