import {SecretService} from "@spica-server/secret-services";
import {DecryptedSecret, HiddenSecret, Secret} from "@spica-server/interface-secret";
import {encrypt, hash} from "@spica-server/core-encryption";
import {randomBytes} from "node:crypto";
import {NotFoundException} from "@nestjs/common";
import {PaginationResponse} from "@spica-server/interface-passport-identity";
import {ids, idOf, withId, assignId} from "@spica-server/data";
import {
  CollectionQueryFacade,
  Id,
  ReadSpec,
  ResourceFilterSpec
} from "@spica-server/interface-data";

const collection = "secret";

const secretIds = () => ids().forCollection(collection);

const HIDDEN_VALUE = {value: 0} as const;

const SALT_BYTES = 16;

function fingerprint(value: string) {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  return {salt, value_hash: hash(value, salt)};
}

function toStored(body: DecryptedSecret, encryptionSecret: string): Secret {
  return {
    key: body.key,
    value: encrypt(body.value, encryptionSecret),
    ...fingerprint(body.value),
    updated_at: new Date()
  };
}

export async function find(
  queries: CollectionQueryFacade,
  options?: {
    resourceFilter?: ResourceFilterSpec;
    limit: number;
    skip: number;
    sort?: {[path: string]: 1 | -1};
    paginate: boolean;
    filter?: object | string;
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
  const secret = toStored(body, ss.encryptionSecret);

  if (idOf(body)) {
    assignId(secret, secretIds().parse(idOf(body)));
  }

  const insertedSecret = await ss.insert(secret);
  delete insertedSecret.value;
  return insertedSecret as HiddenSecret;
}

export async function replace(
  ss: SecretService,
  id: Id,
  body: DecryptedSecret
): Promise<HiddenSecret> {
  const result = await ss.replaceById(id, withId(toStored(body, ss.encryptionSecret), id));

  if (!result) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }

  delete result.value;
  return result;
}

export async function remove(ss: SecretService, id: string | Id) {
  const res = await ss.deleteById(secretIds().parse(id));
  if (!res) {
    throw new NotFoundException(`Secret with ID ${id} not found`);
  }
}
