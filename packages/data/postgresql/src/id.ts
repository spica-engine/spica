import {Inject, Injectable} from "@nestjs/common";
import {InvalidIdError} from "@spica-server/data";
import {Session} from "@spica-server/data-postgresql-orm";
import {Id, IdType, IdTypes} from "@spica-server/interface-data";
import {v7, validate} from "uuid";
import {ORM} from "./orm.js";
import {StoredBuckets} from "./repositories/bucket/stored-buckets.js";
import {KeyType, tryPrimaryKeyMetadata} from "./schema/primary-key.js";

export type UuidId = string & Id;

export class UuidV7Type implements IdType<UuidId> {
  readonly name = "uuid";

  parse(value: unknown): UuidId {
    if (value == null) {
      throw new InvalidIdError("Id must not be null or undefined.");
    }
    if (typeof value != "string" || !validate(value)) {
      throw new InvalidIdError(`"${String(value)}" is not a valid uuid.`);
    }
    return value.toLowerCase() as UuidId;
  }

  isValid(value: unknown): boolean {
    return typeof value == "string" && validate(value);
  }

  generate(): UuidId {
    return v7() as UuidId;
  }

  is(value: unknown): value is UuidId {
    return this.isValid(value);
  }

  equals(a: unknown, b: unknown): boolean {
    return this.isValid(a) && this.isValid(b) && this.parse(a) == this.parse(b);
  }

  serialize(id: UuidId): string {
    return id.toLowerCase();
  }
}

const INTEGER_RANGE = {min: -(2n ** 31n), max: 2n ** 31n - 1n};
const BIGINT_RANGE = {min: -(2n ** 63n), max: 2n ** 63n - 1n};

function parseWhole(value: unknown, name: string, range: {min: bigint; max: bigint}): bigint {
  const text = typeof value == "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text != "string" || !/^-?\d+$/.test(text)) {
    throw new InvalidIdError(`"${String(value)}" is not a valid ${name}.`);
  }
  const whole = BigInt(text);
  if (whole < range.min || whole > range.max) {
    throw new InvalidIdError(`"${text}" is out of the ${name} range.`);
  }
  return whole;
}

function cannotGenerate(name: string): never {
  throw new Error(
    `A ${name} key is assigned by the database or the caller and cannot be generated.`
  );
}

export type IntegerId = number & Id;
export type BigintId = string & Id;
export type TextId = string & Id;

export class IntegerKeyType implements IdType<IntegerId> {
  readonly name = "integer";

  parse(value: unknown): IntegerId {
    return Number(parseWhole(value, this.name, INTEGER_RANGE)) as IntegerId;
  }

  isValid(value: unknown): boolean {
    return this.is(value) || (typeof value == "string" && this.accepts(value));
  }

  generate(): IntegerId {
    return cannotGenerate(this.name);
  }

  is(value: unknown): value is IntegerId {
    return typeof value == "number" && this.accepts(value);
  }

  equals(a: unknown, b: unknown): boolean {
    return this.isValid(a) && this.isValid(b) && this.parse(a) == this.parse(b);
  }

  serialize(id: IntegerId): string {
    return String(id);
  }

  private accepts(value: unknown) {
    try {
      this.parse(value);
      return true;
    } catch {
      return false;
    }
  }
}

/** Stays a decimal string so values above 2^53 survive the driver and JSON. */
export class BigintKeyType implements IdType<BigintId> {
  readonly name = "bigint";

  parse(value: unknown): BigintId {
    return parseWhole(value, this.name, BIGINT_RANGE).toString() as BigintId;
  }

  isValid(value: unknown): boolean {
    try {
      this.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  generate(): BigintId {
    return cannotGenerate(this.name);
  }

  is(value: unknown): value is BigintId {
    return typeof value == "string" && this.isValid(value);
  }

  equals(a: unknown, b: unknown): boolean {
    return this.isValid(a) && this.isValid(b) && this.parse(a) == this.parse(b);
  }

  serialize(id: BigintId): string {
    return id;
  }
}

export class TextKeyType implements IdType<TextId> {
  readonly name = "text";

  parse(value: unknown): TextId {
    if (typeof value != "string") {
      throw new InvalidIdError(`"${String(value)}" is not a valid text key.`);
    }
    return value as TextId;
  }

  isValid(value: unknown): boolean {
    return typeof value == "string";
  }

  generate(): TextId {
    return cannotGenerate(this.name);
  }

  is(value: unknown): value is TextId {
    return typeof value == "string";
  }

  equals(a: unknown, b: unknown): boolean {
    return this.isValid(a) && this.isValid(b) && a == b;
  }

  serialize(id: TextId): string {
    return id;
  }
}

const KEY_ID_TYPES: Record<KeyType, IdType> = {
  uuid: new UuidV7Type(),
  integer: new IntegerKeyType(),
  bigint: new BigintKeyType(),
  text: new TextKeyType()
};

export const keyIdType = (type: KeyType): IdType => KEY_ID_TYPES[type];

@Injectable()
export class PostgresIdTypes implements IdTypes {
  private readonly uuid = KEY_ID_TYPES.uuid;
  private readonly buckets: StoredBuckets;

  constructor(@Inject(ORM) session: Session) {
    this.buckets = new StoredBuckets(session);
  }

  forCollection(): IdType {
    return this.uuid;
  }

  async forBucket(bucketId: string): Promise<IdType> {
    // An unknown bucket keeps the uuid type so the caller's own not-found handling answers.
    if (!validate(bucketId)) {
      return this.uuid;
    }
    const bucket = await this.buckets.find(bucketId);
    const key = bucket && tryPrimaryKeyMetadata(bucket);
    return key ? keyIdType(key.type) : this.uuid;
  }

  unscoped(): IdType {
    return this.uuid;
  }

  keyField(bucket: {primary?: string}): string {
    return bucket.primary as string;
  }

  systemKeyField(): string {
    return "_id";
  }
}
