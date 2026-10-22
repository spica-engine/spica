import {EnvVarService} from "../services";
import {EnvVar} from "@spica-server/interface-env_var";
import {NotFoundException} from "@nestjs/common";
import {PaginationResponse} from "@spica-server/interface-passport-identity";
import {ids} from "@spica-server/data";
import {CollectionQueryFacade, Id, ReadSpec} from "@spica-server/interface-data";

const collection = "env_var";

const envVarIds = () => ids().forCollection(collection);

export async function find(
  queries: CollectionQueryFacade,
  options?: {
    resourceFilter?: object;
    limit: number;
    skip: number;
    sort?: {[path: string]: 1 | -1};
    paginate: boolean;
    filter?: object;
  }
): Promise<EnvVar[] | PaginationResponse<EnvVar>> {
  const {resourceFilter, limit, skip, sort, paginate, filter} = options;
  const spec: ReadSpec = {resourceFilter, filter, sort, skip, limit};

  if (paginate) {
    return queries.paginate<EnvVar>(collection, spec, "estimate-unless-filtered") as Promise<
      PaginationResponse<EnvVar>
    >;
  }

  return queries.find<EnvVar>(collection, spec);
}

export function findOne(evs: EnvVarService, id: Id): Promise<EnvVar> {
  return evs.findById(id);
}

export async function insert(evs: EnvVarService, body: EnvVar) {
  const envVar: EnvVar = {
    key: body.key,
    value: body.value,
    updated_at: new Date()
  };

  if (body._id) {
    envVar._id = envVarIds().parse(body._id);
  }

  await evs.insert(envVar);
  return envVar;
}

export async function replace(evs: EnvVarService, body: EnvVar) {
  const _id = envVarIds().parse(body._id);

  const envVar = {
    key: body.key,
    value: body.value,
    updated_at: new Date()
  };

  const currentSchema = await evs.replaceById(_id, envVar);

  if (!currentSchema) {
    throw new NotFoundException(`Environment Variable with ID ${_id} not found`);
  }
  return currentSchema;
}

export async function remove(evs: EnvVarService, id: string | Id) {
  const res = await evs.deleteById(envVarIds().parse(id));
  if (!res) {
    throw new NotFoundException(`Environment Variable with ID ${id} not found`);
  }
}
