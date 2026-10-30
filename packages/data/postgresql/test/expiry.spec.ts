import {Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {ORM, PostgresExpiry} from "@spica-server/data-postgresql";
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

const HOUR = 3600 * 1000;

interface Domain {
  name: string;
  table: string;
  retention: number;
  token: symbol;
  options: (seconds: number) => object[];
  insert: string;
  expired: () => Date;
  kept: () => Date;
}

const ago = (hours: number) => () => new Date(Date.now() - hours * HOUR);
const ahead = (hours: number) => () => new Date(Date.now() + hours * HOUR);

const domains: Domain[] = [
  {
    name: "activities",
    table: "activities",
    retention: 3600,
    token: ACTIVITY_REPOSITORY,
    options: s => [{expireAfterSeconds: s}],
    insert: "INSERT INTO activities (action, created_at) VALUES (1, $1)",
    expired: ago(2),
    kept: ago(0)
  },
  {
    name: "status entries",
    table: "statuses",
    retention: 3600,
    token: STATUS_REPOSITORY,
    options: s => [{expireAfterSeconds: s}],
    insert: "INSERT INTO statuses (minute, created_at) VALUES ($1, $1)",
    expired: ago(2),
    kept: ago(0)
  },
  {
    name: "function logs",
    table: "function_logs",
    retention: 3600,
    token: FUNCTION_LOG_REPOSITORY,
    options: s => [{expireAfterSeconds: s}],
    insert: "INSERT INTO function_logs (function_id, created_at) VALUES (gen_random_uuid(), $1)",
    expired: ago(2),
    kept: ago(0)
  },
  {
    name: "webhook logs",
    table: "webhook_logs",
    retention: 3600,
    token: WEBHOOK_LOG_REPOSITORY,
    options: s => [{expireAfterSeconds: s}],
    insert: "INSERT INTO webhook_logs (webhook_id, created_at) VALUES (gen_random_uuid(), $1)",
    expired: ago(2),
    kept: ago(0)
  },
  {
    name: "refresh tokens",
    table: "refresh_tokens",
    retention: 0,
    token: REFRESH_TOKEN_REPOSITORY,
    options: () => [],
    insert: "INSERT INTO refresh_tokens (token, expired_at) VALUES (gen_random_uuid()::text, $1)",
    expired: ago(1),
    kept: ahead(1)
  },
  {
    name: "user verifications",
    table: "verifications",
    retention: 300,
    token: VERIFICATION_REPOSITORY,
    options: s => [{verificationCodeExpiresIn: s}],
    insert:
      "INSERT INTO verifications (user_id, strategy, purpose, created_at) VALUES (gen_random_uuid(), 's', 'p', $1)",
    expired: ago(1),
    kept: ago(0)
  },
  {
    name: "replication commands",
    table: "commands",
    retention: 300,
    token: COMMAND_REPOSITORY,
    options: s => [{expireAfterSeconds: s}],
    insert: "INSERT INTO commands (source, target, created_at) VALUES ('{}', '{}', $1)",
    expired: ago(1),
    kept: ago(0)
  },
  {
    name: "replication jobs",
    table: "jobs",
    retention: 300,
    token: JOB_REPOSITORY,
    options: s => [{expireAfterSeconds: s}],
    insert: "INSERT INTO jobs (key, created_at) VALUES (gen_random_uuid()::text, $1)",
    expired: ago(1),
    kept: ago(0)
  }
];

describe("expiry", () => {
  let module;
  let pool: pg.Pool;
  let orm;
  let classes: RepositoryClasses;
  let expiry: PostgresExpiry;
  let database: string;
  let cron: pg.Client;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    await module.init();
    pool = module.get(PG_POOL);
    orm = module.get(ORM);
    classes = module.get(REPOSITORY_CLASSES);
    expiry = module.get(PostgresExpiry);

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

  const repositoryOf = (domain: Domain, seconds: number): ExpiringRepository => {
    const Repository = classes.get(domain.token) as any;
    return new Repository(orm, expiry, ...domain.options(seconds));
  };

  const jobOf = async (table: string) => {
    const {rows} = await cron.query(
      "SELECT jobid, schedule, command, database, username FROM cron.job WHERE jobname = $1",
      [`spica:${database}:${table}`]
    );
    return rows[0];
  };

  describe.each(domains)("$name", domain => {
    it("should schedule a purge job of the table every minute", async () => {
      await repositoryOf(domain, domain.retention).applyExpiry();

      expect(await jobOf(domain.table)).toEqual({
        jobid: expect.anything(),
        schedule: "* * * * *",
        command: expect.stringContaining(`DELETE FROM "${domain.table}"`),
        database,
        username: expect.any(String)
      });
    });

    if (domain.token != REFRESH_TOKEN_REPOSITORY) {
      it("should update the same job when the retention changes", async () => {
        await repositoryOf(domain, 600).applyExpiry();
        const before = await jobOf(domain.table);

        await repositoryOf(domain, 1200).applyExpiry();
        const after = await jobOf(domain.table);

        expect(after.jobid).toEqual(before.jobid);
        expect(after.command).not.toEqual(before.command);
      });
    }

    it("should have the job delete only the expired rows", async () => {
      await repositoryOf(domain, domain.retention).applyExpiry();
      await pool.query(domain.insert, [domain.expired()]);
      await pool.query(domain.insert, [domain.kept()]);

      await pool.query((await jobOf(domain.table)).command);

      const {rows} = await pool.query(`SELECT count(*)::int AS count FROM "${domain.table}"`);
      expect(rows[0].count).toBe(1);
    });

    it("should be applicable again with the same retention", async () => {
      const repository = repositoryOf(domain, domain.retention);

      await repository.applyExpiry();
      const before = await jobOf(domain.table);
      await repository.applyExpiry();

      expect(await jobOf(domain.table)).toEqual(before);
    });
  });

  const activity = (expiry: PostgresExpiry, seconds: number): ExpiringRepository => {
    const Repository = classes.get(ACTIVITY_REPOSITORY) as any;
    return new Repository(orm, expiry, {expireAfterSeconds: seconds});
  };

  it("should schedule the jobs of concurrent replicas without conflicts", async () => {
    const repository = activity(expiry, 60);

    await expect(
      Promise.all(Array.from({length: 5}, () => repository.applyExpiry()))
    ).resolves.toBeDefined();
    const {rows} = await cron.query(
      "SELECT count(*)::int AS count FROM cron.job WHERE jobname = $1",
      [`spica:${database}:activities`]
    );
    expect(rows[0].count).toBe(1);
  });

  it("should reject a retention that is not a non-negative integer of seconds", async () => {
    await expect(activity(expiry, -1).applyExpiry()).rejects.toThrow(/non-negative integer/);
  });

  it("should fail with a pg_cron hint when the server does not preload it", async () => {
    const pool = {
      query: async () => ({rows: [{database: "app", cron: null}]})
    } as unknown as pg.Pool;

    await expect(activity(new PostgresExpiry(pool), 60).applyExpiry()).rejects.toThrow(/pg_cron/);
  });
});
