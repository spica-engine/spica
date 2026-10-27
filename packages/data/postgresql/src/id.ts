import {InvalidIdError} from "@spica-server/data";
import {IdType, IdTypes} from "@spica-server/interface-data";
import {v7, validate} from "uuid";

export class UuidV7Type implements IdType<string> {
  readonly name = "uuid";

  parse(value: unknown): string {
    if (value == null) {
      throw new InvalidIdError("Id must not be null or undefined.");
    }
    if (typeof value != "string" || !validate(value)) {
      throw new InvalidIdError(`"${String(value)}" is not a valid uuid.`);
    }
    return value.toLowerCase();
  }

  isValid(value: unknown): boolean {
    return typeof value == "string" && validate(value);
  }

  generate(): string {
    return v7();
  }

  is(value: unknown): value is string {
    return this.isValid(value);
  }

  equals(a: unknown, b: unknown): boolean {
    return this.isValid(a) && this.isValid(b) && this.parse(a) == this.parse(b);
  }

  serialize(id: string): string {
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
