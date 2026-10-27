export interface Id {
  toString(): string;
  toJSON?(): unknown;
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
  /**
   * For ids taken from client input before the collection or bucket they address is known.
   * Engines whose key types differ per table may accept loosely here, so code that knows the
   * resource must still parse with forCollection or forBucket.
   */
  unscoped(): IdType;
}

export const ID_TYPES = Symbol.for("SPICA_DATA_ID_TYPES");
