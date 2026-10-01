import {describe, expect, it} from "@jest/globals";
import {TableSpec} from "@spica-server/database-driver";
import {PostgresSchemaManager} from "@spica-server/database-postgres";

/**
 * `plan()` touches the database on **one** path only: a rewriting type change reads `reltuples` to
 * decide whether the change is long running. Everything else is a pure function over the two
 * definitions, so a fake that answers nothing is enough.
 */
const noop = {query: async () => ({rows: [], rowCount: 0})};
const runner = {transaction: async (work: any) => work(noop)};
const manager = new PostgresSchemaManager(noop, runner);

/** A fake whose `reltuples` answer is fixed, for the long-running threshold. */
const withEstimate = (estimate: number, threshold?: number) => {
  const db = {query: async () => ({rows: [{estimate}], rowCount: 1})};
  return new PostgresSchemaManager(
    db,
    {transaction: async (work: any) => work(db)},
    threshold === undefined ? {} : {rewriteThreshold: threshold}
  );
};

const table = (columns: TableSpec["columns"]): TableSpec => ({
  collection: "bucket_67a1",
  columns
});

const sql = (plan: {statements: string[]}) => plan.statements.join(" | ");

describe("plan — additions", () => {
  it("a new column produces an ADD COLUMN", async () => {
    const plan = await manager.plan(table([]), table([{name: "title", kind: "text"}]));
    expect(plan.changes).toEqual([
      {kind: "addColumn", column: "title", spec: {name: "title", kind: "text"}}
    ]);
    expect(sql(plan)).toBe('ALTER TABLE bucket."bucket_67a1" ADD COLUMN "title" text');
  });

  it("no NOT NULL and no DEFAULT are produced (the safety rule)", async () => {
    const plan = await manager.plan(table([]), table([{name: "title", kind: "text"}]));
    expect(sql(plan)).not.toContain("NOT NULL");
    expect(sql(plan)).not.toContain("DEFAULT");
  });

  it("does not require a rewrite", async () => {
    const plan = await manager.plan(table([]), table([{name: "title", kind: "text"}]));
    expect(plan.requiresRewrite).toBe(false);
  });

  it("a relation column produces an FK constraint too", async () => {
    const plan = await manager.plan(
      table([]),
      table([{name: "author", kind: "reference", target: "bucket_67b3", cascadeOnDelete: true}])
    );
    expect(sql(plan)).toContain('ADD COLUMN "author" char(24)');
    expect(sql(plan)).toContain("FOREIGN KEY");
    expect(sql(plan)).toContain("ON DELETE CASCADE");
  });

  it("a relation that is not dependent gets SET NULL", async () => {
    const plan = await manager.plan(
      table([]),
      table([{name: "author", kind: "reference", target: "bucket_67b3"}])
    );
    expect(sql(plan)).toContain("ON DELETE SET NULL");
  });
});

describe("plan — drops", () => {
  it("a removed column produces a DROP COLUMN", async () => {
    const plan = await manager.plan(table([{name: "title", kind: "text"}]), table([]));
    expect(plan.changes[0]).toEqual({kind: "dropColumn", column: "title"});
    expect(sql(plan)).toBe('ALTER TABLE bucket."bucket_67a1" DROP COLUMN "title"');
  });
});

describe("plan — renaming", () => {
  it("produces a RENAME COLUMN when a hint is given, NOT a drop+add", async () => {
    const plan = await manager.plan(
      table([{name: "title", kind: "text"}]),
      table([{name: "heading", kind: "text"}]),
      {renames: [{from: "title", to: "heading"}]}
    );
    expect(plan.changes).toEqual([{kind: "renameColumn", column: "title", to: "heading"}]);
    expect(sql(plan)).toBe('ALTER TABLE bucket."bucket_67a1" RENAME COLUMN "title" TO "heading"');
  });

  it("becomes drop + add when there is NO hint — that data loss is why the intent has to come from above", async () => {
    const plan = await manager.plan(
      table([{name: "title", kind: "text"}]),
      table([{name: "heading", kind: "text"}])
    );
    expect(plan.changes.map(c => c.kind).sort()).toEqual(["addColumn", "dropColumn"]);
  });

  it("a type change under the same name after a rename is detected too", async () => {
    const plan = await manager.plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "hits", kind: "number"}]),
      {renames: [{from: "views", to: "hits"}]}
    );
    expect(plan.changes.map(c => c.kind)).toEqual(["renameColumn", "changeColumnType"]);
    expect(plan.requiresRewrite).toBe(true);
  });
});

