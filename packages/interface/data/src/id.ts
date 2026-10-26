export interface Id {
  toString(): string;
  toJSON(): unknown;
}

export interface IdType<T extends Id = Id> {
  readonly name: string;
  parse(value: unknown): T;
  isValid(value: unknown): boolean;
  generate(): T;
  is(value: unknown): value is T;
  equals(a: unknown, b: unknown): boolean;
  serialize(id: T): string;
}

export interface IdTypes {
  forCollection(name: string): IdType;
  forBucket(bucketId: string): Promise<IdType>;
}

export const ID_TYPES = Symbol.for("SPICA_DATA_ID_TYPES");
