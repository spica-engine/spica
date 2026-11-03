import {
  compileRule,
  InvalidRuleError,
  loadRelatedBuckets,
  relationAlias,
  UnsupportedRuleError
} from "@spica-server/data-postgresql";
import {hash} from "@spica-server/core-encryption";
import {
  bucketId,
  findBucket,
  otherId,
  otherMetadata,
  relatedFor,
  ruleBucket,
  ruleMetadata,
  thirdId,
  uuid
} from "./rule-fixtures";

async function compile(rule: string, auth: unknown = {}, hashSecret?: string) {
  const values: unknown[] = [];
  const related = await relatedFor(rule);
  const {sql, joins} = compileRule(
    rule,
    {bucket: ruleBucket, metadata: ruleMetadata, auth, hashSecret, table: "t", related},
    values
  );
  return {sql, joins, values};
}

const author = relationAlias(["author"]);
const boss = relationAlias(["author", "boss"]);

const authorJoin = `LEFT JOIN "bucket_${otherId}" AS "${author}" ON "${author}"."id" = "t"."author"`;
const bossJoin = `LEFT JOIN "bucket_${thirdId}" AS "${boss}" ON "${boss}"."id" = "${author}"."boss"`;

const otherTags = otherMetadata.tables.find(table => table.path.join(".") == "tags")!.name;

const tableOf = (path: string) =>
  ruleMetadata.tables.find(table => table.path.join(".") == path)!.name;

