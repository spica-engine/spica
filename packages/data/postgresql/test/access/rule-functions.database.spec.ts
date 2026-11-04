import {usePostgresAccessStore} from "../contract/access-store";

const bruce = "0192f3a0-0000-7000-8000-0000000000c2";

const everyone = ["ann", "bob", "cem", "dee"];

describe("built-in functions against rows in PostgreSQL", () => {
  const store = usePostgresAccessStore();

  describe("lists of text", () => {
    beforeAll(() =>
      store.replace({
        ann: {tags: ["a", "b"]},
        bob: {tags: ["b"]},
        cem: {},
        dee: {}
      })
    );

    it("some() should let through the rows that have any of the values", async () => {
      expect(await store.select("some(document.tags, ['b', 'z'])")).toEqual(["ann", "bob"]);
    });

    it("every() should let through the rows that have all of the values", async () => {
      expect(await store.select("every(document.tags, ['a', 'b'])")).toEqual(["ann"]);
    });

    it("equal() should let through the rows that have exactly the values", async () => {
      expect(await store.select("equal(document.tags, ['b'])")).toEqual(["bob"]);
    });

    it("equal() should read a row without a list as an empty list", async () => {
      expect(await store.select("equal(document.tags, [])")).toEqual(["cem", "dee"]);
    });

    it("should let through the rows without the values when the call is negated", async () => {
      expect(await store.select("!(some(document.tags, ['a']))")).toEqual(["bob", "cem", "dee"]);
    });

    it.each([
      ["some(document.tags, ['z'])", []],
      ["every(document.tags, ['b'])", ["ann", "bob"]],
      ["every(document.tags, ['a', 'z'])", []],
      ["every(document.tags, [])", everyone],
      ["equal(document.tags, ['b', 'a'])", ["ann"]]
    ])("%s lets through %j", async (rule, expected) => {
      expect(await store.select(rule)).toEqual(expected);
    });

    it("should take the values from a list in auth", async () => {
      expect(await store.select("some(document.tags, auth.roles)", {roles: ["z", "a"]})).toEqual([
        "ann"
      ]);
    });
  });

  describe("length and has", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha", tags: ["a", "b"], address: {city: "Ankara"}},
        bob: {title: "beta", tags: ["b"], address: {city: "Izmir"}},
        cem: {},
        dee: {title: "alpha"}
      })
    );

    it("length() should count the values of a list", async () => {
      expect(await store.select("length(document.tags) == 2")).toEqual(["ann"]);
      expect(await store.select("length(document.tags) == 0")).toEqual(["cem", "dee"]);
    });

    it("length() should count the characters of text", async () => {
      expect(await store.select("length(document.title) > 4")).toEqual(["ann", "dee"]);
    });

    it("has() should tell whether a field has a value", async () => {
      expect(await store.select("has(document.title)")).toEqual(["ann", "bob", "dee"]);
      expect(await store.select("!(has(document.title))")).toEqual(["cem"]);
    });

    it("has() should tell whether a list has values, and a field of an object", async () => {
      expect(await store.select("has(document.tags)")).toEqual(["ann", "bob"]);
      expect(await store.select("has(document.address.city)")).toEqual(["ann", "bob"]);
    });
  });

  describe("lists of numbers and json", () => {
    beforeAll(() =>
      store.replace({
        ann: {scores: [1, 2, 3], docs: [{k: 1}, [1, 2]]},
        bob: {}
      })
    );

    it("should look for numbers in a list of numbers", async () => {
      expect(await store.select("some(document.scores, [2, 9])")).toEqual(["ann"]);
      expect(await store.select("every(document.scores, [1, 2, 3])")).toEqual(["ann"]);
    });

    it("should let nothing through for a number the list cannot hold", async () => {
      expect(await store.select("some(document.scores, [3000000000])")).toEqual([]);
    });

    it("should compare the values of a json list as json", async () => {
      expect(await store.select("some(document.docs, [[1, 2]])")).toEqual(["ann"]);
      expect(await store.select("some(document.docs, [[2, 1]])")).toEqual([]);
    });
  });

  describe("regular expressions", () => {
    beforeAll(() =>
      store.replace({
        ann: {title: "alpha"},
        bob: {title: "beta"},
        cem: {},
        dee: {title: "alpha"}
      })
    );

    it("should match the field against the expression", async () => {
      expect(await store.select('regex(document.title, "^al")')).toEqual(["ann", "dee"]);
    });

    it("should be case sensitive unless the i flag is given", async () => {
      expect(await store.select('regex(document.title, "^AL")')).toEqual([]);
      expect(await store.select('regex(document.title, "^AL", "i")')).toEqual(["ann", "dee"]);
    });

    it("should let through the rows without a value when the match is negated", async () => {
      expect(await store.select('!(regex(document.title, "^al"))')).toEqual(["bob", "cem"]);
    });
  });

  describe("combined with another condition", () => {
    beforeAll(() => store.replace({ann: {tags: ["a"]}, bob: {owner: bruce}, cem: {}}));

    it("should let through the rows either side lets through", async () => {
      const rule = "some(document.tags, ['a']) || document.owner == auth._id";

      expect(await store.select(rule, {_id: bruce})).toEqual(["ann", "bob"]);
    });
  });

  describe("time", () => {
    beforeAll(() =>
      store.replace({
        ann: {created: "2024-06-01T00:00:00Z"},
        bob: {created: "2023-01-01T00:00:00Z"},
        cem: {}
      })
    );

    it("unixTime() should give the seconds since the epoch", async () => {
      expect(await store.select("unixTime(document.created) > 1700000000")).toEqual(["ann"]);
    });

    it("now() should be later than a date that has passed", async () => {
      expect(await store.select("unixTime(document.created) < now()")).toEqual(["ann", "bob"]);
    });
  });
});
