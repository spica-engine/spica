import {ObjectId, ReturnDocument} from "@spica-server/database";
import {EnvVarsService} from "../services";
import {EnvVar} from "@spica-server/interface/env_var";

export async function insert(evs: EnvVarsService, envVar: EnvVar) {
  if (envVar._id) {
    envVar._id = new ObjectId(envVar._id);
  }
  await evs.insertOne(envVar);
  return envVar;
}

export async function replace(evs: EnvVarsService, envVar: EnvVar) {
  const _id = new ObjectId(envVar._id);
  delete envVar._id;

  const currentSchema = await evs.findOneAndReplace({_id}, envVar, {
    returnDocument: ReturnDocument.AFTER
  });
  return currentSchema;
}

export async function remove(evs: EnvVarsService, id: string | ObjectId) {
  return evs.findOneAndDelete({_id: new ObjectId(id)});
}
