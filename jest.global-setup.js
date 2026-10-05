/**
 * Brings the database server up **once per process**, on either leg.
 *
 * Why here and not in the `start*.ts` helpers: Jest gives every spec file its own module registry, so a
 * module-level `sharedUri` is reset per file and a "shared" container actually comes up **per spec file**.
 * That was measured twice. On PostgreSQL, even with `--runInBand`, four `postgres:16` containers were up at
 * once — each running `initdb`, none stopping until the run ended — which produced Docker resource pressure
 * and a pile of empty-message `AggregateError`s in `api/passport`: failures caused by the infrastructure and
 * unrelated to the driver. On MongoDB the same structure cost the whole leg: one `mongo:8.0.4` container per
 * spec file, ~105 minutes for the 78 projects against PostgreSQL's ~30, and suites whose container startup
 * passed jest's 30 s hook timeout once the machine was loaded.
 *
 * `globalSetup` runs in the main process, before every spec file, and the `process.env` changes made here
 * are inherited by the workers. Publishing the server through `MONGODB_URL`/`POSTGRES_URL` is **the same**
 * path CI uses when it supplies a ready server — no second mechanism is added, and when CI does supply one
 * both branches return immediately.
 *
 * Sharing one server is safe because isolation is per **database**, not per server: every
 * `DatabaseTestingModule` call gets a random database name and no spec asks for a fixed one.
 */
const POSTGRES_IMAGE = "postgres:16";
const POSTGRES_PASSWORD = "spica-test";
const MONGO_IMAGE = "mongo:8.0.4";
const REPLICA_SET = "testset";

async function waitUntilReady(connectionString) {
  const {default: pg} = await import("pg");
  let streak = 0;
  let lastError;

  for (let attempt = 0; attempt < 90; attempt++) {
    const client = new pg.Client({connectionString, connectionTimeoutMillis: 1_000});
    try {
      await client.connect();
      await client.query("SELECT 1");
      // A single success is not enough: the `postgres` image brings up a temporary server for `initdb`
      // and shuts it down, and the first success can hit that one (followed by ECONNRESET). Measured.
      if (++streak >= 3) return;
    } catch (error) {
      lastError = error;
      streak = 0;
    } finally {
      await client.end().catch(() => {});
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`PostgreSQL did not become ready: ${lastError?.message ?? lastError}`);
}

/**
 * Waits for the replica set to have elected its primary.
 *
 * `replSetInitiate` returns before the election finishes, and a write against a server that is not yet
 * primary fails. `start.ts` used to pause a flat 3 s here; asking the server is both quicker in the good
 * case and does not quietly proceed in the bad one.
 */
async function waitUntilPrimary(uri) {
  const {MongoClient} = await import("mongodb");
  let lastError;

  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new MongoClient(uri, {directConnection: true, serverSelectionTimeoutMS: 1_000});
    try {
      await client.connect();
      const hello = await client.db("admin").command({hello: 1});
      if (hello.isWritablePrimary) return;
    } catch (error) {
      lastError = error;
    } finally {
      await client.close().catch(() => {});
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(
    `MongoDB replica set did not elect a primary: ${lastError?.message ?? lastError}`
  );
}

async function startMongo() {
  if (process.env.MONGODB_URL) return;

  const {GenericContainer} = await import("testcontainers");
  const {MongoClient} = await import("mongodb");

  const container = await new GenericContainer(MONGO_IMAGE)
    .withExposedPorts(27017)
    .withCommand(["--replSet", REPLICA_SET, "--bind_ip_all"])
    .start();

  const uri = `mongodb://${container.getHost()}:${container.getMappedPort(
    27017
  )}/?directConnection=true&retryWrites=false`;

  const client = new MongoClient(uri, {directConnection: true});
  await client.connect();
  /**
   * The member advertises itself as `localhost:27017` — its own view from inside the container, which is
   * not reachable from here. `directConnection` is what makes that irrelevant: the driver talks to the
   * mapped port and never follows the advertised address.
   */
  await client.db("admin").command({
    replSetInitiate: {_id: REPLICA_SET, members: [{_id: 0, host: "localhost:27017"}]}
  });
  await client.close();

  await waitUntilPrimary(uri);

  process.env.MONGODB_URL = uri;
  globalThis.__SPICA_MONGO_CONTAINER = container;
}

async function startPostgres() {
  if (process.env.POSTGRES_URL) return;

  // A lazy import: CI with a ready server never loads these modules.
  const {GenericContainer} = await import("testcontainers");

  const container = await new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(5432)
    .withEnvironment({POSTGRES_PASSWORD})
    .withCommand(["postgres", "-c", "max_connections=500"])
    .start();

  const uri = `postgres://postgres:${POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
    5432
  )}/postgres`;

  await waitUntilReady(uri);

  process.env.POSTGRES_URL = uri;
  globalThis.__SPICA_PG_CONTAINER = container;
}

export default async function globalSetup() {
  const backend = (process.env.SPICA_TEST_BACKEND || "mongodb").toLowerCase();
  return backend === "postgres" ? startPostgres() : startMongo();
}
