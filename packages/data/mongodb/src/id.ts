import {InvalidIdError} from "@spica-server/data";
import {ObjectId} from "@spica-server/database";
import {IdType, IdTypes} from "@spica-server/interface-data";

type ObjectIdInput = ConstructorParameters<typeof ObjectId>[0];

export class ObjectIdType implements IdType<ObjectId> {
  readonly name = "objectid";

  parse(value: unknown): ObjectId {
    if (value == null) {
      throw new InvalidIdError("Id must not be null or undefined.");
    }
    try {
      return new ObjectId(value as ObjectIdInput);
    } catch (error) {
      throw new InvalidIdError(error.message, error);
    }
  }

  isValid(value: unknown): boolean {
    return ObjectId.isValid(value as ObjectIdInput);
  }

  generate(): ObjectId {
    return new ObjectId();
  }

  is(value: unknown): value is ObjectId {
    return value instanceof ObjectId;
  }

  equals(a: unknown, b: unknown): boolean {
    if (!this.isValid(a) || !this.isValid(b)) {
      return false;
    }
    return this.parse(a).equals(this.parse(b));
  }

  serialize(id: ObjectId): string {
    return id.toHexString();
  }
}

export class MongoIdTypes implements IdTypes {
  private readonly objectId = new ObjectIdType();

  forCollection(): IdType {
    return this.objectId;
  }

  forBucket(): Promise<IdType> {
    return Promise.resolve(this.objectId);
  }

  unscoped(): IdType {
    return this.objectId;
  }
}
