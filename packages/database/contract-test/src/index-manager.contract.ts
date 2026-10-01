import {afterAll, beforeEach, describe, expect, it} from "@jest/globals";
import {IIndexManager} from "@spica-server/database-driver";

/**
 * The `IIndexManager` contract test.
 *
 * Separate from the `ICollection` suite, because index management is a surface independent of a
 * collection (`getIndexManager(db, name)`). In Phase 4 the PostgreSQL driver has to pass the same suite.
 */
/**
 * The fields the suite will index. The harness **has to** provide them.
 *
 * Why they are declared: on the first run the suite used fields such as `a`/`b`/`slug` and it passed on
 * Mongo while breaking on PostgreSQL — because Mongo, being schemaless, does not verify that the indexed
 * field exists, and PG does. A shared suite **must carry no implicit assumption**; it has to write its
 * requirement down.
 */
export const INDEXED_FIELDS = ["views", "title", "tags"] as const;

export interface IndexHarness {
  readonly name: string;
  /**
   * Gives an index manager for an empty collection. The collection has to contain all of
   * `INDEXED_FIELDS` as indexable fields.
   */
  open(collection: string): Promise<{manager: IIndexManager; seed: () => Promise<void>}>;
  teardown(): Promise<void>;
}

export function describeIndexManagerContract(createHarness: () => Promise<IndexHarness>) {
  let harness: IndexHarness;
  let counter = 0;

  describe("the IIndexManager contract", () => {
    beforeEach(async () => {
      if (!harness) harness = await createHarness();
    });

    afterAll(async () => {
      if (harness) await harness.teardown();
    });

    const fresh = async () => {
      counter++;
      const {manager, seed} = await harness.open(`idx_${Date.now()}_${counter}`);
      await seed();
      return manager;
    };

    it("create creates an index under the given name and list sees it", async () => {
      const manager = await fresh();
      await manager.create({keys: [{field: "views", direction: 1}], name: "views_asc"});
      const names = (await manager.list()).map(i => i.name);
      expect(names).toContain("views_asc");
    });

    it("list returns the keys preserving the field order", async () => {
      const manager = await fresh();
      await manager.create({
        keys: [
          {field: "views", direction: 1},
          {field: "title", direction: -1}
        ],
        name: "views_title_compound"
      });
      const index = (await manager.list()).find(i => i.name === "views_title_compound");
      expect(index).toBeTruthy();
      expect(index.keys.map(k => k.field)).toEqual(["views", "title"]);
      expect(index.keys.map(k => k.direction)).toEqual([1, -1]);
    });

    it("the unique option appears in the list output", async () => {
      const manager = await fresh();
      await manager.create(
        {keys: [{field: "title", direction: 1}], name: "title_unique"},
        {unique: true}
      );
      const index = (await manager.list()).find(i => i.name === "title_unique");
      expect(index.unique).toBe(true);
    });

    it("drop removes the index", async () => {
      const manager = await fresh();
      await manager.create({keys: [{field: "views", direction: 1}], name: "to_drop"});
      await manager.drop("to_drop");
      const names = (await manager.list()).map(i => i.name);
      expect(names).not.toContain("to_drop");
    });

    it("dropping an index that does not exist raises", async () => {
      const manager = await fresh();
      await expect(manager.drop("does_not_exist")).rejects.toThrow();
    });
  });
}
