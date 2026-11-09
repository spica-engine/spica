import {Test, TestingModule} from "@nestjs/testing";
import {Orm, ORM} from "@spica-server/data-postgresql";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {PG_POOL} from "@spica-server/interface-data";
import {
  TRANSACTION_RUNNER,
  TransactionExecutor,
  TransactionRunner
} from "@spica-server/transaction";
import pg from "pg";

describe("PostgreSQL transaction runner", () => {
  let module: TestingModule;
  let runner: TransactionRunner;
  let orm: Orm;
  let pool: pg.Pool;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    await module.init();
    runner = module.get(TRANSACTION_RUNNER);
    orm = module.get(ORM);
    pool = module.get(PG_POOL);
    await pool.query("CREATE TABLE probe (value text)");
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(() => pool.query("DELETE FROM probe"));

  const add = (value: string) => orm.raw("INSERT INTO probe (value) VALUES ($1)", [value]);
  const stored = async () =>
    (await pool.query("SELECT value FROM probe ORDER BY value")).rows.map(row => row.value);

  it("should commit what the work wrote through the orm together", async () => {
    await runner(async () => {
      await add("a");
      await add("b");
    });

    expect(await stored()).toEqual(["a", "b"]);
  });

  it("should keep what the work wrote from other connections until it commits", async () => {
    await runner(async () => {
      await add("a");

      expect(await stored()).toEqual([]);
    });

    expect(await stored()).toEqual(["a"]);
  });

  it("should write nothing when the work fails", async () => {
    await expect(
      runner(async () => {
        await add("a");
        throw new Error("failed");
      })
    ).rejects.toThrow("failed");

    expect(await stored()).toEqual([]);
  });

  it("should answer what the work answers", async () => {
    expect(await runner(async () => 42)).toBe(42);
  });

  it("should let a transaction of the orm made inside the work join it", async () => {
    await expect(
      runner(async () => {
        await add("a");
        await orm.transaction(async session => {
          await session.raw("INSERT INTO probe (value) VALUES ('b')");
        });
        throw new Error("failed");
      })
    ).rejects.toThrow("failed");

    expect(await stored()).toEqual([]);
  });

  it("should undo only the inner transaction when the work handles its failure", async () => {
    await runner(async () => {
      await add("outer");
      await expect(
        orm.transaction(async session => {
          await session.raw("INSERT INTO probe (value) VALUES ('inner')");
          await session.raw("SELECT 1 / 0");
        })
      ).rejects.toThrow("division by zero");
      await add("after");
    });

    expect(await stored()).toEqual(["after", "outer"]);
  });

  it("should keep what a joined transaction wrote when it succeeds", async () => {
    await runner(async () => {
      await orm.transaction(async session => {
        await session.raw("INSERT INTO probe (value) VALUES ('inner')");
      });
      await add("outer");
    });

    expect(await stored()).toEqual(["inner", "outer"]);
  });

  it("should refuse a database call that is still running when the work has ended", async () => {
    let late: Promise<unknown> = Promise.resolve();

    await runner(async () => {
      await add("inside");
      late = new Promise(resolve => setTimeout(resolve, 20)).then(() => add("late"));
    });

    await expect(late).rejects.toThrow("The transaction of this call has ended");
    expect(await stored()).toEqual(["inside"]);
  });

  it("should roll back by hand through the pool once the database has rolled back", async () => {
    const executor = new TransactionExecutor(runner)
      .add({
        execute: async () => {
          await add("by hand");
        },
        rollback: async () => {
          await orm.raw("DELETE FROM probe WHERE value = 'by hand'");
        }
      })
      .add({
        native: true,
        execute: async () => {
          await orm.raw("SELECT 1 / 0");
        },
        rollback: async () => {}
      });

    await expect(executor.execute()).rejects.toThrow("division by zero");

    expect(await stored()).toEqual([]);
  });

  it("should keep queries of the orm out of a transaction that no runner started", async () => {
    await orm.transaction(async session => {
      await session.raw("INSERT INTO probe (value) VALUES ('inside')");

      expect((await orm.raw("SELECT value FROM probe")).rows).toEqual([]);
    });

    expect(await stored()).toEqual(["inside"]);
  });

  it("should not use the transaction outside of the work", async () => {
    const work = runner(async () => {
      await add("inside");
      throw new Error("failed");
    });
    await expect(work).rejects.toThrow();

    await add("outside");

    expect(await stored()).toEqual(["outside"]);
  });

  it("should keep runners that run at the same time apart", async () => {
    const gate = new Promise<void>(resolve => setTimeout(resolve, 50));

    const results = await Promise.allSettled([
      runner(async () => {
        await add("first");
        await gate;
      }),
      runner(async () => {
        await add("second");
        await gate;
        throw new Error("failed");
      })
    ]);

    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(await stored()).toEqual(["first"]);
  });

  it("should roll the database steps of an executor back with the runner", async () => {
    const files: string[] = [];
    const executor = new TransactionExecutor(runner)
      .add({
        native: true,
        execute: async () => {
          await add("row");
        },
        rollback: async () => {
          throw new Error("a native step is not rolled back by hand");
        }
      })
      .add({
        execute: async () => {
          files.push("written");
        },
        rollback: async () => {
          files.pop();
        }
      })
      .add({
        execute: async () => Promise.reject(new Error("upload failed")),
        rollback: async () => {}
      });

    await expect(executor.execute()).rejects.toThrow("upload failed");

    expect(await stored()).toEqual([]);
    expect(files).toEqual([]);
  });
});
