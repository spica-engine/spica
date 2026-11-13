import {encrypt} from "@spica-server/core-encryption";
import {fieldTableName} from "@spica-server/data-postgresql";
import {applyPatch} from "@spica-server/core-patch";
import {postgresWriter, uuid} from "./support.js";
import {idOf} from "@spica-server/data";

describe("PostgreSQL bucket write: replace and patch", () => {
  const {createBucket, insert, replace, patch, query, rows, rowsOf} = postgresWriter();

  const properties = {
    title: {type: "string"},
    tags: {type: "array", items: {type: "string"}},
    scores: {type: "array", items: {type: "integer"}},
    label: {type: "string", options: {translate: true}},
    secret: {type: "encrypted"}
  };

  const sealed = (value: string) => encrypt(value, "encryption-secret", "hash-secret");

  const versionsOf = async (bucket: any, path: string) =>
    (await rowsOf(bucket, path)).map(row => `${row._parent}/${row._position ?? row._locale}`);

  const xminsOf = async (bucket: any, path: string) =>
    (
      await query(
        `SELECT xmin::text AS xmin FROM "${fieldTableName(String(idOf(bucket)), path.split("."))}" ORDER BY 1`
      )
    ).rows.map(row => row.xmin);

  describe("replace", () => {
    it("should rewrite the rows of every child table and none of another document", async () => {
      const bucket = await createBucket(properties);
      const first = await insert(bucket, {title: "a", tags: ["x", "y", "z"], scores: [1, 2]});
      const second = await insert(bucket, {title: "b", tags: ["q"]});

      await replace(bucket, {id: first.id, title: "a2", tags: ["n"]});

      expect(
        (await rowsOf(bucket, "tags")).map(row => [row._parent, row._position, row._value])
      ).toEqual([
        [first.id, 0, "n"],
        [second.id, 0, "q"]
      ]);
      expect(await rowsOf(bucket, "scores")).toEqual([]);
    });

    it("should write null for the columns the new document leaves out", async () => {
      const bucket = await createBucket(properties);
      const saved = await insert(bucket, {title: "a", secret: sealed("x")});

      await replace(bucket, {id: saved.id, tags: ["only"]});

      const [row] = await rows(bucket);
      expect(row).toMatchObject({title: null, secret: null, secret__hash: null});
    });

    it("should keep the document and its rows when the replacement is refused", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = (await insert(authors, {name: "ann"})).id;
      const posts = await createBucket({
        title: {type: "string"},
        tags: {type: "array", items: {type: "string"}},
        editors: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetomany"}
      });
      const saved = await insert(posts, {title: "p", tags: ["a", "b"], editors: [ann]});

      await expect(
        replace(posts, {id: saved.id, title: "q", tags: ["c"], editors: [uuid(404)]})
      ).rejects.toThrow();

      expect((await rows(posts))[0].title).toBe("p");
      expect((await rowsOf(posts, "tags")).map(row => row._value)).toEqual(["a", "b"]);
      expect((await rowsOf(posts, "editors")).map(row => row._target)).toEqual([ann]);
    });

    it("should replace a document with an integer key", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "integer", options: {generated: true}}, title: {type: "string"}}}
      );
      const saved = await insert(bucket, {title: "a"});

      const previous = await replace(bucket, {id: saved.id, title: "b"});

      expect(previous).toMatchObject({id: saved.id, title: "a"});
      expect((await rows(bucket))[0].title).toBe("b");
    });

    it("should accept the key as text for an integer key", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "integer", options: {generated: true}}, title: {type: "string"}}}
      );
      const saved = await insert(bucket, {title: "a"});
      const asText = String(saved.id);

      const previous = await replace(bucket, {id: asText, title: "b"});
      const patched = await patch(
        bucket,
        {id: asText, title: "c"},
        {title: "c"},
        {
          returnDocument: "after"
        }
      );

      expect(previous).toMatchObject({id: saved.id, title: "a"});
      expect(patched).toMatchObject({id: saved.id, title: "c"});
    });
  });

  describe("patch", () => {
    const patching = async (bucket: any, saved: any, change: object, options: object = {}) => {
      const merged = {...applyPatch(saved, change), id: saved.id};
      return patch(bucket, merged, change, {returnDocument: "after", ...options});
    };

    it("should leave the rows of a child table the patch does not touch as they are", async () => {
      const bucket = await createBucket(properties);
      const saved = await insert(bucket, {title: "a", tags: ["x", "y"], scores: [1, 2, 3]});
      const before = await xminsOf(bucket, "scores");

      await patching(bucket, saved, {title: "b", tags: ["z"]});

      expect(await xminsOf(bucket, "scores")).toEqual(before);
      expect(await versionsOf(bucket, "tags")).toEqual([`${saved.id}/0`]);
      expect((await rows(bucket))[0].title).toBe("b");
    });

    it("should leave an encrypted value the patch does not touch as it is", async () => {
      const bucket = await createBucket(properties);
      const saved = await insert(bucket, {title: "a", secret: sealed("kept")});
      const [stored] = await rows(bucket);

      await patch(
        bucket,
        {id: saved.id, title: "b", secret: "mangled by validation"},
        {title: "b"},
        {}
      );

      const [now] = await rows(bucket);
      expect(now.title).toBe("b");
      expect(now.secret).toBe(stored.secret);
      expect(now.secret__hash).toBe(stored.secret__hash);
    });

    it("should change an encrypted value and its hash together", async () => {
      const bucket = await createBucket(properties);
      const saved = await insert(bucket, {secret: sealed("old")});
      const next = sealed("new");

      await patch(bucket, {id: saved.id, secret: next}, {secret: "new"}, {});

      const [row] = await rows(bucket);
      expect(JSON.parse(row.secret).encrypted).toBe(next.encrypted);
      expect(row.secret__hash).toBe(next.hash);
    });

    it("should not change the key", async () => {
      const bucket = await createBucket(properties);
      const saved = await insert(bucket, {title: "a"});

      await patch(bucket, {id: uuid(9), title: "b"}, {id: uuid(9), title: "b"}, {});
      await patch(bucket, {id: saved.id, title: "c"}, {id: uuid(9), title: "c"}, {});

      expect((await rows(bucket)).map(row => [row.id, row.title])).toEqual([[saved.id, "c"]]);
    });

    it("should answer the document unchanged for an empty patch", async () => {
      const bucket = await createBucket(properties);
      const saved = await insert(bucket, {title: "a", tags: ["x"]});

      const answered = await patch(bucket, {id: saved.id, title: "a", tags: ["x"]}, {}, {});

      expect(answered).toMatchObject({id: saved.id, title: "a", tags: ["x"]});
    });

    it("should keep every row when the patch is refused", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = (await insert(authors, {name: "ann"})).id;
      const posts = await createBucket({
        title: {type: "string"},
        editors: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetomany"}
      });
      const saved = await insert(posts, {title: "p", editors: [ann]});

      await expect(patching(posts, saved, {title: "q", editors: [uuid(404)]})).rejects.toThrow();

      expect((await rows(posts))[0].title).toBe("p");
      expect((await rowsOf(posts, "editors")).map(row => row._target)).toEqual([ann]);
    });
  });
});
