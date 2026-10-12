import {describe, expect, it} from "@jest/globals";
import {Binary, Decimal128, Long, ObjectId} from "bson";
import {Bucket} from "@spica-server/interface-bucket";
import {createCodec, tag, untag} from "@spica-server/database-postgres";

const BUCKET_ID = "67a1f0000000000000000001";
const TARGET_ID = "67b3000000000000000000b3";

function bucket(properties: Record<string, any>): Bucket {
  return {
    _id: BUCKET_ID as any,
    title: "Test",
    description: "",
    primary: "title",
    acl: {read: "true==true", write: "true==true"},
    properties
  } as Bucket;
}

/** The losslessness criterion: document → row → document, identical to what we started with. */
function roundTrip(properties: Record<string, any>, document: Record<string, any>) {
  const codec = createCodec(bucket(properties));
  const {row} = codec.toRow(document);
  return {row, back: codec.toDocument(row)};
}

describe("codec — losslessness", () => {
  it("_id: ObjectId → char(24) hex → ObjectId", () => {
    const id = new ObjectId();
    const {row, back} = roundTrip({title: {type: "string"}}, {_id: id, title: "a"});
    expect(row._id).toBe(id.toHexString());
    expect(typeof row._id).toBe("string");
    expect(back._id).toBeInstanceOf(ObjectId);
    expect(back._id.toHexString()).toBe(id.toHexString());
  });

  it.each([
    ["string", "merhaba"],
    ["textarea", "long\ntext"],
    ["richtext", "<p>x</p>"],
    ["color", "#ff0000"],
    ["hash", "$2b$10$abc"],
    ["storage", "507f1f77bcf86cd799439011"],
    ["number", 42.5],
    ["boolean", true]
  ])("a %s goes out and comes back unchanged", (type, value) => {
    const {row, back} = roundTrip({f: {type}}, {f: value});
    expect(row.f).toEqual(value);
    expect(back.f).toEqual(value);
  });

  it("date: Date → Date (milliseconds preserved)", () => {
    const at = new Date("2026-01-01T00:00:00.123Z");
    const {row, back} = roundTrip({at: {type: "date"}}, {at});
    expect(row.at).toBeInstanceOf(Date);
    expect(back.at.getTime()).toBe(at.getTime());
  });

  it("relation onetoone: ObjectId → hex → ObjectId", () => {
    const author = new ObjectId();
    const {row, back} = roundTrip(
      {author: {type: "relation", relationType: "onetoone", bucketId: TARGET_ID}},
      {author}
    );
    expect(row.author).toBe(author.toHexString());
    expect(back.author).toBeInstanceOf(ObjectId);
    expect(back.author.toHexString()).toBe(author.toHexString());
  });

  /**
   * `onetomany` is an **id array column** (`char(24)[]`), not a junction table. The rationale is in
   * `bucketToTable`: a junction table cannot carry the difference between "the field was never written"
   * and "the field was emptied", a nullable array column can.
   */
  it("relation onetomany: goes out and comes back as a hex array column", () => {
    const a = new ObjectId();
    const b = new ObjectId();
    const {row, back} = roundTrip(
      {authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}},
      {authors: [a, b]}
    );

    expect(row.authors).toEqual([a.toHexString(), b.toHexString()]);
    expect(back.authors.map((id: ObjectId) => id.toHexString())).toEqual([
      a.toHexString(),
      b.toHexString()
    ]);
  });

  it("relation onetomany: the order is preserved", () => {
    const ids = [new ObjectId(), new ObjectId(), new ObjectId()];
    const {row} = roundTrip(
      {authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}},
      {authors: ids}
    );
    expect(row.authors).toEqual(ids.map(i => i.toHexString()));
  });

  /** The distinction itself: `NULL` → no field, `{}` → an empty array. */
  it("relation onetomany: an empty array and a field never written are distinct", () => {
    const properties = {
      authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}
    };
    expect(roundTrip(properties, {authors: []}).back.authors).toEqual([]);
    expect(roundTrip(properties, {}).back).not.toHaveProperty("authors");
  });

  it("multiselect: goes out and comes back as a native array", () => {
    const {row, back} = roundTrip({tags: {type: "multiselect"}}, {tags: ["a", "b"]});
    expect(row.tags).toEqual(["a", "b"]);
    expect(back.tags).toEqual(["a", "b"]);
  });

  it("an array of scalars: a native array", () => {
    const {row, back} = roundTrip(
      {tags: {type: "array", items: {type: "string"}}},
      {tags: ["x", "y"]}
    );
    expect(row.tags).toEqual(["x", "y"]);
    expect(back.tags).toEqual(["x", "y"]);
  });

  it("a date array: jsonb, but comes back as Date because the schema drives it", () => {
    const dates = [new Date("2026-01-01T00:00:00.000Z"), new Date("2026-06-01T12:00:00.000Z")];
    const {back} = roundTrip({ds: {type: "array", items: {type: "date"}}}, {ds: dates});
    expect(back.ds.every((d: any) => d instanceof Date)).toBe(true);
    expect(back.ds.map((d: Date) => d.getTime())).toEqual(dates.map(d => d.getTime()));
  });

  it("location: GeoJSON as it is", () => {
    const point = {type: "Point", coordinates: [29.0, 41.0]};
    const {row, back} = roundTrip({loc: {type: "location", locationType: "Point"}}, {loc: point});
    expect(row.loc).toEqual(point);
    expect(back.loc).toEqual(point);
  });

  it("encrypted: a Buffer, as bytea", () => {
    const secret = Buffer.from("gizli");
    const {row} = roundTrip({s: {type: "encrypted"}}, {s: secret});
    expect(Buffer.isBuffer(row.s)).toBe(true);
    expect((row.s as Buffer).toString()).toBe("gizli");
  });

  /**
   * `null` is written but **not read back** — a deliberate difference between a relational row and a
   * document.
   *
   * In a relational table every column exists; in a document store a field that is absent is not
   * visible at all. Giving the column back as `null` handed `{title: "x", at: null}` to a caller
   * expecting `{title: "x"}` and broke every read comparison (this is what broke the `passport/identity`
   * PG leg).
   *
   * **A declared limit:** in a document store `{a: null}` and `{}` are different things (`$exists` tells
   * them apart); in a relational column both are `NULL`. Both `$exists` uses in the codebase put
   * `$ne: null` next to it, so that distinction is not used in practice.
   */
  it("null is written but does not come back as a field", () => {
    const {row, back} = roundTrip(
      {title: {type: "string"}, at: {type: "date"}},
      {title: null, at: null}
    );
    expect(row.title).toBeNull();
    expect(row.at).toBeNull();
    expect("at" in back).toBe(false);
    expect("title" in back).toBe(false);
  });

  it("undefined fields are never written to the row", () => {
    const {row} = roundTrip({a: {type: "string"}, b: {type: "string"}}, {a: "x"});
    expect("b" in row).toBe(false);
  });
});

