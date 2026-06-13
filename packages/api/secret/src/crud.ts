import {ObjectId, ReturnDocument} from "@spica-server/database";
import {SecretService} from "@spica-server/secret-services";
import {HiddenSecret, Secret} from "@spica-server/interface-secret";
import {encrypt} from "@spica-server/core-encryption";
import {SecretPipelineBuilder} from "./pipeline.builder.js";
import {NotFoundException} from "@nestjs/common";
import {PaginationResponse} from "@spica-server/interface-passport-identity";

type SecretInput = {
  _id?: ObjectId | string;
  key: string;
  value?: string;
};

type StoredSecretInsert = {
  _id?: ObjectId;
  key: string;
  value?: Secret["value"];
};

type StoredSecretUpdate = {
  key: string;
  value?: Secret["value"];
};

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

export async function insert(ss: SecretService, body: SecretInput): Promise<HiddenSecret> {
  const secret: StoredSecretInsert = {
    key: body.key
  };

  if (typeof body.value == "string") {
    secret.value = encrypt(body.value, ss.encryptionSecret);
  }

  if (body._id) {
    secret._id = new ObjectId(body._id);
  }

  const insertedSecret = await ss.insertOne(secret as Secret);
  delete insertedSecret.value;
  return insertedSecret as HiddenSecret;
}

export async function replace(
  ss: SecretService,
  id: ObjectId,
  body: SecretInput
): Promise<HiddenSecret> {
  const set: StoredSecretUpdate = {
    key: body.key
  };

  if (typeof body.value == "string") {
    set.value = encrypt(body.value, ss.encryptionSecret);
  }

  const result = await ss.findOneAndUpdate(
    {_id: id},
    {$set: set},
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
