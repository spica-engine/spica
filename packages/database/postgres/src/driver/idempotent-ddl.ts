/**
 * DDL that two sessions may run at the same time, made safe.
 *
 * Bootstrap is not single-writer: `bootstrap()` runs on every API start and the chart supports more than
 * one replica, so two pods coming up together against the same database run the same `CREATE`s and `GRANT`s
 * concurrently. Jest's workers do the same thing to one test server, which is where both failures below were
 * measured.
 *
 * Two different situations, two different answers:
 *
 * - **Already created.** `CREATE … IF NOT EXISTS` is not atomic: both sessions pass the existence check and
 *   the loser fails — `23505` on a catalog index for a schema, `42P06`/`42P07`/`42710` for a schema, table or
 *   type. What the statement was going to do has already been done, so this is success.
 * - **Catalog contention.** Two `GRANT`s touching the same object update the same catalog row and PostgreSQL
 *   raises `tuple concurrently updated`. Nothing has been accomplished here, so this one is **retried**.
 */
const ALREADY_CREATED_CODES = new Set([
  "23505", // unique violation on a catalog index — the classic CREATE SCHEMA race
  "42P06", // duplicate_schema
  "42P07", // duplicate_table
  "42710" // duplicate_object (types, triggers)
]);

const RETRYABLE_CODES = new Set([
  "40001", // serialization_failure
  "40P01" // deadlock_detected
]);

export function isAlreadyCreatedError(error: unknown): boolean {
  return ALREADY_CREATED_CODES.has((error as {code?: string})?.code ?? "");
}

/**
 * `tuple concurrently updated` comes back as `XX000` (internal_error), which is far too broad to match on
 * its own — so the message is matched too. PostgreSQL has no dedicated code for it.
 */
export function isCatalogContentionError(error: unknown): boolean {
  const {code, message} = (error ?? {}) as {code?: string; message?: string};
  if (RETRYABLE_CODES.has(code ?? "")) return true;
  return code === "XX000" && /concurrently (updated|deleted)/i.test(message ?? "");
}

/**
 * Runs one DDL statement, tolerating a concurrent creator and retrying catalog contention.
 *
 * The retry budget is small on purpose: contention here lasts as long as one catalog update, so if it does
 * not clear in a few attempts the cause is something else and the error belongs to the caller.
 */
export async function runIdempotentDdl(
  queryable: {query(sql: string, params?: any[]): Promise<unknown>},
  sql: string,
  params: any[] = [],
  attempts = 5
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await queryable.query(sql, params);
      return;
    } catch (error) {
      if (isAlreadyCreatedError(error)) return;
      if (!isCatalogContentionError(error) || attempt >= attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
    }
  }
}