describe("codec — multiple languages", () => {
  it("translatable text: the language map is preserved", () => {
    const value = {tr_TR: "Merhaba", en_US: "Hello"};
    const {row, back} = roundTrip(
      {title: {type: "string", options: {translate: true}}},
      {title: value}
    );
    expect(row.title).toEqual(value);
    expect(back.title).toEqual(value);
  });

  it("a translatable date: every language's value comes back as a Date", () => {
    const at = new Date("2026-03-03T03:03:03.003Z");
    const {back} = roundTrip(
      {at: {type: "date", options: {translate: true}}},
      {at: {tr_TR: at, en_US: at}}
    );
    expect(back.at.tr_TR).toBeInstanceOf(Date);
    expect(back.at.tr_TR.getTime()).toBe(at.getTime());
  });
});

describe("codec — schema-driven object (NO tagging)", () => {
  it("an inner date field is not tagged because the schema knows it", () => {
    const at = new Date("2026-02-02T02:02:02.002Z");
    const {row, back} = roundTrip(
      {meta: {type: "object", properties: {at: {type: "date"}, note: {type: "string"}}}},
      {meta: {at, note: "n"}}
    );
    // NO tag inside the jsonb — it stays readable and queryable
    expect((row.meta as any).at).toBeInstanceOf(Date);
    expect(JSON.stringify(row.meta)).not.toContain("$date");
    expect(back.meta.at).toBeInstanceOf(Date);
    expect(back.meta.at.getTime()).toBe(at.getTime());
  });

  it("an inner relation field goes down to hex and comes back as an ObjectId", () => {
    const ref = new ObjectId();
    const {row, back} = roundTrip(
      {
        meta: {
          type: "object",
          properties: {ref: {type: "relation", relationType: "onetoone", bucketId: TARGET_ID}}
        }
      },
      {meta: {ref}}
    );
    expect((row.meta as any).ref).toBe(ref.toHexString());
    expect(back.meta.ref).toBeInstanceOf(ObjectId);
  });

  it("a key that is not in the schema is carried through as it is", () => {
    const {back} = roundTrip(
      {meta: {type: "object", properties: {a: {type: "string"}}}},
      {meta: {a: "x", fazladan: 1}}
    );
    expect(back.meta).toEqual({a: "x", fazladan: 1});
  });
});

