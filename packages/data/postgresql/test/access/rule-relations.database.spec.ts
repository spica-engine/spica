import {hash} from "@spica-server/core-encryption";
import {HASH_SECRET, usePostgresAccessStore} from "../contract/access-store";

const alice = "0192f3a0-0000-7000-8000-0000000000c1";
const bruce = "0192f3a0-0000-7000-8000-0000000000c2";

const allPosts = ["byAnn", "byBob", "noAuthor"];

describe("relation paths against rows in PostgreSQL", () => {
  const store = usePostgresAccessStore();

  /*
   * Three kinds of document:
   *   third  "ceo"                       the boss of ann
   *   other  "ann" (boss ceo), "bob"     the authors
   *   main   posts, each pointing at its author and its editors
   */
  beforeAll(async () => {
    await store.reset();
    await store.insert({ceo: {title: "ceo", rank: 1}}, "third");
    await store.insert(
      {
        ann: {
          name: "ann",
          level: 3,
          joined: "2024-03-01T00:00:00Z",
          pin: hash("1234", HASH_SECRET),
          tags: ["x"],
          boss: "ceo"
        },
        bob: {name: "bob", level: 1, joined: "2022-01-01T00:00:00Z"}
      },
      "other"
    );
    await store.insert({
      byAnn: {author: "ann", editors: ["ann", "bob"]},
      byBob: {author: "bob", editors: ["bob"], owner: bruce},
      noAuthor: {}
    });
  });

  describe("a field of the author", () => {
    it("should let through the posts whose author matches", async () => {
      expect(await store.select("document.author.name == 'ann'")).toEqual(["byAnn"]);
    });

    it("should let through a post without an author when the comparison is !=", async () => {
      expect(await store.select("document.author.name != 'ann'")).toEqual(["byBob", "noAuthor"]);
    });

    it("should let through a post without an author when the comparison is negated", async () => {
      expect(await store.select("!(document.author.level > 1)")).toEqual(["byBob", "noAuthor"]);
    });

    it("should use the author twice without joining it twice", async () => {
      const rule = "document.author.name == 'ann' || document.author.level == 1";

      expect(await store.select(rule)).toEqual(["byAnn", "byBob"]);
    });

    it.each([
      ["document.author.level > 1", ["byAnn"]],
      ["has(document.author.name)", ["byAnn", "byBob"]],
      ["document.author.joined > '2023-01-01T00:00:00Z'", ["byAnn"]],
      ["document.author.pin == '1234'", ["byAnn"]],
      ["some(document.author.tags, ['x'])", ["byAnn"]]
    ])("%s lets through %j", async (rule, expected) => {
      expect(await store.select(rule)).toEqual(expected);
    });
  });

  describe("through more than one relation", () => {
    it("should reach the boss of the author", async () => {
      expect(await store.select("document.author.boss.title == 'ceo'")).toEqual(["byAnn"]);
    });

    it("should read a relation of the author as its key", async () => {
      expect(await store.select("document.author.boss == null")).toEqual(["byBob", "noAuthor"]);
    });
  });

  describe("the key of a related document", () => {
    it("should compare the relation field with the key of the author", async () => {
      const auth = {id: store.idOf("ann")};

      expect(await store.select("document.author == auth.id", auth)).toEqual(["byAnn"]);
      expect(await store.select("document.author.id == auth.id", auth)).toEqual(["byAnn"]);
    });
  });

  describe("combined with another condition", () => {
    it("should let through the posts both sides let through", async () => {
      const rule = "document.author.name == 'bob' && document.owner != auth.id";

      expect(await store.select(rule, {id: alice})).toEqual(["byBob"]);
    });

    it("should leave the relation out of the query when the other side decides", async () => {
      expect(await store.select("document.author.name == 'ann' || true")).toEqual(allPosts);
    });
  });

  describe("a list of related documents", () => {
    it("should look for the key of a related document", async () => {
      const auth = {id: store.idOf("bob")};

      expect(await store.select("some(document.editors.id, [auth.id])", auth)).toEqual([
        "byAnn",
        "byBob"
      ]);
      expect(await store.select("equal(document.editors.id, [auth.id])", auth)).toEqual(["byBob"]);
    });

    it("should look at a field of the related documents", async () => {
      expect(await store.select("some(document.editors.name, ['ann'])")).toEqual(["byAnn"]);
      expect(await store.select("every(document.editors.name, ['ann', 'bob'])")).toEqual(["byAnn"]);
    });

    it("should count the related documents", async () => {
      expect(await store.select("length(document.editors) == 2")).toEqual(["byAnn"]);
    });
  });
});
