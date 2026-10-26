export class InvalidIdError extends Error {
  readonly name = "InvalidIdError";

  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
  }
}

export class DuplicateKeyError extends Error {
  readonly name = "DuplicateKeyError";

  constructor(
    message: string,
    readonly keyValue: Record<string, unknown> = {},
    readonly cause?: unknown
  ) {
    super(message);
  }
}
