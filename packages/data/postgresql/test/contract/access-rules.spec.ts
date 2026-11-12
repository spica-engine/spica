import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite, keyFieldOf} from "@spica-server/database-testing";
import {AccessStore, createAccessStore} from "./access-store";

const alice = "0192f3a0-0000-7000-8000-0000000000c1";
const bruce = "0192f3a0-0000-7000-8000-0000000000c2";

/**
 * The rules here have to answer the same on every engine. They come from the existing specs and the
 * admin panel, plus one or more per built-in function.
 */
contractSuite("access rules", engine => {
  const principal = keyFieldOf(engine);
  let module: TestingModule;
  let store: AccessStore;

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [engine.module()]}).compile();
    await module.init();
    store = await createAccessStore(engine, module);
  }, 120_000);

  afterAll(() => module.close());

  describe("comparing the fields of a document", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha", age: 30},
        bob: {title: "beta", age: 20},
        cem: {},
        dee: {title: "alpha", age: 25}
      })
    );

    it("should let through the documents the comparison holds for", async () => {
      expect(await store.select("document.age > 24")).toEqual(["ann", "dee"]);
    });

    it("should let through a document without the field when the comparison is negated", async () => {
      expect(await store.select("!(document.age > 24)")).toEqual(["bob", "cem"]);
    });

    it.each([
      ["document.title != 'alpha'", ["bob", "cem"]],
      ["document.age >= 25 && document.title == 'alpha'", ["ann", "dee"]],
      ["document.title == 'beta' || document.age > 29", ["ann", "bob"]],
      [
        "document.age > 24 ? document.title == 'alpha' : document.title == 'beta'",
        ["ann", "bob", "dee"]
      ]
    ])("%s lets through %j", async (rule, expected) => {
      expect(await store.select(rule)).toEqual(expected);
    });
  });

  describe("depending on who asks", () => {
    beforeAll(() =>
      store.replace({
        ann: {owner: alice},
        bob: {owner: bruce},
        cem: {},
        dee: {owner: alice}
      })
    );

    it("should let through the documents the caller owns", async () => {
      expect(
        await store.select(`document.owner == auth.${principal}`, {[principal]: alice})
      ).toEqual(["ann", "dee"]);
    });

    it("should decide a rule that depends on the caller only", async () => {
      const admin = await store.select("auth.role == 'admin'", {role: "admin"});
      const user = await store.select("auth.role == 'admin'", {role: "user"});

      expect([admin, user]).toEqual([["ann", "bob", "cem", "dee"], []]);
    });

    describe.each([
      ["an admin", {[principal]: alice, role: "admin"}, ["ann", "bob", "cem", "dee"]],
      ["a user", {[principal]: alice, role: "user"}, ["ann", "dee"]]
    ])("when the rule also lets admins through, for %s", (_, auth, expected) => {
      it("should let through what they are allowed to", async () => {
        const rule = `document.owner == auth.${principal} || auth.role == 'admin'`;

        expect(await store.select(rule, auth)).toEqual(expected);
      });
    });

    it.each([
      [`document.owner != auth.${principal}`, {[principal]: alice}, ["bob", "cem"]],
      ["auth.identifier != 'noop'", {identifier: "someone"}, ["ann", "bob", "cem", "dee"]],
      ["auth.identifier != 'noop'", {identifier: "noop"}, []]
    ])("%s lets through %j for %j", async (rule, auth, expected) => {
      expect(await store.select(rule, auth)).toEqual(expected);
    });
  });

  describe("lists", () => {
    beforeAll(() =>
      store.replace({
        ann: {tags: ["a", "b"]},
        bob: {tags: ["b"]},
        cem: {tags: []},
        dee: {tags: []}
      })
    );

    it("should let through the documents that have any of the values", async () => {
      expect(await store.select("some(document.tags, ['b', 'z'])")).toEqual(["ann", "bob"]);
    });

    it("should let through the documents that have all of the values", async () => {
      expect(await store.select("every(document.tags, ['a', 'b'])")).toEqual(["ann"]);
    });

    it("should let through the documents that have exactly the values", async () => {
      expect(await store.select("equal(document.tags, ['b'])")).toEqual(["bob"]);
    });

    it.each([
      ["some(document.tags, ['a'])", ["ann"]],
      ["every(document.tags, ['b'])", ["ann", "bob"]],
      ["equal(document.tags, [])", ["cem", "dee"]],
      ["length(document.tags) == 2", ["ann"]],
      ["length(document.tags) > 0", ["ann", "bob"]]
    ])("%s lets through %j", async (rule, expected) => {
      expect(await store.select(rule)).toEqual(expected);
    });
  });

  describe("functions on a field", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha"},
        bob: {title: "beta"},
        cem: {},
        dee: {title: "alpha"}
      })
    );

    it("should tell whether the field has a value", async () => {
      expect(await store.select("has(document.title)")).toEqual(["ann", "bob", "dee"]);
    });

    it("should let through the documents that lack the value when has() is negated", async () => {
      expect(await store.select("!(has(document.title))")).toEqual(["cem"]);
    });

    it("should match a field against a regular expression", async () => {
      expect(await store.select('regex(document.title, "^al")')).toEqual(["ann", "dee"]);
    });
  });
});
