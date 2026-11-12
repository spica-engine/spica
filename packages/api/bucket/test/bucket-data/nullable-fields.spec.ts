import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: null values", engine => {
  const postgres = engine.name == "postgresql";
  let api: BucketApp;
  let bucketId: string;
  let ownerId: string;

  beforeEach(async () => {
    api = await startBucketApp(engine, {}, {rejectOnError: false});
    const owners = await api.createBucket({name: {type: "string", title: "name", options: {}}});
    const owner = await api.req.post(`/bucket/${idOf(owners)}/data`, {name: "ann"});
    ownerId = owner.body[api.keyField];

    const bucket = await api.createBucket(
      {
        req: {type: "string", title: "req", options: {}},
        title: {type: "string", title: "title", options: {}},
        label: {type: "string", title: "label", default: "n/a", options: {}},
        qty: {type: "number", title: "qty", options: {}},
        due: {type: "date", title: "due", options: {}},
        status: {type: "string", title: "status", enum: ["draft", "live"], options: {}},
        tags: {type: "array", title: "tags", items: {type: "string", title: "tag"}, options: {}},
        meta: {
          type: "object",
          title: "meta",
          properties: {note: {type: "string", title: "note", options: {}}},
          options: {}
        },
        payload: {type: "json", title: "payload", options: {}},
        owner: {
          type: "relation",
          title: "owner",
          bucketId: idOf(owners),
          relationType: "onetoone",
          options: {}
        }
      },
      {required: ["req"]}
    );
    bucketId = idOf(bucket);
  });

  afterEach(() => api.close());

  const insert = (document: object) => api.req.post(`/bucket/${bucketId}/data`, document);
  const read = async (key: string) =>
    (await api.req.get(`/bucket/${bucketId}/data/${key}`)).body as Record<string, any>;
  const patch = (key: string, change: object) =>
    api.req.patch(`/bucket/${bucketId}/data/${key}`, change);
  const replace = (key: string, document: object) =>
    api.req.put(`/bucket/${bucketId}/data/${key}`, document);
  const full = () => ({
    req: "a",
    title: "t",
    qty: 1,
    due: "2026-01-01T00:00:00.000Z",
    status: "live",
    tags: ["x"],
    meta: {note: "n"},
    payload: {a: 1, b: {c: 2}},
    owner: ownerId
  });
  const created = async (document: object) => {
    const response = await insert(document);
    expect(response.statusCode).toBe(201);
    return response.body[api.keyField] as string;
  };

  if (postgres) {
    describe("on PostgreSQL", () => {
      describe("post", () => {
        it("should store null for optional fields and read it back", async () => {
          const key = await created({
            req: "a",
            title: null,
            qty: null,
            due: null,
            status: null,
            owner: null,
            payload: null
          });

          expect(await read(key)).toMatchObject({
            req: "a",
            title: null,
            qty: null,
            due: null,
            status: null,
            owner: null,
            payload: null
          });
        });

        it("should store null for a field that is missing", async () => {
          const key = await created({req: "a"});

          expect(await read(key)).toMatchObject({title: null, qty: null, due: null, owner: null});
        });

        it("should use the default for a missing field and keep an explicit null", async () => {
          const missing = await created({req: "a"});
          const explicit = await created({req: "a", label: null});

          expect((await read(missing)).label).toBe("n/a");
          expect((await read(explicit)).label).toBeNull();
        });

        it("should still reject null for a required field", async () => {
          const response = await insert({req: null});

          expect(response.statusCode).toBe(400);
          expect(response.body.message).toBe(".req must be string");
        });

        it("should still reject a value that is not in the enum", async () => {
          const response = await insert({req: "a", status: "gone"});

          expect(response.statusCode).toBe(400);
        });

        it("should still validate the format of a value that is not null", async () => {
          const response = await insert({req: "a", due: "yesterday"});

          expect(response.statusCode).toBe(400);
        });
      });

      describe("put", () => {
        it("should clear fields sent as null", async () => {
          const key = await created(full());

          const response = await replace(key, {req: "a", title: null, qty: null, due: null});

          expect(response.statusCode).toBe(200);
          expect(await read(key)).toMatchObject({title: null, qty: null, due: null, owner: null});
        });

        it("should accept the document it read", async () => {
          const key = await created({req: "a"});
          const document = await read(key);

          const response = await replace(key, document);

          expect(response.statusCode).toBe(200);
          expect(await read(key)).toEqual(document);
        });

        it("should still reject null for a required field", async () => {
          const key = await created(full());

          const response = await replace(key, {req: null});

          expect(response.statusCode).toBe(400);
        });
      });

      describe("patch", () => {
        it("should change one field of a row that has unset fields", async () => {
          const key = await created({req: "a"});

          const response = await patch(key, {title: "x"});

          expect(response.statusCode).toBe(200);
          expect(await read(key)).toMatchObject({title: "x", qty: null, due: null});
        });

        it("should set a field that was unset", async () => {
          const key = await created({req: "a"});

          await patch(key, {qty: 5});

          expect((await read(key)).qty).toBe(5);
        });

        it("should clear a column field sent as null without dropping the column", async () => {
          const key = await created(full());

          const response = await patch(key, {title: null, qty: null, due: null, owner: null});

          expect(response.statusCode).toBe(200);
          expect(await read(key)).toMatchObject({
            title: null,
            qty: null,
            due: null,
            owner: null,
            status: "live"
          });
          expect(Object.keys(await read(key))).toEqual(expect.arrayContaining(["title", "qty"]));
        });

        it("should clear a nested field of an object", async () => {
          const key = await created(full());

          await patch(key, {meta: {note: null}});

          expect((await read(key)).meta.note ?? null).toBeNull();
        });

        it("should clear an array sent as null", async () => {
          const key = await created(full());

          await patch(key, {tags: null});

          expect((await read(key)).tags).toEqual([]);
        });

        it("should apply merge patch inside a json field", async () => {
          const key = await created(full());

          await patch(key, {payload: {a: null, z: 9}});

          expect((await read(key)).payload).toEqual({b: {c: 2}, z: 9});
        });

        it("should store null for a json field sent as null", async () => {
          const key = await created(full());

          await patch(key, {payload: null});

          expect((await read(key)).payload).toBeNull();
        });

        it("should still reject null for a required field", async () => {
          const key = await created(full());

          const response = await patch(key, {req: null});

          expect(response.statusCode).toBe(400);
          expect(response.body.message).toBe(" must have required property 'req'");
        });
      });
    });
  } else {
    describe("on MongoDB", () => {
      it("should still reject null for an optional field", async () => {
        const response = await insert({req: "a", title: null});

        expect(response.statusCode).toBe(400);
        expect(response.body.message).toBe(".title must be string");
      });

      it("should still leave a missing field out", async () => {
        const key = await created({req: "a"});

        expect(await read(key)).not.toHaveProperty("title");
      });

      it("should still remove a field patched to null", async () => {
        const key = await created(full());

        await patch(key, {title: null});

        expect(await read(key)).not.toHaveProperty("title");
      });
    });
  }
});
