import {ObjectId, ReturnDocument} from "@spica-server/database";
import {EnvVarService} from "../services";
import {EnvVar} from "@spica-server/interface/env_var";
import {NotFoundException} from "@nestjs/common";

export async function insert(evs: EnvVarService, envVar: EnvVar) {
  if (envVar._id) {
    envVar._id = new ObjectId(envVar._id);
  }
  await evs.insertOne(envVar);
  return envVar;
}

export async function replace(evs: EnvVarService, envVar: EnvVar) {
  const _id = new ObjectId(envVar._id);
  delete envVar._id;

  const currentSchema = await evs.findOneAndReplace({_id}, envVar, {
    returnDocument: ReturnDocument.AFTER
  });

  if (!currentSchema) {
    throw new NotFoundException(`Environment Variable with ID ${_id} not found`);
  }
  return currentSchema;
}

export async function remove(evs: EnvVarService, id: string | ObjectId) {
  const res = await evs.findOneAndDelete({_id: new ObjectId(id)});
  if (!res) {
    throw new NotFoundException(`Environment Variable with ID ${id} not found`);
  }
}
