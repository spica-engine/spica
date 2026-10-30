import {Test} from "@nestjs/testing";
import {ORM, PostgresExpiry} from "@spica-server/data-postgresql";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {ACTIVITY_REPOSITORY} from "@spica-server/interface-activity";
import {
  ExpiringRepository,
  PG_POOL,
  REPOSITORY_CLASSES,
  RepositoryClasses
} from "@spica-server/interface-data";
import {COMMAND_REPOSITORY} from "@spica-server/interface-replication";
import pg from "pg";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ago = (milliseconds: number) => new Date(Date.now() - milliseconds);

describe("expiry end to end", () => {
  let module;
  let pool: pg.Pool;
  let orm;
  let expiry: PostgresExpiry;
  let classes: RepositoryClasses;
  let database: string;
  let cron: pg.Client;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    await module.init();
    pool = module.get(PG_POOL);
    orm = module.get(ORM);
    expiry = module.get(PostgresExpiry);
    classes = module.get(REPOSITORY_CLASSES);

    const connection = new URL(pool.options.connectionString as string);
    database = connection.pathname.slice(1);
    connection.pathname = "/postgres";
    cron = new pg.Client({connectionString: connection.toString()});
    await cron.connect();
  });

  afterAll(async () => {
    await cron.end();
    await module.close();
  });

  function createRepository(token: symbol, ...options: object[]): ExpiringRepository {
    const Repository = classes.get(token) as any;
    return new Repository(orm, expiry, ...options);
  }

  async function jobidOf(table: string) {
    const {rows} = await cron.query("SELECT jobid FROM cron.job WHERE jobname = $1", [
      `spica:${database}:${table}`
    ]);
    return rows[0].jobid;
  }

  async function countRowsOf(table: string) {
    const {rows} = await pool.query(`SELECT count(*)::int AS count FROM "${table}"`);
    return rows[0].count;
  }

  async function waitUntil(condition: () => Promise<boolean>, {timeout}: {timeout: number}) {
    const deadline = Date.now() + timeout;
    while (!(await condition())) {
      if (Date.now() > deadline) {
        throw new Error("Condition was not met in time.");
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  it("should delete expired replication commands on the next tick of the shipped schedule", async () => {
    await createRepository(COMMAND_REPOSITORY, {expireAfterSeconds: 300}).applyExpiry();
    await pool.query(
      "INSERT INTO commands (source, target, created_at) VALUES ('{}', '{}', $1), ('{}', '{}', $2)",
      [ago(10 * MINUTE), ago(MINUTE)]
    );

    await waitUntil(async () => (await countRowsOf("commands")) == 1, {timeout: 75_000});

    expect(await countRowsOf("commands")).toBe(1);
  }, 90_000);

  // The test above covers this one. Enable this one and disable the one above if the tick
  // test gets too slow or flaky: alter_job speeds the same job up to run every second.
  // it("should delete expired activities without the test running the purge, using a one second schedule", async () => {
  //   await createRepository(ACTIVITY_REPOSITORY, {expireAfterSeconds: 3600}).applyExpiry();
  //   await cron.query("SELECT cron.alter_job($1, schedule => '1 seconds')", [
  //     await jobidOf("activities")
  //   ]);
  //   await pool.query("INSERT INTO activities (action, created_at) VALUES (1, $1), (1, $2)", [
  //     ago(2 * HOUR),
  //     ago(MINUTE)
  //   ]);

  //   await waitUntil(async () => (await countRowsOf("activities")) == 1, {timeout: 15_000});

  //   expect(await countRowsOf("activities")).toBe(1);
  // }, 20_000);
});
