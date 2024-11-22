import {ChangeKind, diff} from "@spica/core";

describe("differ", () => {
  it("should return no difference", () => {
    const changes = diff({}, {});
    expect(changes).toEqual([]);
  });

  it("should flatten and diff newly added multi-dimensional array return no-change", () => {
    const changes = diff({}, {test: [[[[]]]]});
    expect(changes.length).toBe(0);
  });

  it("should flatten and diff newly added multi-dimensional array", () => {
    const changes = diff({}, {test: [[[[{test: true}]]]]});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Add,
      path: ["test", 0, 0, 0, 0, "test"],
      patches: [{diffs: [[1, "true"]], start1: 0, start2: 0, length1: 0, length2: 4}]
    });
  });

  it("should flatten and diff newly added array and its item", () => {
    const changes = diff({}, {test: [true, false]});
    expect(changes.length).toBe(2);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Add,
      path: ["test", 1],
      patches: [{diffs: [[1, "false"]], start1: 0, start2: 0, length1: 0, length2: 5}]
    });
    expect(changes[1]).toEqual({
      kind: ChangeKind.Add,
      path: ["test", 0],
      patches: [{diffs: [[1, "true"]], start1: 0, start2: 0, length1: 0, length2: 4}]
    });
  });

  it("should flatten and diff newly added array and its item", () => {
    const changes = diff({}, {tags: [{tagName: "develop"}, {tagName: "engine"}]});
    expect(changes.length).toBe(2);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Add,
      path: ["tags", 1, "tagName"],
      patches: [{diffs: [[1, "engine"]], start1: 0, start2: 0, length1: 0, length2: 6}]
    });
    expect(changes[1]).toEqual({
      kind: ChangeKind.Add,
      path: ["tags", 0, "tagName"],
      patches: [{diffs: [[1, "develop"]], start1: 0, start2: 0, length1: 0, length2: 7}]
    });
  });

  it("should flatten and diff newly added deep object", () => {
    const changes = diff({}, {test: {test: true}});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Add,
      path: ["test", "test"],
      patches: [{diffs: [[1, "true"]], start1: 0, start2: 0, length1: 0, length2: 4}]
    });
  });

  it("should return difference of added item", () => {
    const changes = diff({test: ["item1"]}, {test: ["item"]});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Edit,
      path: ["test", 0],
      patches: [{diffs: [[0, "item"], [-1, "1"]], start1: 0, start2: 0, length1: 5, length2: 4}]
    });
  });

  it("should return difference of removed item", () => {
    const changes = diff({tags: ["item"]}, {tags: []});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Delete,
      path: ["tags", 0]
    });
  });

  it("should return difference of removed and edited item", () => {
    const changes = diff({tags: ["item", "item1"]}, {tags: ["item2"]});
    expect(changes.length).toBe(2);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Delete,
      path: ["tags", 1]
    });
    expect(changes[1]).toEqual({
      kind: ChangeKind.Edit,
      path: ["tags", 0],
      patches: [{diffs: [[0, "item"], [1, "2"]], start1: 0, start2: 0, length1: 4, length2: 5}]
    });
  });

  it("should return difference of edited item", () => {
    const changes = diff({tags: ["item", "item"]}, {tags: ["item1", "item2"]});
    expect(changes.length).toBe(2);
    expect(changes[1]).toEqual({
      kind: ChangeKind.Edit,
      path: ["tags", 0],
      patches: [{diffs: [[0, "item"], [1, "1"]], start1: 0, start2: 0, length1: 4, length2: 5}]
    });
    expect(changes[0]).toEqual({
      kind: ChangeKind.Edit,
      path: ["tags", 1],
      patches: [{diffs: [[0, "item"], [1, "2"]], start1: 0, start2: 0, length1: 4, length2: 5}]
    });
  });

  it("should return difference of edited property", () => {
    const changes = diff({test: "test"}, {test: ""});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Edit,
      path: ["test"],
      patches: [{diffs: [[-1, "test"]], start1: 0, start2: 0, length1: 4, length2: 0}]
    });
  });

  it("should return difference of deleted property", () => {
    const changes = diff({will_be_deleted: "test"}, {});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Delete,
      path: ["will_be_deleted"]
    });
  });

  it("should return difference of added property", () => {
    const changes = diff({}, {added: "test"});
    expect(changes.length).toBe(1);
    expect(changes[0]).toEqual({
      kind: ChangeKind.Add,
      path: ["added"],
      patches: [{diffs: [[1, "test"]], start1: 0, start2: 0, length1: 0, length2: 4}]
    });
  });
});