describe("plan — type change", () => {
  it("produces ALTER COLUMN TYPE ... USING and marks a rewrite", async () => {
    const plan = await manager.plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}])
    );
    expect(plan.changes[0].kind).toBe("changeColumnType");
    expect(sql(plan)).toContain('ALTER COLUMN "views" TYPE double precision USING');
    expect(plan.requiresRewrite).toBe(true);
  });

  it("produces no change when the type is the same", async () => {
    const plan = await manager.plan(
      table([{name: "views", kind: "number"}]),
      table([{name: "views", kind: "number"}])
    );
    expect(plan.changes).toEqual([]);
    expect(plan.statements).toEqual([]);
  });

  /**
   * The branch production actually uses (`postgres-adapter`'s `alignCollection` passes
   * `clearOnTypeChange: true`) and the one that had no test at all. Measured flat at ~1 ms from 1k to
   * 1M rows, so it neither rewrites nor deserves a warning.
   */
  it("clearOnTypeChange drops and re-adds, and that is NOT a rewrite", async () => {
    const plan = await manager.plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}]),
      {clearOnTypeChange: true}
    );
    expect(plan.changes[0].kind).toBe("changeColumnType");
    expect(sql(plan)).toBe(
      'ALTER TABLE bucket."bucket_67a1" DROP COLUMN "views" | ' +
        'ALTER TABLE bucket."bucket_67a1" ADD COLUMN "views" double precision'
    );
    expect(plan.requiresRewrite).toBe(false);
    expect(plan.longRunning).toBe(false);
  });

  it("clearOnTypeChange reads no row estimate — there is nothing to decide", async () => {
    let queries = 0;
    const db = {
      query: async () => {
        queries++;
        return {rows: [], rowCount: 0};
      }
    };
    const counting = new PostgresSchemaManager(db, {transaction: async (w: any) => w(db)});
    await counting.plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}]),
      {
        clearOnTypeChange: true
      }
    );
    expect(queries).toBe(0);
  });
});

describe("plan — long running threshold", () => {
  it("a rewrite below the threshold is not long running", async () => {
    const plan = await withEstimate(10_000).plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}])
    );
    expect(plan.requiresRewrite).toBe(true);
    expect(plan.estimatedRows).toBe(10_000);
    expect(plan.longRunning).toBe(false);
  });

  it("a rewrite above the threshold is long running", async () => {
    const plan = await withEstimate(1_000_000).plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}])
    );
    expect(plan.estimatedRows).toBe(1_000_000);
    expect(plan.longRunning).toBe(true);
  });

  it("the threshold is configurable", async () => {
    const plan = await withEstimate(10_000, 1_000).plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}])
    );
    expect(plan.longRunning).toBe(true);
  });

  /**
   * An unreadable estimate counts as large: the cost of a needless dialog is a dialog, the cost of the
   * missing one is an unexplained multi-second write freeze.
   */
  it("an unknown row count counts as long running", async () => {
    const plan = await manager.plan(
      table([{name: "views", kind: "text"}]),
      table([{name: "views", kind: "number"}])
    );
    expect(plan.estimatedRows).toBeUndefined();
    expect(plan.longRunning).toBe(true);
  });

  it("a plan with no type change is never long running", async () => {
    const plan = await withEstimate(1_000_000).plan(
      table([]),
      table([{name: "title", kind: "text"}])
    );
    expect(plan.requiresRewrite).toBe(false);
    expect(plan.longRunning).toBe(false);
    expect(plan.estimatedRows).toBeUndefined();
  });
});

describe("plan — ordering", () => {
  it("renames come first and drops last", async () => {
    const plan = await manager.plan(
      table([
        {name: "old_name", kind: "text"},
        {name: "dropped", kind: "text"}
      ]),
      table([
        {name: "new_name", kind: "text"},
        {name: "added", kind: "number"}
      ]),
      {renames: [{from: "old_name", to: "new_name"}]}
    );
    const kinds = plan.changes.map(c => c.kind);
    expect(kinds.indexOf("renameColumn")).toBe(0);
    expect(kinds.indexOf("dropColumn")).toBe(kinds.length - 1);
  });

  it("does nothing when an empty plan is applied", async () => {
    const plan = await manager.plan(table([]), table([]));
    await expect(manager.apply(plan)).resolves.toBeUndefined();
  });
});
