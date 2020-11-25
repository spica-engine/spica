import {ObjectId} from "@spica-server/database";
import {register} from "@spica-server/machinery";
import {store} from "@spica-server/machinery/src/store";
import * as uniqid from "uniqid";
import {ApiKeyService} from "./apikey.service";
import {ApiKey} from "./interface";

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

export function registerInformers(apiKeyService: ApiKeyService) {
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
