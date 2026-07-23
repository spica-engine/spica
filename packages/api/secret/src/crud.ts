import {ObjectId, ReturnDocument} from "@spica-server/database";
import {SecretService} from "@spica-server/secret-services";
import {DecryptedSecret, HiddenSecret, Secret} from "@spica-server/interface-secret";
import {encrypt} from "@spica-server/core-encryption";
import {SecretPipelineBuilder} from "./pipeline.builder.js";
import {executePaginationPlan} from "@spica-server/database-pipeline";
import {NotFoundException} from "@nestjs/common";
import {PaginationResponse} from "@spica-server/interface-passport-identity";

export async function find(
  ss: SecretService,
  options?: {
    resourceFilter?: object;
    limit: number;
    skip: number;
    sort?: object;
    paginate: boolean;
    filter?: object;
  }
): Promise<HiddenSecret[] | PaginationResponse<HiddenSecret>> {
  const {resourceFilter, limit, skip, sort, paginate, filter} = options;
  let pipelineBuilder = new SecretPipelineBuilder().filterResources(resourceFilter);

  pipelineBuilder = await pipelineBuilder.filterByUserRequest(filter);

  const seekingPipeline = new SecretPipelineBuilder()
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .hideSecrets()
    .result();

  const plan = pipelineBuilder.buildPaginationPlan(seekingPipeline, () =>
    ss.estimatedDocumentCount()
  );

  if (paginate) {
    return executePaginationPlan<HiddenSecret>(ss, plan) as Promise<
      PaginationResponse<HiddenSecret>
    >;
  }

  return ss.aggregate<HiddenSecret>(plan.dataPipeline).toArray();
}

export async function findOne(ss: SecretService, id: ObjectId): Promise<HiddenSecret> {
  const pipeline = new SecretPipelineBuilder().findOneIfRequested(id).hideSecrets().result();

  const res = await ss.aggregate<HiddenSecret>(pipeline).next();
  if (!res) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }
  return res;
}

export async function insert(ss: SecretService, body: DecryptedSecret): Promise<HiddenSecret> {
  const secret: Secret = {
    key: body.key,
    value: encrypt(body.value, ss.encryptionSecret),
    updated_at: new Date()
  };

  if (body._id) {
    secret._id = new ObjectId(body._id);
  }

  const insertedSecret = await ss.insertOne(secret);
  delete insertedSecret.value;
  return insertedSecret as HiddenSecret;
}

export async function replace(
  ss: SecretService,
  id: ObjectId,
  body: DecryptedSecret
): Promise<HiddenSecret> {
  const encrypted = encrypt(body.value, ss.encryptionSecret);

  const result = await ss.findOneAndReplace(
    {_id: id},
    {_id: id, key: body.key, value: encrypted, updated_at: new Date()},
    {returnDocument: ReturnDocument.AFTER}
  );

  if (!result) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }

  delete result.value;
  return result;
}

export async function remove(ss: SecretService, id: string | ObjectId) {
  const res = await ss.findOneAndDelete({_id: new ObjectId(id)});
  if (!res) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }
}
