import {prefilterOf} from "../../src/realtime/prefilter.js";

const bucket = {
  properties: {
    id: {type: "uuid"},
    owner: {type: "string"},
    title: {type: "string", options: {translate: true}},
    secret: {type: "hash"},
    age: {type: "number"},
    done: {type: "boolean"},
    born: {type: "date"},
    address: {type: "object", properties: {city: {type: "string"}}}
  }
} as any;

const cannotMatch = (rule: string, document: object, auth?: unknown, rules = [rule]) =>
  prefilterOf(bucket, rules, auth)!(document as any);

describe("prefilterOf", () => {
  describe("what it rules out", () => {
    it("should rule out a document whose field differs from a literal", () => {
      expect(cannotMatch(`document.owner == "alice"`, {owner: "bob"})).toBe(true);
    });

    it("should rule out a document whose field differs from the user", () => {
      expect(cannotMatch(`document.owner == auth._id`, {owner: "bob"}, {_id: "alice"})).toBe(true);
    });

    it("should read a field named without document", () => {
      expect(cannotMatch(`owner == "alice"`, {owner: "bob"})).toBe(true);
    });

    it("should rule out with every comparison on numbers", () => {
      expect(cannotMatch(`document.age > 20`, {age: 10})).toBe(true);
      expect(cannotMatch(`document.age >= 20`, {age: 19})).toBe(true);
      expect(cannotMatch(`document.age < 20`, {age: 20})).toBe(true);
      expect(cannotMatch(`document.age <= 20`, {age: 21})).toBe(true);
      expect(cannotMatch(`document.age != 20`, {age: 20})).toBe(true);
    });

    it("should rule out on a boolean field", () => {
      expect(cannotMatch(`document.done == true`, {done: false})).toBe(true);
    });

    it("should rule out when one side of an and is false", () => {
      expect(
        cannotMatch(`document.owner == "alice" && document.age > 1`, {owner: "bob", age: 5})
      ).toBe(true);
      expect(
        cannotMatch(`document.age > 1 && document.owner == "alice"`, {owner: "bob", age: 5})
      ).toBe(true);
    });

    it("should rule out when both sides of an or are false", () => {
      expect(
        cannotMatch(`document.owner == "alice" || document.age > 50`, {owner: "bob", age: 5})
      ).toBe(true);
    });

    it("should rule out a negation of a true statement", () => {
      expect(cannotMatch(`!(document.owner == "bob")`, {owner: "bob"})).toBe(true);
    });

    it("should rule out a value that is not in a list", () => {
      expect(cannotMatch(`document.owner in ["alice", "carol"]`, {owner: "bob"})).toBe(true);
    });

    it("should follow a conditional", () => {
      expect(
        cannotMatch(`document.done == true ? document.age > 10 : document.age < 5`, {
          done: true,
          age: 1
        })
      ).toBe(true);
    });

    it("should rule out when any of several rules is false", () => {
      const rules = [`document.age > 1`, `document.owner == auth._id`];
      expect(cannotMatch("", {age: 5, owner: "bob"}, {_id: "alice"}, rules)).toBe(true);
    });
  });

  describe("what it leaves to the database", () => {
    it.each([
      ["a document that matches", `document.owner == "bob"`, {owner: "bob"}],
      [
        "an or with one side unknown",
        `document.owner == "alice" || document.born > 1`,
        {owner: "bob"}
      ],
      [
        "an and with every side true",
        `document.owner == "bob" && document.age > 1`,
        {owner: "bob", age: 5}
      ],
      [
        "a conditional it cannot decide",
        `document.born > 1 ? document.age > 1 : document.age > 2`,
        {age: 0}
      ],
      ["a negation of an unknown", `!(document.born > 1)`, {}]
    ])("should keep %s", (_name, rule, document) => {
      expect(cannotMatch(rule, document)).toBe(false);
    });

    it.each([
      ["a missing field", `document.owner == "alice"`, {}],
      ["a null field", `document.owner == "alice"`, {owner: null}],
      ["a field of another type than its property", `document.owner == "alice"`, {owner: 5}],
      [
        "a uuid, which the database compares without regard to case",
        `document.id == "ABC"`,
        {id: "abc"}
      ],
      ["a date", `document.born == "2020-01-01"`, {born: "2020-01-02"}],
      ["a hash, which is compared by its hash", `document.secret == "x"`, {secret: "y"}],
      ["a translated field", `document.title == "x"`, {title: "y"}],
      ["a nested field", `document.address.city == "Bonn"`, {address: {city: "Paris"}}],
      ["a string against a number", `document.owner == 5`, {owner: "5"}],
      [
        "an ordering of strings, which depends on the database collation",
        `document.owner > "a"`,
        {owner: "A"}
      ],
      ["a function", `startsWith(document.owner, "a")`, {owner: "bob"}],
      ["arithmetic", `document.age + 1 == 3`, {age: 5}],
      ["the whole document", `document == 1`, {owner: "bob"}],
      ["a list whose items differ in type", `document.owner in ["alice", 1]`, {owner: "bob"}]
    ])("should keep %s", (_name, rule, document) => {
      expect(cannotMatch(rule, document)).toBe(false);
    });

    it("should keep a document when the user lacks the value the rule needs", () => {
      expect(cannotMatch(`document.owner == auth._id`, {owner: "bob"}, {})).toBe(false);
      expect(cannotMatch(`document.owner == auth._id`, {owner: "bob"}, undefined)).toBe(false);
      expect(cannotMatch(`document.owner == auth._id`, {owner: "bob"}, {_id: null})).toBe(false);
      expect(cannotMatch(`document.owner == auth.tags`, {owner: "bob"}, {tags: ["a"]})).toBe(false);
    });

    it("should have nothing to check when a rule cannot be read", () => {
      expect(prefilterOf(bucket, [`document.owner ==`])).toBeUndefined();
    });
  });

  it("should have nothing to check without a rule", () => {
    expect(prefilterOf(bucket, [])).toBeUndefined();
  });
});