describe("codec — schemaless json (tagging IS used)", () => {
  it("a Date is tagged and comes back", () => {
    const at = new Date("2026-04-04T04:04:04.004Z");
    const {row, back} = roundTrip({free: {type: "json"}}, {free: {at}});
    expect((row.free as any).at).toEqual({$date: at.getTime()});
    expect(back.free.at).toBeInstanceOf(Date);
    expect(back.free.at.getTime()).toBe(at.getTime());
  });

  it("an ObjectId is tagged", () => {
    const id = new ObjectId();
    const {row, back} = roundTrip({free: {type: "json"}}, {free: {id}});
    expect((row.free as any).id).toEqual({$oid: id.toHexString()});
    expect(back.free.id).toBeInstanceOf(ObjectId);
  });

  it("a Long above 2^53 does not lose precision", () => {
    const big = Long.fromString("9007199254740993");
    const {row, back} = roundTrip({free: {type: "json"}}, {free: {big}});
    expect((row.free as any).big).toEqual({$numberLong: "9007199254740993"});
    expect(back.free.big.toString()).toBe("9007199254740993");
  });

  it("Decimal128 does not lose precision", () => {
    const dec = Decimal128.fromString("123456789.123456789012345");
    const {back} = roundTrip({free: {type: "json"}}, {free: {dec}});
    expect(back.free.dec.toString()).toBe("123456789.123456789012345");
  });

  it("Binary and Buffer go out and come back as base64", () => {
    const {back} = roundTrip(
      {free: {type: "json"}},
      {free: {bin: new Binary(Buffer.from("data")), buf: Buffer.from("other")}}
    );
    expect(back.free.bin.toString()).toBe("data");
    expect(back.free.buf.toString()).toBe("other");
  });

  it("works in nested structures too", () => {
    const at = new Date("2026-05-05T05:05:05.005Z");
    const {back} = roundTrip({free: {type: "json"}}, {free: {a: {b: [{c: at}]}}});
    expect(back.free.a.b[0].c.getTime()).toBe(at.getTime());
  });

  it("plain JSON values are left untouched", () => {
    const plain = {s: "x", n: 1, b: true, arr: [1, 2], o: {k: "v"}, nil: null};
    const {row, back} = roundTrip({free: {type: "json"}}, {free: plain});
    expect(row.free).toEqual(plain);
    expect(back.free).toEqual(plain);
  });

  it("an object with a single key that is NOT a tag is not corrupted", () => {
    const {back} = roundTrip({free: {type: "json"}}, {free: {onlyOne: "value"}});
    expect(back.free).toEqual({onlyOne: "value"});
  });
});

describe("tag / untag", () => {
  it("the tag → untag unit conversion", () => {
    const at = new Date();
    const id = new ObjectId();
    const source = {at, id, nested: {big: Long.fromString("9007199254740993")}};
    const restored = untag(tag(source));
    expect(restored.at.getTime()).toBe(at.getTime());
    expect(restored.id.toHexString()).toBe(id.toHexString());
    expect(restored.nested.big.toString()).toBe("9007199254740993");
  });
});
