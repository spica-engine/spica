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
import {FUNCTION_LOG_REPOSITORY} from "@spica-server/interface-function-log";
import {WEBHOOK_LOG_REPOSITORY} from "@spica-server/interface-function-webhook";
import {REFRESH_TOKEN_REPOSITORY} from "@spica-server/interface-passport-refresh_token";
import {VERIFICATION_REPOSITORY} from "@spica-server/interface-passport-user";
import {COMMAND_REPOSITORY, JOB_REPOSITORY} from "@spica-server/interface-replication";
import {STATUS_REPOSITORY} from "@spica-server/interface-status";
import pg from "pg";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const ago = (milliseconds: number) => new Date(Date.now() - milliseconds);
const fromNow = (milliseconds: number) => new Date(Date.now() + milliseconds);

describe("expiry", () => {
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

  afterEach(() =>
    pool.query(
      "TRUNCATE activities, statuses, function_logs, webhook_logs, refresh_tokens, verifications, commands, jobs"
    )
  );

  function createRepository(token: symbol, ...options: object[]): ExpiringRepository {
    const Repository = classes.get(token) as any;
    return new Repository(orm, expiry, ...options);
  }

  async function jobOf(table: string) {
    const {rows} = await cron.query(
      "SELECT jobid, jobname, schedule, command, database FROM cron.job WHERE jobname = $1",
      [`spica:${database}:${table}`]
    );
    return rows[0];
  }

  async function runPurgeOf(table: string) {
    const {command} = await jobOf(table);
    await pool.query(command);
  }

  async function countRowsOf(table: string) {
    const {rows} = await pool.query(`SELECT count(*)::int AS count FROM "${table}"`);
    return rows[0].count;
  }

  describe("indexes", () => {
    async function indexedColumnsOf(table: string) {
      const {rows} = await pool.query("SELECT indexdef FROM pg_indexes WHERE tablename = $1", [
        table
      ]);
      return rows.map(row => row.indexdef as string);
    }

    it("should index the expiry column of every table the purge reads", async () => {
      expect(await indexedColumnsOf("activities")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("statuses")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("function_logs")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("webhook_logs")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("verifications")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("commands")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("jobs")).toContainEqual(
        expect.stringMatching(/\(created_at\)/)
      );
      expect(await indexedColumnsOf("refresh_tokens")).toContainEqual(
        expect.stringMatching(/\(expired_at\)/)
      );
    });
  });

  describe("scheduling", () => {
    const activities = (seconds: number) =>
      createRepository(ACTIVITY_REPOSITORY, {expireAfterSeconds: seconds});

    it("should schedule a job that purges the table every minute in the application database", async () => {
      await activities(3600).applyExpiry();

      expect(await jobOf("activities")).toEqual({
        jobid: expect.anything(),
        jobname: `spica:${database}:activities`,
        schedule: "* * * * *",
        command:
          'DELETE FROM "activities" WHERE "created_at" < now() - make_interval(secs => 3600)',
        database
      });
    });

    it("should leave the job unchanged when applied again with the same retention", async () => {
      await activities(3600).applyExpiry();
      const before = await jobOf("activities");

      await activities(3600).applyExpiry();

      expect(await jobOf("activities")).toEqual(before);
    });

    it("should keep the job and change its command when the retention changes", async () => {
      await activities(600).applyExpiry();
      const before = await jobOf("activities");

      await activities(1200).applyExpiry();
      const after = await jobOf("activities");

      expect(after.jobid).toEqual(before.jobid);
      expect(after.command).toContain("secs => 1200");
    });

    it("should end up with a single job when replicas apply it at the same time", async () => {
      await Promise.all(Array.from({length: 5}, () => activities(3600).applyExpiry()));

      const {rows} = await cron.query(
        "SELECT count(*)::int AS count FROM cron.job WHERE jobname = $1",
        [`spica:${database}:activities`]
      );
      expect(rows[0].count).toBe(1);
    });

    it("should reject a retention that is negative or fractional", async () => {
      await expect(activities(-1).applyExpiry()).rejects.toThrow(/non-negative integer/);
      await expect(activities(1.5).applyExpiry()).rejects.toThrow(/non-negative integer/);
    });

    it("should fail with a pg_cron hint when the server does not preload it", async () => {
      const serverWithoutPgCron = {
        query: async () => ({rows: [{database: "app", cron: null}]})
      } as unknown as pg.Pool;
      const Repository = classes.get(ACTIVITY_REPOSITORY) as any;
      const repository: ExpiringRepository = new Repository(
        orm,
        new PostgresExpiry(serverWithoutPgCron),
        {expireAfterSeconds: 3600}
      );

      await expect(repository.applyExpiry()).rejects.toThrow(/pg_cron/);
    });
  });

  describe("activities", () => {
    const insert = (createdAt: Date) =>
      pool.query("INSERT INTO activities (action, created_at) VALUES (1, $1)", [createdAt]);

    it("should purge activities older than the retention and keep newer ones", async () => {
      await createRepository(ACTIVITY_REPOSITORY, {expireAfterSeconds: 3600}).applyExpiry();
      await insert(ago(2 * HOUR));
      await insert(ago(MINUTE));

      await runPurgeOf("activities");

      expect(await countRowsOf("activities")).toBe(1);
      const {rows} = await pool.query("SELECT created_at FROM activities");
      expect(rows[0].created_at.getTime()).toBeGreaterThan(ago(HOUR).getTime());
    });
  });

  describe("status entries", () => {
    const insert = (createdAt: Date) =>
      pool.query("INSERT INTO statuses (minute, created_at) VALUES ($1, $1)", [createdAt]);

    it("should purge status entries older than the retention and keep newer ones", async () => {
      await createRepository(STATUS_REPOSITORY, {expireAfterSeconds: 3600}).applyExpiry();
      await insert(ago(2 * HOUR));
      await insert(ago(MINUTE));

      await runPurgeOf("statuses");

      expect(await countRowsOf("statuses")).toBe(1);
    });
  });

  describe("function logs", () => {
    const insert = (createdAt: Date) =>
      pool.query(
        "INSERT INTO function_logs (function_id, created_at) VALUES (gen_random_uuid(), $1)",
        [createdAt]
      );

    it("should purge function logs older than the retention and keep newer ones", async () => {
      await createRepository(FUNCTION_LOG_REPOSITORY, {
        expireAfterSeconds: 3600,
        realtime: false
      }).applyExpiry();
      await insert(ago(2 * HOUR));
      await insert(ago(MINUTE));

      await runPurgeOf("function_logs");

      expect(await countRowsOf("function_logs")).toBe(1);
    });
  });

  describe("webhook logs", () => {
    const insert = (createdAt: Date) =>
      pool.query(
        "INSERT INTO webhook_logs (webhook_id, created_at) VALUES (gen_random_uuid(), $1)",
        [createdAt]
      );

    it("should purge webhook logs older than the retention and keep newer ones", async () => {
      await createRepository(WEBHOOK_LOG_REPOSITORY, {expireAfterSeconds: 3600}).applyExpiry();
      await insert(ago(2 * HOUR));
      await insert(ago(MINUTE));

      await runPurgeOf("webhook_logs");

      expect(await countRowsOf("webhook_logs")).toBe(1);
    });
  });

  describe("user verifications", () => {
    const insert = (createdAt: Date) =>
      pool.query(
        "INSERT INTO verifications (user_id, strategy, purpose, created_at) VALUES (gen_random_uuid(), 'sms', 'signup', $1)",
        [createdAt]
      );

    it("should purge verifications older than the verification code lifetime", async () => {
      await createRepository(VERIFICATION_REPOSITORY, {
        verificationCodeExpiresIn: 3600
      }).applyExpiry();
      await insert(ago(2 * HOUR));
      await insert(ago(MINUTE));

      await runPurgeOf("verifications");

      expect(await countRowsOf("verifications")).toBe(1);
    });

    it("should keep verifications for 5 minutes when no lifetime is configured", async () => {
      await createRepository(VERIFICATION_REPOSITORY, {}).applyExpiry();
      await insert(ago(10 * MINUTE));
      await insert(ago(MINUTE));

      await runPurgeOf("verifications");

      expect(await countRowsOf("verifications")).toBe(1);
    });
  });

  describe("replication commands", () => {
    const insert = (createdAt: Date) =>
      pool.query("INSERT INTO commands (source, target, created_at) VALUES ('{}', '{}', $1)", [
        createdAt
      ]);

    it("should purge commands older than the retention and keep newer ones", async () => {
      await createRepository(COMMAND_REPOSITORY, {expireAfterSeconds: 300}).applyExpiry();
      await insert(ago(10 * MINUTE));
      await insert(ago(MINUTE));

      await runPurgeOf("commands");

      expect(await countRowsOf("commands")).toBe(1);
    });
  });

  describe("replication jobs", () => {
    const insert = (createdAt: Date) =>
      pool.query("INSERT INTO jobs (key, created_at) VALUES (gen_random_uuid()::text, $1)", [
        createdAt
      ]);

    it("should purge jobs older than the retention and keep newer ones", async () => {
      await createRepository(JOB_REPOSITORY, {expireAfterSeconds: 300}).applyExpiry();
      await insert(ago(10 * MINUTE));
      await insert(ago(MINUTE));

      await runPurgeOf("jobs");

      expect(await countRowsOf("jobs")).toBe(1);
    });
  });

  describe("refresh tokens", () => {
    const insert = (expiredAt: Date) =>
      pool.query(
        "INSERT INTO refresh_tokens (token, expired_at) VALUES (gen_random_uuid()::text, $1)",
        [expiredAt]
      );

    it("should purge tokens as soon as they have expired and keep valid ones", async () => {
      await createRepository(REFRESH_TOKEN_REPOSITORY).applyExpiry();
      await insert(ago(HOUR));
      await insert(fromNow(HOUR));

      await runPurgeOf("refresh_tokens");

      expect(await countRowsOf("refresh_tokens")).toBe(1);
      const {rows} = await pool.query("SELECT expired_at FROM refresh_tokens");
      expect(rows[0].expired_at.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
