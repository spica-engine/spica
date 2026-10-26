import {ReturnDocument} from "@spica-server/database";
import {SecretService} from "@spica-server/secret-services";
import {DecryptedSecret, HiddenSecret, Secret} from "@spica-server/interface-secret";
import {encrypt} from "@spica-server/core-encryption";
import {NotFoundException} from "@nestjs/common";
import {PaginationResponse} from "@spica-server/interface-passport-identity";
import {ids} from "@spica-server/data";
import {CollectionQueryFacade, Id, ReadSpec} from "@spica-server/interface-data";

const collection = "secret";

const secretIds = () => ids().forCollection(collection);

const HIDDEN_VALUE = {value: 0} as const;

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
): Promise<HiddenSecret[] | PaginationResponse<HiddenSecret>> {
  const {resourceFilter, limit, skip, sort, paginate, filter} = options;
  const spec: ReadSpec = {resourceFilter, filter, sort, skip, limit, fields: HIDDEN_VALUE};

  if (paginate) {
    return queries.paginate<HiddenSecret>(collection, spec, "estimate-unless-filtered") as Promise<
      PaginationResponse<HiddenSecret>
    >;
  }

  return queries.find<HiddenSecret>(collection, spec);
}

export async function findOne(queries: CollectionQueryFacade, id: Id): Promise<HiddenSecret> {
  const res = await queries.findOne<HiddenSecret>(collection, {id, fields: HIDDEN_VALUE});
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
    secret._id = secretIds().parse(body._id);
  }

  const insertedSecret = await ss.insertOne(secret);
  delete insertedSecret.value;
  return insertedSecret as HiddenSecret;
}

export async function replace(
  ss: SecretService,
  id: Id,
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

export async function remove(ss: SecretService, id: string | Id) {
  const res = await ss.findOneAndDelete({_id: secretIds().parse(id)});
  if (!res) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }
}
