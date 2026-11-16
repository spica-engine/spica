import {sortUnorderedArrays} from "../src/unordered";

describe("sortUnorderedArrays", () => {
  it("returns the input untouched when there are no paths", () => {
    const data = {a: [2, 1]};
    expect(sortUnorderedArrays(data, [])).toBe(data);
  });

  it("sorts only the arrays at the listed paths", () => {
    const data = {required: ["b", "a"], enum: ["y", "x"]};
    expect(sortUnorderedArrays(data, ["required"])).toEqual({
      required: ["a", "b"],
      enum: ["y", "x"]
    });
  });

  it("does not mutate its input", () => {
    const data = {required: ["b", "a"]};
    sortUnorderedArrays(data, ["required"]);
    expect(data.required).toEqual(["b", "a"]);
  });

  it("matches one key with * and any depth with **", () => {
    const data = {
      properties: {
        a: {required: ["z", "y"]},
        b: {properties: {c: {required: ["q", "p"]}}}
      },
      other: {required: ["n", "m"]}
    };
    expect(sortUnorderedArrays(data, ["properties.**.required"])).toEqual({
      properties: {
        a: {required: ["y", "z"]},
        b: {properties: {c: {required: ["p", "q"]}}}
      },
      other: {required: ["n", "m"]}
    });
  });

  it("matches array indexes with *", () => {
    const data = {statement: [{include: ["2", "1"]}, {include: ["4", "3"]}]};
    expect(sortUnorderedArrays(data, ["statement.*.include"])).toEqual({
      statement: [{include: ["1", "2"]}, {include: ["3", "4"]}]
    });
  });

  it("orders object items independently of their key order", () => {
    const a = sortUnorderedArrays(
      {
        l: [
          {x: 1, y: 2},
          {x: 0, y: 5}
        ]
      },
      ["l"]
    );
    const b = sortUnorderedArrays(
      {
        l: [
          {y: 5, x: 0},
          {y: 2, x: 1}
        ]
      },
      ["l"]
    );
    expect(a).toEqual(b);
  });

  it("sorts inner arrays before the arrays that contain them", () => {
    const a = sortUnorderedArrays({s: [{i: ["2", "1"]}, {i: ["0"]}]}, ["s", "s.*.i"]);
    const b = sortUnorderedArrays({s: [{i: ["0"]}, {i: ["1", "2"]}]}, ["s", "s.*.i"]);
    expect(a).toEqual(b);
  });

  it("keeps different contents different", () => {
    const a = sortUnorderedArrays({l: ["a", "b"]}, ["l"]);
    const b = sortUnorderedArrays({l: ["a", "c"]}, ["l"]);
    expect(a).not.toEqual(b);
  });

  it("leaves a non-array at a listed path alone", () => {
    const data = {properties: {required: {type: "string"}}};
    expect(sortUnorderedArrays(data, ["properties.**.required"])).toEqual(data);
  });
});
