import {postgresWriter, uuid} from "./support.js";

describe("PostgreSQL bucket write: delete", () => {
  const {createBucket, insert, remove, rows, rowsOf} = postgresWriter();

  it("should remove the rows of every child table of the document and no others", async () => {
    const bucket = await createBucket({
      tags: {type: "array", items: {type: "string"}},
      label: {type: "string", options: {translate: true}}
    });
    const gone = await insert(bucket, {tags: ["a", "b"], label: {en_US: "x", tr_TR: "y"}});
    const kept = await insert(bucket, {tags: ["c"], label: {en_US: "z"}});

    await remove(bucket, gone.id);

    expect((await rows(bucket)).map(row => row.id)).toEqual([kept.id]);
    expect((await rowsOf(bucket, "tags")).map(row => row._parent)).toEqual([kept.id]);
    expect((await rowsOf(bucket, "label")).map(row => row._parent)).toEqual([kept.id]);
  });

  it("should accept the key as text for an integer key", async () => {
    const bucket = await createBucket(
      {},
      {properties: {id: {type: "integer", options: {generated: true}}, title: {type: "string"}}}
    );
    const saved = await insert(bucket, {title: "a"});

    const deleted = await remove(bucket, String(saved.id));

    expect(deleted).toMatchObject({id: saved.id, title: "a"});
    expect(await rows(bucket)).toEqual([]);
  });

  it("should refuse a key that is not valid for the bucket", async () => {
    const bucket = await createBucket({title: {type: "string"}});

    await expect(remove(bucket, "not-a-uuid")).rejects.toThrow("is not a valid uuid");
  });

  describe("the references to the document", () => {
    it("should leave a reference that is not required empty", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = await insert(authors, {name: "ann"});
      const posts = await createBucket({
        author: {type: "relation", bucketId: String(authors._id), relationType: "onetoone"}
      });
      const post = await insert(posts, {author: ann.id});

      await remove(authors, ann.id);

      expect((await rows(posts)).map(row => [row.id, row.author])).toEqual([[post.id, null]]);
    });

    it("should remove the links of a one to many relation to the document and keep the others", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = await insert(authors, {name: "ann"});
      const bob = await insert(authors, {name: "bob"});
      const cem = await insert(authors, {name: "cem"});
      const posts = await createBucket({
        editors: {type: "relation", bucketId: String(authors._id), relationType: "onetomany"}
      });
      const first = await insert(posts, {editors: [ann.id, bob.id, cem.id]});
      const second = await insert(posts, {editors: [ann.id]});

      await remove(authors, bob.id);

      expect(
        (await rowsOf(posts, "editors")).map(row => [row._parent, row._position, row._target])
      ).toEqual([
        [first.id, 0, ann.id],
        [first.id, 2, cem.id],
        [second.id, 0, ann.id]
      ]);
    });

    it("should refuse to delete a document that a required reference points to", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = await insert(authors, {name: "ann"});
      const posts = await createBucket(
        {author: {type: "relation", bucketId: String(authors._id), relationType: "onetoone"}},
        {required: ["author"]}
      );
      await insert(posts, {author: ann.id});

      await expect(remove(authors, ann.id)).rejects.toThrow();

      expect(await rows(authors)).toHaveLength(1);
    });

    it("should leave the other documents alone when the document is not referenced", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = await insert(authors, {name: "ann"});
      const bob = await insert(authors, {name: "bob"});
      const posts = await createBucket({
        author: {type: "relation", bucketId: String(authors._id), relationType: "onetoone"}
      });
      const post = await insert(posts, {author: ann.id});

      await remove(authors, bob.id);

      expect((await rows(posts)).map(row => [row.id, row.author])).toEqual([[post.id, ann.id]]);
    });
  });

  it("should answer undefined for a key with no row and change nothing", async () => {
    const bucket = await createBucket({title: {type: "string"}});
    await insert(bucket, {title: "a"});

    expect(await remove(bucket, uuid(404))).toBeUndefined();

    expect(await rows(bucket)).toHaveLength(1);
  });
});
