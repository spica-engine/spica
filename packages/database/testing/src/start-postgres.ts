import {randomBytes} from "crypto";
import pg from "pg";
import {GenericContainer, Wait} from "testcontainers";

const POSTGRES_IMAGE = "postgres:18";
const PASSWORD = "spica";

let baseUri: Promise<string> | undefined;

function startContainer() {
  return new GenericContainer(POSTGRES_IMAGE)
    .withExposedPorts(5432)
    .withEnvironment({POSTGRES_PASSWORD: PASSWORD})
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start()
    .then(container => {
      setGlobalCleanups(() => container.stop());
      return `postgres://postgres:${PASSWORD}@${container.getHost()}:${container.getMappedPort(5432)}/postgres`;
    });
}

function getBaseUri() {
  baseUri ??= process.env.POSTGRES_URL
    ? Promise.resolve(process.env.POSTGRES_URL)
    : startContainer();
  return baseUri;
}

export async function createPostgresDatabase(name?: string) {
  const base = await getBaseUri();
  const database = name || `test_${randomBytes(4).toString("hex")}`;

  const client = new pg.Client({connectionString: base});
  await client.connect();
  try {
    const identifier = pg.escapeIdentifier(database);
    if (name) {
      await client.query(`DROP DATABASE IF EXISTS ${identifier} WITH (FORCE)`);
    }
    await client.query(`CREATE DATABASE ${identifier}`);
  } finally {
    await client.end();
  }

  const uri = new URL(base);
  uri.pathname = `/${database}`;
  return uri.toString();
}

function setGlobalCleanups(stopCallback: () => unknown) {
  globalThis.__CLEANUPCALLBACKS = globalThis.__CLEANUPCALLBACKS || [];
  globalThis.__CLEANUPCALLBACKS.push(() => setTimeout(() => stopCallback(), 2000));
}
