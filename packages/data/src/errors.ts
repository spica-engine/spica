export class InvalidIdError extends Error {
  readonly name = "InvalidIdError";

  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
  }
}
