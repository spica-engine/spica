import {defineEntity} from "../src/entity.js";
import {fromRow, insertSql, updateSql} from "../src/sql.js";

describe("column codec", () => {
  const pairs = {
    encode: (value: Record<string, number>) => Object.entries(value),
    decode: (value: [string, number][]) => Object.fromEntries(value)
  };

  const items = defineEntity({
    table: "items",
    columns: {
      name: {type: "text"},
      definition: {type: "jsonb", codec: pairs}
    }
  });

  it("encodes the value before it is serialized for insert", () => {
    expect(insertSql(items, {name: "a", definition: {b: 1, a: -1}}).values).toEqual([
      "a",
      JSON.stringify([
        ["b", 1],
        ["a", -1]
      ])
    ]);
  });

  it("encodes the value before it is serialized for update", () => {
    expect(updateSql(items, {id: "1"}, {definition: {z: 1}}, "after").values).toContain(
      JSON.stringify([["z", 1]])
    );
  });

  it("decodes the value when a row is read", () => {
    expect(
      fromRow(items, {
        name: "a",
        definition: [
          ["b", 1],
          ["a", -1]
        ]
      })
    ).toEqual({name: "a", definition: {b: 1, a: -1}});
  });

  it("does not decode null or missing columns", () => {
    expect(fromRow(items, {name: "a", definition: null})).toEqual({name: "a"});
  });

  it("leaves columns without a codec untouched", () => {
    expect(fromRow(items, {name: "a"})).toEqual({name: "a"});
  });
});
