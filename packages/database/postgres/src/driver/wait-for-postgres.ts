import {Client, ClientConfig} from "pg";

export interface WaitOptions {
  /** How many times to retry. */
  attempts?: number;
  /** The wait between attempts. */
  intervalMs?: number;
  /**
   * How many **consecutive** successes count as "ready".
   *
   * One is not enough: the `postgres` image brings up a temporary server for `initdb`, then shuts it
   * down and starts the real one. A single successful `SELECT 1` can hit the temporary server and the
   * connection is reset right afterwards (`ECONNRESET`). Measured: on a loaded machine three PG specs
   * were breaking because of it.
   */
  consecutive?: number;
}

/**
 * Waits for a PostgreSQL server to be genuinely ready.
 *
 * Anything that connects to a freshly started server needs this — the tests as much as an API pod that
 * starts alongside a fresh database. Every attempt uses **a new `Client`**; using a pool can reuse closed
 * connections and give a false positive.
 */
export async function waitForPostgres(
  config: ClientConfig,
  options: WaitOptions = {}
): Promise<void> {
  const attempts = options.attempts ?? 90;
  const intervalMs = options.intervalMs ?? 500;
  const needed = options.consecutive ?? 3;

  let streak = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const client = new Client({connectionTimeoutMillis: 1_000, ...config});
    try {
      await client.connect();
      await client.query("SELECT 1");
      streak++;
      if (streak >= needed) return;
    } catch (error) {
      lastError = error;
      streak = 0;
    } finally {
      await client.end().catch(() => {});
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `PostgreSQL did not become ready after ${attempts} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}