describe("relation paths in rules", () => {
  describe("one to one", () => {
    it("should use the key column when the path ends at the key of the related bucket", async () => {
      expect(await compile("document.author.id == auth.x", {x: uuid})).toEqual({
        sql: '"t"."author" = $1::uuid',
        joins: [],
        values: [uuid]
      });
    });

    it("should join the related bucket for any other field", async () => {
      expect(await compile("document.author.name == 'ann'")).toEqual({
        sql: `"${author}"."name" = $1::text`,
        joins: [authorJoin],
        values: ["ann"]
      });
    });

    it("should join through every hop, in order", async () => {
      expect(await compile("document.author.boss.title == 'ceo'")).toEqual({
        sql: `"${boss}"."title" = $1::text`,
        joins: [authorJoin, bossJoin],
        values: ["ceo"]
      });
    });

    it("should stop at the key column of the last hop", async () => {
      expect(await compile("document.author.boss.id == auth.x", {x: uuid})).toEqual({
        sql: `"${author}"."boss" = $1::uuid`,
        joins: [authorJoin],
        values: [uuid]
      });
    });

    it("should read a relation of the related bucket as its key", async () => {
      expect(await compile("document.author.boss == null")).toEqual({
        sql: `"${author}"."boss" IS NULL`,
        joins: [authorJoin],
        values: []
      });
    });

    it("should join a bucket once however many fields use it", async () => {
      const compiled = await compile("document.author.name == 'a' || document.author.level > 1");
      expect(compiled.joins).toEqual([authorJoin]);
      expect(compiled.sql).toBe(
        `("${author}"."name" = $1::text OR "${author}"."level" > $2::bigint)`
      );
    });

    it("should leave out a join that folding made unnecessary", async () => {
      expect((await compile("document.author.name == 'a' || true")).joins).toEqual([]);
      expect((await compile("false && document.author.boss.title == 'a'")).joins).toEqual([]);
      expect((await compile("document.author.boss.title == 'a' && true")).joins).toEqual([
        authorJoin,
        bossJoin
      ]);
    });

    it("should convert values by the field of the related bucket", async () => {
      expect(await compile("document.author.joined > '2024-01-01T00:00:00.000Z'")).toMatchObject({
        sql: `"${author}"."joined" > $1::timestamptz`,
        values: [new Date("2024-01-01T00:00:00.000Z")]
      });
      expect((await compile("document.author.pin == 'p'", {}, "s")).values).toEqual([
        hash("p", "s")
      ]);
    });

    it("should read lists of the related bucket", async () => {
      const compiled = await compile("some(document.author.tags, ['x'])");
      expect(compiled.joins).toEqual([authorJoin]);
      expect(compiled.sql).toBe(
        `EXISTS (SELECT 1 FROM "${otherTags}" AS "_a1" WHERE "_a1"."_parent" = "${author}"."id" AND "_a1"."_value" = ANY($1::text[]))`
      );
    });

    it("should give a different join to a different path to the same bucket", async () => {
      expect(relationAlias(["author"])).not.toBe(relationAlias(["editor"]));
      expect(relationAlias(["author"])).toBe(relationAlias(["author"]));
      expect(relationAlias(["a".repeat(500)]).length).toBeLessThan(40);
    });
  });

  describe("one to many", () => {
    it("should read the key of the related bucket from the link table", async () => {
      expect(await compile("some(document.editors.id, [auth.x])", {x: uuid})).toEqual({
        sql: `EXISTS (SELECT 1 FROM "${tableOf("editors")}" AS "_a1" WHERE "_a1"."_parent" = "t"."id" AND "_a1"."_target" = ANY($1::uuid[]))`,
        joins: [],
        values: [[uuid]]
      });
    });

    it("should look at a field of the related bucket inside the EXISTS", async () => {
      expect(await compile("some(document.editors.name, ['ann'])")).toEqual({
        sql: `EXISTS (SELECT 1 FROM "${tableOf("editors")}" AS "_a1" JOIN "bucket_${otherId}" AS "_a1_t" ON "_a1_t"."id" = "_a1"."_target" WHERE "_a1"."_parent" = "t"."id" AND "_a1_t"."name" = ANY($1::text[]))`,
        joins: [],
        values: [["ann"]]
      });
    });

    it("should count and test the linked rows", async () => {
      expect((await compile("length(document.editors) > 1")).sql).toBe(
        `(SELECT COUNT(*) FROM "${tableOf("editors")}" AS "_a1" WHERE "_a1"."_parent" = "t"."id") > $1::bigint`
      );
      expect((await compile("has(document.editors)")).sql).toContain("EXISTS");
    });

    it("should refuse to compare a field of a list of related records", async () => {
      await expect(compile("document.editors.name == 'x'")).rejects.toThrow(UnsupportedRuleError);
      await expect(compile("document.editors.name == 'x'")).rejects.toThrow("is a list");
    });

    it("should refuse a relation of the related bucket", async () => {
      await expect(compile("some(document.editors.boss, [auth.x])", {x: uuid})).rejects.toThrow(
        UnsupportedRuleError
      );
      // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
      await expect(compile("some(document.editors.secret, ['x'])")).rejects.toThrow(
        UnsupportedRuleError
      );
    });
  });

  describe("refusals", () => {
    it("should refuse a field the related bucket does not have", async () => {
      await expect(compile("document.author.nope == 1")).rejects.toThrow(InvalidRuleError);
      await expect(compile("document.title.x == 1")).rejects.toThrow(InvalidRuleError);
    });

    // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
    it("should refuse encrypted and list fields of the related bucket", async () => {
      await expect(compile("document.author.secret == 'x'")).rejects.toThrow(UnsupportedRuleError);
      await expect(compile("document.author.tags == 'x'")).rejects.toThrow("is a list");
    });

    it("should refuse a related bucket that was not loaded", () => {
      expect(() =>
        compileRule(
          "document.author.name == 'x'",
          {bucket: ruleBucket, metadata: ruleMetadata, auth: {}},
          []
        )
      ).toThrow(`The related bucket "${otherId}" is not available`);
    });

    it("should refuse a related bucket that no longer exists", async () => {
      const related = await loadRelatedBuckets(
        {bucket: ruleBucket, metadata: ruleMetadata, bucketId},
        "document.author.name == 'x'",
        async () => undefined
      );
      expect(() =>
        compileRule(
          "document.author.name == 'x'",
          {bucket: ruleBucket, metadata: ruleMetadata, auth: {}, related},
          []
        )
      ).toThrow(UnsupportedRuleError);
    });
  });

  describe("loadRelatedBuckets", () => {
    const own = {bucket: ruleBucket, metadata: ruleMetadata, bucketId};

    it("should load only the buckets the rule reaches", async () => {
      const find = jest.fn(findBucket);
      const related = await loadRelatedBuckets(own, "document.author.name == 'x'", find);

      expect(related(otherId)?.bucket.title).toBe("Other");
      expect(related(thirdId)).toBeUndefined();
      expect(find).toHaveBeenCalledWith(otherId);
    });

    it("should follow every hop, also from inside functions and a conditional", async () => {
      const find = jest.fn(findBucket);
      const related = await loadRelatedBuckets(
        own,
        "auth.admin ? true : has(document.author.boss.title)",
        find
      );
      expect(related(thirdId)?.bucket.title).toBe("Third");
    });

    it("should not load anything for a rule without relations or a rule that does not parse", async () => {
      const find = jest.fn(findBucket);
      await loadRelatedBuckets(own, "document.title == 'x'", find);
      await loadRelatedBuckets(own, "document.title ==", find);
      await loadRelatedBuckets(own, "auth.author.name == 'x'", find);
      expect(find).not.toHaveBeenCalled();
    });

    it("should load a bucket once", async () => {
      const find = jest.fn(findBucket);
      await loadRelatedBuckets(
        own,
        "document.author.name == 'x' || document.author.level > 1",
        find
      );
      expect(find.mock.calls.filter(([id]) => id == otherId)).toHaveLength(1);
    });

    it("should answer for the bucket itself", async () => {
      const related = await loadRelatedBuckets(own, "true==true", findBucket);
      expect(related(bucketId)?.bucket).toBe(ruleBucket);
    });
  });
});
