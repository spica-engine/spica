import {ObjectId, ReturnDocument} from "@spica-server/database";
import {EnvVarService} from "../services";
import {EnvVar} from "@spica-server/interface/env_var";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {PaginationResponse} from "@spica-server/passport/identity";
import {NotFoundException} from "@nestjs/common";

export async function find(
  evs: EnvVarService,
  options?: {
    resourceFilter?: object;
    limit: number;
    skip: number;
    sort?: object;
    paginate: boolean;
    filter?: object;
  }
): Promise<EnvVar[] | PaginationResponse<EnvVar>> {
  const {resourceFilter, limit, skip, sort, paginate, filter} = options;
  let pipelineBuilder = new PipelineBuilder().filterResources(resourceFilter);

  pipelineBuilder = await pipelineBuilder.filterByUserRequest(filter);

  const seekingPipeline = new PipelineBuilder().sort(sort).skip(skip).limit(limit).result();

  const pipeline = (
    await pipelineBuilder.paginate(paginate, seekingPipeline, evs.estimatedDocumentCount())
  ).result();

  if (paginate) {
    return evs
      .aggregate<PaginationResponse<EnvVar>>(pipeline)
      .next()
      .then(r => {
        if (!r.data.length) {
          r.meta = {total: 0};
        }
        return r;
      });
  }

  return evs.aggregate<EnvVar>([...pipeline, ...seekingPipeline]).toArray();
}

export function findOne(evs: EnvVarService, id: ObjectId): Promise<EnvVar> {
  return evs.findOne({_id: id});
}

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
