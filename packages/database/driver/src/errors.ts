/**
 * The contract's error types.
 *
 * The contract **promises** that an unsupported expression is rejected loudly, so the error type is part
 * of the contract: without it the promise cannot be checked.
 */
export class UnsupportedExpressionError extends Error {
  readonly code = "UNSUPPORTED_EXPRESSION";
  constructor(
    readonly detail: string,
    readonly backend?: string
  ) {
    super(
      `This expression is not supported${backend ? ` on the ${backend} backend` : ""}: ${detail}`
    );
    this.name = "UnsupportedExpressionError";
  }
}

export class UnsupportedCapabilityError extends Error {
  readonly code = "UNSUPPORTED_CAPABILITY";
  constructor(
    readonly capability: string,
    readonly backend: string
  ) {
    super(`'${capability}' is not available on the ${backend} backend.`);
    this.name = "UnsupportedCapabilityError";
  }
}

/** A schema change could not take the lock; the plan was not applied. */
export class SchemaLockTimeoutError extends Error {
  readonly code = "SCHEMA_LOCK_TIMEOUT";
  constructor(
    readonly collection: string,
    readonly attempts: number
  ) {
    super(
      `Could not acquire a lock on '${collection}' after ${attempts} attempts; ` +
        `the schema change was not applied.`
    );
    this.name = "SchemaLockTimeoutError";
  }
}

/** The intent and the derivative diverged. */
export class SchemaDriftError extends Error {
  readonly code = "SCHEMA_DRIFT";
  constructor(
    readonly collection: string,
    readonly summary: string
  ) {
    super(`Schema drift detected on '${collection}': ${summary}`);
    this.name = "SchemaDriftError";
  }
}

/**
 * A uniqueness constraint violation.
 *
 * **Why `code` is 11000.** `error.code === 11000` is checked in **eleven** places across **seven** files
 * in the codebase: `passport/identity` ×2, `passport/user` ×2, `storage` ×2, `status`, `function/crud`,
 * `bucket/common/crud`, `replication/reducer`. It is an internal contract in practice; that it is
 * MongoDB's error code is no accident, the codebase adopted it.
 *
 * (The first count said "seven places" and was short — `storage` and `bucket/common` had been missed. The
 * number matters because it is the rationale itself.)
 *
 * Keeping the number makes the two backends compatible without touching the seven call sites. New code
 * can use `instanceof DuplicateKeyError`; the number stays for backwards compatibility and that choice is
 * deliberate, not hidden.
 *
 * The PostgreSQL counterpart is `23505 unique_violation`; the driver converts it into this error at the
 * boundary. Not converting it would mean an ordinary situation such as "a duplicate record" surfacing
 * with a different message per backend — the `identity` test caught exactly that.
 */
export class DuplicateKeyError extends Error {
  readonly code = 11000;

  /**
   * The conflicting field → value. The **same name** as the MongoDB driver's `keyValue`, for the same
   * reason as `code = 11000`: two production sites (`function/crud.ts`, `bucket/common/crud.ts`) read the
   * field name from it and build the message returned to the user.
   *
   * When it was not carried the symptom was loud but pointed at the wrong place: `Object.keys(undefined)`
   * blew up **inside** the catch block and a duplicate record returned a **500** instead of a 400.
   */
  readonly keyValue: Record<string, unknown>;

  constructor(
    readonly constraint: string,
    readonly detail?: string,
    keyValue?: Record<string, unknown>
  ) {
    super(detail || `Duplicate key value violates unique constraint '${constraint}'.`);
    this.name = "DuplicateKeyError";
    this.keyValue = keyValue || {[constraint]: undefined};
  }
}
