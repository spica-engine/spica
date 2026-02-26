import {ObjectId, ReturnDocument} from "@spica-server/database";
import {SecretService} from "../services";
import {HiddenSecret, Secret} from "@spica-server/interface/secret";
import {encrypt} from "@spica-server/core/encryption";
import {SecretPipelineBuilder} from "./pipeline.builder";
import {NotFoundException} from "@nestjs/common";
import {PaginationResponse} from "@spica-server/interface/passport/identity";

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

  pipelineBuilder = (await pipelineBuilder.filterByUserRequest(filter)) as SecretPipelineBuilder;

  const seekingPipeline = new SecretPipelineBuilder()
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .hideSecrets()
    .result();

  const pipeline = (
    await pipelineBuilder.paginate(paginate, seekingPipeline, ss.estimatedDocumentCount())
  ).result();

  if (paginate) {
    return ss
      .aggregate<PaginationResponse<HiddenSecret>>(pipeline)
      .next()
      .then(r => {
        if (!r.data.length) {
          r.meta = {total: 0};
        }
        return r;
      });
  }

  return ss.aggregate<HiddenSecret>([...pipeline, ...seekingPipeline]).toArray();
}

export async function findOne(ss: SecretService, id: ObjectId): Promise<HiddenSecret> {
  const pipeline = new SecretPipelineBuilder().findOneIfRequested(id).hideSecrets().result();

  const res = await ss.aggregate<HiddenSecret>(pipeline).next();
  if (!res) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }
  return res;
}

export async function insert(
  ss: SecretService,
  body: {key: string; value: string}
): Promise<HiddenSecret> {
  const secret: Secret = {
    _id: undefined,
    key: body.key,
    value: encrypt(body.value, ss.encryptionSecret)
  };

  if ((body as any)._id) {
    secret._id = new ObjectId((body as any)._id);
  }

  await ss.insertOne(secret);

  return {_id: secret._id, key: secret.key};
}

export async function replace(
  ss: SecretService,
  id: ObjectId,
  body: {key: string; value: string}
): Promise<HiddenSecret> {
  const encrypted = encrypt(body.value, ss.encryptionSecret);

  const result = await ss.findOneAndReplace(
    {_id: id},
    {_id: id, key: body.key, value: encrypted},
    {returnDocument: ReturnDocument.AFTER}
  );

  if (!result) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }

  return {_id: result._id, key: result.key};
}

export async function remove(ss: SecretService, id: string | ObjectId) {
  const res = await ss.findOneAndDelete({_id: new ObjectId(id)});
  if (!res) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }
}
