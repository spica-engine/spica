import {diffBuckets} from "@spica-server/bucket-common";

describe("diffBuckets", () => {
  const bucket = (properties: object = {}, extra: object = {}) =>
    ({title: "b", primary: "title", acl: {read: "", write: ""}, properties, ...extra}) as any;

  it("should report nothing for equal definitions", () => {
    const definition = bucket(
      {a: {type: "string"}},
      {indexes: [{definition: {a: 1}, options: {}}]}
    );

    expect(diffBuckets(definition, structuredClone(definition))).toEqual({fields: [], indexes: []});
  });

  it("should ignore keywords that do not change the structure", () => {
    const previous = bucket({a: {type: "string", title: "A", maxLength: 3, readOnly: false}});
    const next = bucket({a: {type: "string", title: "B", maxLength: 10, readOnly: true}});

    expect(diffBuckets(previous, next).fields).toEqual([]);
  });

  it("should report added and removed fields", () => {
    const diff = diffBuckets(
      bucket({gone: {type: "string"}, kept: {type: "number"}}),
      bucket({kept: {type: "number"}, fresh: {type: "boolean"}})
    );

    expect(diff.fields).toEqual([
      {kind: "removed", path: ["gone"], property: {type: "string"}},
      {kind: "added", path: ["fresh"], property: {type: "boolean"}}
    ]);
  });

  it.each(["constructor", "toString", "hasOwnProperty", "__proto__"])(
    "should not mistake the inherited name %s for an existing field",
    name => {
      const property = {type: "string"};
      const withField = bucket(
        Object.defineProperty({}, name, {value: property, enumerable: true})
      );

      expect(diffBuckets(bucket(), withField).fields).toEqual([
        {kind: "added", path: [name], property}
      ]);
      expect(diffBuckets(withField, bucket()).fields).toEqual([
        {kind: "removed", path: [name], property}
      ]);
    }
  );

  it("should report a renamed field as a removal and an addition", () => {
    const diff = diffBuckets(bucket({old: {type: "string"}}), bucket({renamed: {type: "string"}}));

    expect(diff.fields.map(change => [change.kind, change.path])).toEqual([
      ["removed", ["old"]],
      ["added", ["renamed"]]
    ]);
  });

  it("should report a retyped field once, without its children", () => {
    const diff = diffBuckets(
      bucket({a: {type: "object", properties: {b: {type: "string"}}}}),
      bucket({a: {type: "string"}})
    );

    expect(diff.fields).toEqual([
      {
        kind: "retyped",
        path: ["a"],
        previous: {type: "object", properties: {b: {type: "string"}}},
        next: {type: "string"}
      }
    ]);
  });

  it("should report a retyped relation when its target or cardinality changes", () => {
    const relation = (bucketId: string, relationType: string) => ({
      type: "relation",
      bucketId,
      relationType
    });

    const diff = diffBuckets(
      bucket({one: relation("x", "onetoone"), two: relation("x", "onetoone")}),
      bucket({one: relation("y", "onetoone"), two: relation("x", "onetomany")})
    );

    expect(diff.fields.map(change => [change.kind, change.path])).toEqual([
      ["retyped", ["one"]],
      ["retyped", ["two"]]
    ]);
  });

  it("should descend into objects and report nested changes with their path", () => {
    const diff = diffBuckets(
      bucket({a: {type: "object", properties: {b: {type: "string"}, c: {type: "number"}}}}),
      bucket({a: {type: "object", properties: {b: {type: "number"}, d: {type: "number"}}}})
    );

    expect(diff.fields.map(change => [change.kind, change.path])).toEqual([
      ["removed", ["a", "c"]],
      ["retyped", ["a", "b"]],
      ["added", ["a", "d"]]
    ]);
  });

  it("should descend into array items", () => {
    const array = (items: object) => ({type: "array", items});

    const diff = diffBuckets(
      bucket({
        tags: array({type: "string"}),
        rows: array({type: "object", properties: {x: {type: "string"}}})
      }),
      bucket({
        tags: array({type: "number"}),
        rows: array({type: "object", properties: {x: {type: "string"}, y: {type: "string"}}})
      })
    );

    expect(diff.fields.map(change => [change.kind, change.path])).toEqual([
      ["retyped", ["tags", "[]"]],
      ["added", ["rows", "[]", "y"]]
    ]);
  });

  it("should report items that appear, disappear or are tuples", () => {
    const diff = diffBuckets(
      bucket({
        a: {type: "array"},
        b: {type: "array", items: {type: "string"}},
        c: {type: "array", items: [{type: "string"}]}
      }),
      bucket({
        a: {type: "array", items: {type: "string"}},
        b: {type: "array"},
        c: {type: "array", items: [{type: "number"}]}
      })
    );

    expect(diff.fields.map(change => [change.kind, change.path])).toEqual([
      ["added", ["a", "[]"]],
      ["removed", ["b", "[]"]],
      ["retyped", ["c", "[]"]]
    ]);
  });

  it("should report required changes only for fields present on both sides", () => {
    const diff = diffBuckets(
      bucket(
        {a: {type: "string"}, b: {type: "string"}, c: {type: "string"}},
        {required: ["a", "c"]}
      ),
      bucket({a: {type: "string"}, b: {type: "string"}}, {required: ["b"]})
    );

    expect(diff.fields).toEqual([
      {kind: "removed", path: ["c"], property: {type: "string"}},
      {kind: "required", path: ["a"], required: false},
      {kind: "required", path: ["b"], required: true}
    ]);
  });

  it("should report required changes inside objects", () => {
    const object = (required: string[]) => ({
      type: "object",
      required,
      properties: {x: {type: "string"}}
    });

    const diff = diffBuckets(bucket({o: object([])}), bucket({o: object(["x"])}));

    expect(diff.fields).toEqual([{kind: "required", path: ["o", "x"], required: true}]);
  });

  it("should report enum changes", () => {
    const diff = diffBuckets(
      bucket({a: {type: "string", enum: ["x"]}, b: {type: "string"}}),
      bucket({a: {type: "string", enum: ["x", "y"]}, b: {type: "string", enum: ["z"]}})
    );

    expect(diff.fields).toEqual([
      {kind: "enum", path: ["a"], previous: ["x"], next: ["x", "y"]},
      {kind: "enum", path: ["b"], previous: undefined, next: ["z"]}
    ]);
  });

  it("should report translate changes", () => {
    const diff = diffBuckets(
      bucket({a: {type: "string"}, b: {type: "string", options: {translate: true}}}),
      bucket({a: {type: "string", options: {translate: true}}, b: {type: "string", options: {}}})
    );

    expect(diff.fields).toEqual([
      {kind: "translate", path: ["a"], translate: true},
      {kind: "translate", path: ["b"], translate: false}
    ]);
  });

  describe("indexes", () => {
    const withIndexes = (...indexes: object[]) => bucket({a: {type: "string"}}, {indexes});

    it("should report added and removed indexes", () => {
      const keep = {definition: {a: 1}, options: {}};
      const drop = {definition: {b: 1}, options: {}};
      const add = {definition: {c: 1}, options: {unique: true}};

      const diff = diffBuckets(withIndexes(keep, drop), withIndexes(keep, add));

      expect(diff.indexes).toEqual([
        {kind: "removed", index: drop},
        {kind: "added", index: add}
      ]);
    });

    it("should treat a changed direction, key order or option as a new index", () => {
      const base = {definition: {a: 1, b: 1}, options: {}};

      for (const changed of [
        {definition: {a: -1, b: 1}, options: {}},
        {definition: {b: 1, a: 1}, options: {}},
        {definition: {a: 1, b: 1}, options: {unique: true}}
      ]) {
        expect(diffBuckets(withIndexes(base), withIndexes(changed)).indexes).toHaveLength(2);
      }
    });

    it("should not report indexes whose options only differ in key order", () => {
      const first = {definition: {a: 1}, options: {sparse: true, unique: true}};
      const second = {definition: {a: 1}, options: {unique: true, sparse: true}};

      expect(diffBuckets(withIndexes(first), withIndexes(second)).indexes).toEqual([]);
    });

    it("should handle buckets without properties or indexes", () => {
      expect(diffBuckets({title: "b"} as any, {title: "b"} as any)).toEqual({
        fields: [],
        indexes: []
      });
    });
  });
});
