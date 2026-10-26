import {Id, IdType, IdTypes} from "@spica-server/interface-data";

const notImplemented = (): never => {
  throw new Error("PostgreSQL ids are not implemented yet.");
};

const unimplementedIdType: IdType = {
  name: "unimplemented",
  parse: notImplemented,
  isValid: notImplemented,
  generate: notImplemented,
  is: (_value: unknown): _value is Id => notImplemented(),
  equals: notImplemented,
  serialize: notImplemented
};

export class PostgresIdTypes implements IdTypes {
  forCollection() {
    return unimplementedIdType;
  }

  async forBucket() {
    return unimplementedIdType;
  }

  unscoped() {
    return unimplementedIdType;
  }
}
