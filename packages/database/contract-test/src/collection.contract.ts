import {afterAll, beforeEach, describe, expect, it} from "@jest/globals";
import {ContractHarness} from "./harness.js";

interface Doc {
  _id?: any;
  title?: string;
  views?: number;
  tags?: string[];
}

/**
 * The `ICollection` contract test (K-2).
 *
 * The rule: every assertion corresponds to a **written promise** of the contract — not to some incidental
 * behaviour of Mongo. If an assertion does not pass on Mongo, the contract is wrong, not the test.
 *
 * This package is made green against Mongo in Phase 1; Phase 4's first goal is to pass the same suite on
 * PostgreSQL. The proof that the two backends behave alike is here, not in the individual module tests.
 */
export function describeCollectionContract(createHarness: () => Promise<ContractHarness>) {
  let harness: ContractHarness;
  let counter = 0;

  const fresh = async (options?: {entryLimit?: number}) => {
    counter++;
    return harness.open<Doc>(`contract_${Date.now()}_${counter}`, options);
  };

  describe("the ICollection contract", () => {
    beforeEach(async () => {
      if (!harness) harness = await createHarness();
    });

    afterAll(async () => {
      if (harness) await harness.teardown();
    });

    describe("ids and id assignment", () => {
      it("name returns the collection's name", async () => {
        const coll = await harness.open<Doc>("contract_name_check");
        expect(coll.name).toBe("contract_name_check");
      });

      it("insertOne gives the document back with an _id assigned", async () => {
        const coll = await fresh();
        const inserted = await coll.insertOne({title: "a"});
        expect(inserted._id).toBeDefined();
        expect(inserted.title).toBe("a");
      });

      it("insertOne preserves the given _id", async () => {
        const coll = await fresh();
        const first = await coll.insertOne({title: "a"});
        const found = await coll.findOne({_id: first._id});
        expect(found._id.toString()).toBe(first._id.toString());
      });

      /**
       * A bare id as a filter — the MongoDB driver's documented convenience
       * (`operations/find.js`: "special case passing in an ObjectId as a filter"), and two call sites
       * rely on it: `GET /passport/policy/:id` and `bucket-hooks`' collection-slug factory. It is part
       * of the contract because a driver that does not do it produces an unreadable error far from the
       * cause, not a clear rejection.
       */
      it("findOne accepts a bare id in place of a filter", async () => {
        const coll = await fresh();
        const inserted = await coll.insertOne({title: "a"});
        const found = await coll.findOne(inserted._id);
        expect(found.title).toBe("a");
      });

      it("find accepts a bare id in place of a filter", async () => {
        const coll = await fresh();
        const inserted = await coll.insertOne({title: "a"});
        await coll.insertOne({title: "b"});
        const found = await coll.find(inserted._id);
        expect(found.map(doc => doc.title)).toEqual(["a"]);
      });

      it("insertMany returns the list of inserted ids", async () => {
        const coll = await fresh();
        const ids = await coll.insertMany([{title: "a"}, {title: "b"}, {title: "c"}]);
        expect(ids).toHaveLength(3);
        expect(ids.every(id => !!id)).toBe(true);
      });

      it("insertMany returns the ids in input order", async () => {
        const coll = await fresh();
        const ids = await coll.insertMany([{title: "a"}, {title: "b"}, {title: "c"}]);
        const stored = await coll.find(undefined, {sort: {_id: 1}});

        expect(ids.map(String)).toEqual(stored.map(doc => String(doc._id)));
      });

      /**
       * Documents need not have the same fields. On PostgreSQL that decides the column list of the statement
       * the driver emits, so a mixed batch exercises a different path from a uniform one (D20) — while the
       * caller must not be able to tell.
       */
      it("insertMany accepts documents with different fields", async () => {
        const coll = await fresh();
        const ids = await coll.insertMany([
          {title: "a", views: 1},
          {title: "b"},
          {title: "c", views: 3},
          {title: "d"}
        ]);

        expect(ids).toHaveLength(4);
        const stored = await coll.find(undefined, {sort: {_id: 1}});
        expect(stored.map(doc => doc.title)).toEqual(["a", "b", "c", "d"]);
        expect(stored.map(doc => doc.views)).toEqual([1, undefined, 3, undefined]);
      });

      /**
       * `insertMany` is **ordered**: the documents before the offending one stay written, the offending one
       * raises, and nothing after it is attempted. On PostgreSQL the fast path is a single multi-row
       * statement — which is all-or-nothing — so this is the assertion that keeps the optimisation honest
       * (D20).
       */
      it("insertMany keeps the documents written before a failure", async () => {
        const coll = await fresh();
        const shared = (await coll.insertOne({title: "taken"}))._id;

        await expect(
          coll.insertMany([{title: "first"}, {_id: shared, title: "clash"} as any, {title: "last"}])
        ).rejects.toThrow();

        const titles = (await coll.find()).map(doc => doc.title);
        expect(titles).toContain("first");
        expect(titles).not.toContain("last");
      });
    });

    describe("reads", () => {
      it("find returns an ARRAY, not a cursor", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "b"}]);
        const result = await coll.find();
        expect(Array.isArray(result)).toBe(true);
        expect(result).toHaveLength(2);
      });

      it("find applies the filter", async () => {
        const coll = await fresh();
        await coll.insertMany([{views: 1}, {views: 10}, {views: 100}]);
        const result = await coll.find({views: {$gt: 5}});
        expect(result).toHaveLength(2);
      });

      it("find applies limit and skip", async () => {
        const coll = await fresh();
        await coll.insertMany([{views: 1}, {views: 2}, {views: 3}, {views: 4}]);
        const result = await coll.find({}, {limit: 2, skip: 1});
        expect(result).toHaveLength(2);
      });

      it("findOne returns an empty value when there is no match", async () => {
        const coll = await fresh();
        const found = await coll.findOne({title: "none"});
        expect(found == null).toBe(true);
      });

      it("estimatedDocumentCount returns the approximate count", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "b"}]);
        expect(await coll.estimatedDocumentCount()).toBe(2);
      });

      it("countDocuments returns the exact count without a filter", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "b"}, {title: "c"}]);
        expect(await coll.countDocuments()).toBe(3);
      });

      it("countDocuments applies the filter", async () => {
        const coll = await fresh();
        await coll.insertMany([{views: 1}, {views: 10}, {views: 100}]);
        expect(await coll.countDocuments({views: {$gt: 5}})).toBe(2);
      });

      it("countDocuments returns zero when there is no match", async () => {
        const coll = await fresh();
        expect(await coll.countDocuments({title: "none"})).toBe(0);
      });
    });

    describe("writes — the methods that return a number", () => {
      it("updateOne returns the MODIFIED COUNT, not a result object", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "a"}]);
        const modified = await coll.updateOne({title: "a"}, {$set: {title: "b"}});
        expect(modified).toBe(1);
      });

      it("updateMany returns the modified count", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "a"}, {title: "c"}]);
        expect(await coll.updateMany({title: "a"}, {$set: {title: "b"}})).toBe(2);
      });

      it("replaceOne returns the modified count", async () => {
        const coll = await fresh();
        const doc = await coll.insertOne({title: "a"});
        expect(await coll.replaceOne({_id: doc._id}, {title: "b"})).toBe(1);
      });

      it("deleteOne returns the deleted count", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "a"}]);
        expect(await coll.deleteOne({title: "a"})).toBe(1);
      });

      it("deleteMany returns the deleted count", async () => {
        const coll = await fresh();
        await coll.insertMany([{title: "a"}, {title: "a"}, {title: "c"}]);
        expect(await coll.deleteMany({title: "a"})).toBe(2);
      });

      it("returns zero when there is no match and does not raise", async () => {
        const coll = await fresh();
        expect(await coll.deleteMany({title: "none"})).toBe(0);
        expect(await coll.updateMany({title: "none"}, {$set: {title: "x"}})).toBe(0);
      });
    });

    describe("read-and-write", () => {
      it("findOneAndUpdate returns the document", async () => {
        const coll = await fresh();
        const doc = await coll.insertOne({title: "a"});
        const result = await coll.findOneAndUpdate({_id: doc._id}, {$set: {title: "b"}});
        expect(result).toBeTruthy();
        expect(result._id.toString()).toBe(doc._id.toString());
      });

      it("findOneAndReplace returns the document", async () => {
        const coll = await fresh();
        const doc = await coll.insertOne({title: "a"});
        const result = await coll.findOneAndReplace({_id: doc._id}, {title: "b"});
        expect(result).toBeTruthy();
      });

      it("findOneAndDelete returns the deleted one and the document is gone", async () => {
        const coll = await fresh();
        const doc = await coll.insertOne({title: "a"});
        const result = await coll.findOneAndDelete({_id: doc._id});
        expect(result).toBeTruthy();
        expect(await coll.estimatedDocumentCount()).toBe(0);
      });
    });

    describe("the document count limit", () => {
      it("a write is rejected once entryLimit is exceeded", async () => {
        const coll = await fresh({entryLimit: 2});
        await coll.insertMany([{title: "a"}, {title: "b"}]);
        await expect(coll.insertOne({title: "c"})).rejects.toThrow();
      });

      it("getStatus returns limit/current/unit", async () => {
        const coll = await fresh({entryLimit: 5});
        await coll.insertOne({title: "a"});
        const status = await coll.getStatus();
        expect(status.limit).toBe(5);
        expect(status.current).toBe(1);
        expect(status.unit).toBe("count");
      });
    });

    describe("indexes", () => {
      it("createIndex returns the index name", async () => {
        const coll = await fresh();
        // PostgreSQL derives the name with Mongo's own convention rather than reporting nothing.
        await expect(coll.createIndex({views: 1})).resolves.toBe("views_1");
      });

      /**
       * The returned promise has to mean "the index is in place". The Mongo driver used to call
       * `createIndex` and discard the promise, so every `afterInit` — all of which are written as
       * `Promise.all([...createIndex...])` — reported itself finished while the collection was still
       * accepting what the index forbids (R128).
       */
      it("a unique index is enforced as soon as createIndex resolves", async () => {
        const coll = await fresh();
        await coll.createIndex({title: 1}, {unique: true});
        await coll.insertOne({title: "only-once"});
        await expect(coll.insertOne({title: "only-once"})).rejects.toThrow();
      });

      /**
       * TTL **has to be accepted by both drivers** — the feature is the same, the mechanism differs.
       *
       * In my first version this test required a driver with `nativeTTLIndex: false` to **reject**
       * `upsertTTLIndex` (R21). That was the wrong requirement: the capability flag describes the mechanism
       * (a TTL index on Mongo, a sweeper on PostgreSQL), not whether the feature exists. Requiring a
       * rejection treated the seven call sites that use TTL blowing up at startup on PostgreSQL as "correct
       * behaviour".
       *
       * The real difference the flag still declares is **timing**: with a sweeper the deletion is periodic,
       * not immediate. So the test verifies that the call is accepted and idempotent rather than that the
       * deletion *happens*; the sweeper's own behaviour is measured in `postgres.spec.ts`.
       *
       * A note on the precondition: on Mongo `listIndexes()` gives `ns does not exist` on a collection that
       * does not exist, so the suite populates the collection first.
       */
      it("upsertTTLIndex is accepted by both drivers", async () => {
        const coll = await fresh();
        await coll.insertOne({title: "ttl"});
        await expect(coll.upsertTTLIndex(60)).resolves.not.toThrow();
      });

      it("upsertTTLIndex is idempotent — the duration can be changed", async () => {
        const coll = await fresh();
        await coll.insertOne({title: "ttl-idempotent"});
        await coll.upsertTTLIndex(60);
        await expect(coll.upsertTTLIndex(120)).resolves.not.toThrow();
      });
    });

    describe("navigation", () => {
      it("collection() gives another ICollection on the same database", async () => {
        const coll = await fresh();
        const other = coll.collection("contract_sibling");
        expect(other).toBeTruthy();
        expect(typeof other.find).toBe("function");
        expect(other.name).toBe("contract_sibling");
      });
    });
  });
}
