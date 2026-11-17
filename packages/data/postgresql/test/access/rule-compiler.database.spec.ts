import {hash} from "@spica-server/core-encryption";
import {ENGINE_KEY_FIELDS} from "@spica-server/database-testing";
import {HASH_SECRET, usePostgresAccessStore} from "../contract/access-store";

const alice = "0192f3a0-0000-7000-8000-0000000000c1";
const bruce = "0192f3a0-0000-7000-8000-0000000000c2";

const everyone = ["ann", "bob", "cem", "dee"];

describe("compileRule against rows in PostgreSQL", () => {
  const store = usePostgresAccessStore();

  describe("comparing a field", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha", age: 30, active: true},
        bob: {title: "beta", age: 20, active: false},
        cem: {},
        dee: {title: "alpha", age: 25, active: true}
      })
    );

    it("should let through the rows the comparison holds for", async () => {
      expect(await store.select("document.title == 'alpha'")).toEqual(["ann", "dee"]);
    });

    it("should let through a row without a value when the comparison is !=", async () => {
      expect(await store.select("document.title != 'alpha'")).toEqual(["bob", "cem"]);
    });

    it("should read a field without a value as null", async () => {
      expect(await store.select("document.title == null")).toEqual(["cem"]);
      expect(await store.select("document.title != null")).toEqual(["ann", "bob", "dee"]);
    });

    it("should let through a row without a value when the comparison is negated", async () => {
      expect(await store.select("!(document.age > 24)")).toEqual(["bob", "cem"]);
    });

    it.each([
      ["document.age > 24", ["ann", "dee"]],
      ["document.active", ["ann", "dee"]],
      ["!(document.active == true)", ["bob", "cem"]],
      ["document.age > 24 && document.active", ["ann", "dee"]]
    ])("%s lets through %j", async (rule, expected) => {
      expect(await store.select(rule)).toEqual(expected);
    });
  });

  describe("membership", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha", count: 5, created: "2024-01-01T00:00:00.000Z"},
        bob: {title: "beta", count: 10},
        cem: {},
        dee: {title: "gamma", count: 5}
      })
    );

    it.each([
      [`document.title in ["alpha", "gamma"]`, ["ann", "dee"]],
      [`document.title in ["nope"]`, []],
      [`document.title in []`, []],
      [`document.count in [5, 7]`, ["ann", "dee"]],
      [`document.title in [null]`, ["cem"]],
      [`!(document.title in ["alpha"])`, ["bob", "cem", "dee"]],
      [`document.title in ["alpha", "beta"] && document.count > 5`, ["bob"]],
      [`document.created in ["2024-01-01T00:00:00.000Z"]`, ["ann"]]
    ])("%s lets through %j", async (rule, expected) => {
      expect(await store.select(rule)).toEqual(expected);
    });
  });

  describe("comparing a field with a value of another type", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha", count: 5, big: "9007199254740993", owner: alice},
        bob: {title: "beta", count: 10, big: "5", owner: bruce},
        cem: {}
      })
    );

    it("should keep the precision of a bigint written as a string", async () => {
      expect(await store.select("document.big == '9007199254740993'")).toEqual(["ann"]);
    });

    it("should compare numbers of different widths", async () => {
      expect(await store.select("document.big > document.count")).toEqual(["ann"]);
    });

    it("should compare a uuid with text as text, and two missing values as equal", async () => {
      expect(await store.select("document.owner == document.title")).toEqual(["cem"]);
    });
  });

  describe("values the rule writes as text", () => {
    beforeAll(() =>
      store.replace({
        ann: {
          created: "2024-06-01T00:00:00Z",
          password: hash("pw", HASH_SECRET),
          address: {city: "Ankara"}
        },
        bob: {created: "2023-01-01T00:00:00Z", address: {city: "Izmir"}},
        cem: {}
      })
    );

    it("should read a date string as a date", async () => {
      expect(await store.select("document.created > '2024-01-01T00:00:00.000Z'")).toEqual(["ann"]);
    });

    it("should hash a string compared with a hash field", async () => {
      expect(await store.select("document.password == 'pw'")).toEqual(["ann"]);
    });

    it("should reach a field of an object", async () => {
      expect(await store.select("document.address.city == 'Ankara'")).toEqual(["ann"]);
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

    it("should let through the rows the caller owns", async () => {
      expect(await store.select("document.owner == auth.id", {id: alice})).toEqual(["ann", "dee"]);
    });

    it("should not read the caller's key under the MongoDB name", async () => {
      const mongoName = ["auth", ENGINE_KEY_FIELDS.mongodb].join(".");

      expect(await store.select(`document.owner == ${mongoName}`, {id: alice})).toEqual(["cem"]);
    });

    it("should let through the rows without an owner when the caller has no id", async () => {
      expect(await store.select("document.owner == auth.id", {})).toEqual(["cem"]);
    });

    it("should let through everything for an admin, and the caller's rows for a user", async () => {
      const rule = "document.owner == auth.id || auth.role == 'admin'";

      expect(await store.select(rule, {id: alice, role: "admin"})).toEqual(everyone);
      expect(await store.select(rule, {id: alice, role: "user"})).toEqual(["ann", "dee"]);
    });

    describe("when the caller's id cannot be an id of the field", () => {
      const auth = {id: "not-a-uuid"};

      it("should let nothing through for ==", async () => {
        expect(await store.select("document.owner == auth.id", auth)).toEqual([]);
      });

      it("should let everything through for !=", async () => {
        expect(await store.select("document.owner != auth.id", auth)).toEqual(everyone);
      });
    });
  });

  describe("arithmetic and conditions", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha", age: 30, count: 5, active: true},
        bob: {title: "beta", age: 20, count: 10, active: false},
        cem: {},
        dee: {title: "alpha", age: 25, count: 0, active: true}
      })
    );

    it("should take the remainder of a whole number", async () => {
      expect(await store.select("document.count % 2 == 0")).toEqual(["bob", "dee"]);
    });

    it("should divide without rounding to a whole number", async () => {
      expect(await store.select("document.count / 2 > 2")).toEqual(["ann", "bob"]);
    });

    it("should multiply fields of different types", async () => {
      expect(await store.select("document.count * 3 > document.age")).toEqual(["bob"]);
    });

    it("should not fail the query when a row divides by zero", async () => {
      expect(await store.select("document.count / document.count > 0")).toEqual(["ann", "bob"]);
    });

    it("should choose the branch of a conditional by the row", async () => {
      const rule = "document.count > 1 ? document.active : document.title == 'alpha'";

      expect(await store.select(rule)).toEqual(["ann", "dee"]);
    });

    it("should leave out of the query a side that cannot change the answer", async () => {
      expect(await store.select("document.count == 1 || true")).toEqual(everyone);
    });

    it("should let nothing through for a rule that is always false", async () => {
      expect(await store.select("true==false")).toEqual([]);
    });
  });
});
