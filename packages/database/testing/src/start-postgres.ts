import {randomBytes} from "crypto";
import {GenericContainer, StartedTestContainer} from "testcontainers";
import {waitForPostgres} from "@spica-server/database-postgres";

const POSTGRES_IMAGE = "postgres:16";
const POSTGRES_PASSWORD = "spica-test";

/** When a ready server is supplied — by CI or by `jest.global-setup.js` — no container is started. */
let container: StartedTestContainer | undefined;
let sharedUri: string | undefined;
let cleanupRegistered = false;

/**
 * Prepares a PostgreSQL server for the tests and returns the connection URI.
 *
 * **One server, one database per spec**: a container per spec is expensive because of `initdb`, and a separate
 * database isolates just as well.
 *
 * **The sharing cannot live here.** Jest gives every spec file its own module registry, so a module-level
 * `sharedUri` is reset per file and the container would come up per file; `jest.global-setup.js` does the real
 * sharing through `POSTGRES_URL`. This path is kept so a caller without `globalSetup` still works.
 */
export async function startPostgres(): Promise<string> {
  /**
   * The pool shutdown registry is **independent of where the URI came from**: a spec that does not call
   * `module.close()` still leaves a pool, and those accumulate into `sorry, too many clients already`.
   */
  registerCleanupOnce();

  const externalUrl = process.env.POSTGRES_URL;
  if (externalUrl) return externalUrl;
  if (sharedUri) return sharedUri;

  container = await new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(5432)
    .withEnvironment({POSTGRES_PASSWORD})
    .withCommand(["postgres", "-c", "max_connections=500"])
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  sharedUri = `postgres://postgres:${POSTGRES_PASSWORD}@${host}:${port}/postgres`;

  /**
   * A single successful query is not enough: the `postgres` image runs a temporary server for `initdb` and
   * shuts it down, so the first success can hit that one and be followed by `ECONNRESET`.
   */
  await waitForPostgres({connectionString: sharedUri});

  return sharedUri;
}

/**
 * Creates a spec-specific database, so specs running in parallel do not see each other's data. `CREATE
 * DATABASE` cannot run inside a transaction, hence the separate connection.
 */
export async function createPostgresDatabase(baseUri: string): Promise<string> {
  const {Client} = await import("pg");
  const name = `test_${randomBytes(4).toString("hex")}`;

  const admin = new Client({connectionString: baseUri});
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end().catch(() => {});
  }

  const uri = new URL(baseUri);
  uri.pathname = `/${name}`;
  return uri.toString();
}

/**
 * The driver instances that were opened.
 *
 * In specs that do not call `module.close()`, NestJS never triggers `onModuleDestroy` and the pool stays
 * alive. When the shared container stops, those pools produce `57P01 terminating connection`; 167 lines
 * in the `passport/user` log were that noise.
 */
const openServices = new Set<{close(): Promise<void>}>();

export function registerPostgresService(service: {close(): Promise<void>}): void {
  openServices.add(service);
}

let listenClient: unknown | undefined;
let listenClientPromise: Promise<unknown> | undefined;

/**
 * A **single** `LISTEN` client per process.
 *
 * The change stream needs a `LISTEN` session to get the notification at commit time; without it it falls
 * back to 500 ms polling only, and a silent latency difference appears between tests and production.
 *
 * **Opening one per module is not safe.** The tests create dozens of Nest modules per spec, the pool is
 * deliberately limited to 2 connections and a `LISTEN` client cannot be taken from the pool — it is
 * session bound. One client per module means dozens of connections living until the end of the process,
 * and it came back with `sorry, too many clients already`. So the client is shared: the notifications
 * already arrive for every collection on a single channel (`CHANGES_CHANNEL`).
 */
export async function getPostgresListenClient(uri: string): Promise<any> {
  if (listenClient) return listenClient;
  if (!listenClientPromise) {
    listenClientPromise = (async () => {
      const {Client} = await import("pg");
      const client = new Client({connectionString: uri});
      await client.connect();
      registerPostgresService({close: () => client.end().catch(() => {})});
      listenClient = client;
      return client;
    })();
  }
  return listenClientPromise;
}

/** Closes every pool **before** the container stops. */
async function closeOpenServices(): Promise<void> {
  const services = [...openServices];
  openServices.clear();
  await Promise.all(services.map(service => service.close().catch(() => {})));
}

function registerCleanupOnce(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  globalThis.__CLEANUPCALLBACKS = globalThis.__CLEANUPCALLBACKS || [];
  globalThis.__CLEANUPCALLBACKS.push(() =>
    // The order matters: the connections have to close before the server stops.
    closeOpenServices().then(() => container && setTimeout(() => container?.stop(), 2000))
  );
}
