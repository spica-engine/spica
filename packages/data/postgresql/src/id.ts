import {InvalidIdError} from "@spica-server/data";
import {Id, IdType, IdTypes} from "@spica-server/interface-data";
import {v7, validate} from "uuid";

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

export class PostgresIdTypes implements IdTypes {
  private readonly uuid = new UuidV7Type();

  forCollection(): IdType {
    return this.uuid;
  }

  forBucket(): Promise<IdType> {
    return Promise.resolve(this.uuid);
  }

  unscoped(): IdType {
    return this.uuid;
  }
}
