import {describeBucket, translateWriteError} from "@spica-server/data-postgresql";
import {postgresWriter, uuid} from "./support.js";
import {idOf} from "@spica-server/data";

describe("PostgreSQL bucket write: errors", () => {
  const {createBucket, insert, replace, patch, remove, rows, rowsOf} = postgresWriter();

  const badRequest = (message: string) => ({status: 400, message});

  describe("a key that is already taken", () => {
    it("should name the key", async () => {
      const bucket = await createBucket({title: {type: "string"}});
      await insert(bucket, {id: uuid(1), title: "a"});

      await expect(insert(bucket, {id: uuid(1), title: "b"})).rejects.toMatchObject(
        badRequest("Value of the property .id should unique across all documents.")
      );
      expect(await rows(bucket)).toHaveLength(1);
    });
  });

  describe("a reference to a document that does not exist", () => {
    let authors: any;
    let ann: string;
    let posts: any;

    beforeAll(async () => {
      authors = await createBucket({name: {type: "string"}});
      ann = (await insert(authors, {name: "ann"})).id;
      posts = await createBucket({
        title: {type: "string"},
        author: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetoone"},
        editors: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetomany"}
      });
    });

    it("should name a one to one relation", async () => {
      await expect(insert(posts, {title: "p", author: uuid(404)})).rejects.toMatchObject(
        badRequest("The property .author refers to a document that does not exist.")
      );
    });

    it("should name a one to many relation", async () => {
      await expect(insert(posts, {title: "p", editors: [ann, uuid(404)]})).rejects.toMatchObject(
        badRequest("The property .editors refers to a document that does not exist.")
      );
      expect(await rowsOf(posts, "editors")).toEqual([]);
    });

    it("should be reported by a replacement and by a patch as well", async () => {
      const saved = await insert(posts, {title: "p", author: ann});

      await expect(
        replace(posts, {id: saved.id, title: "q", author: uuid(404)})
      ).rejects.toMatchObject(
        badRequest("The property .author refers to a document that does not exist.")
      );
      await expect(
        patch(posts, {id: saved.id, author: uuid(404)}, {author: uuid(404)})
      ).rejects.toMatchObject(
        badRequest("The property .author refers to a document that does not exist.")
      );
    });
  });

  describe("a reference whose type is not the key type of its target", () => {
    const relationTo = (target: any, relationType = "onetoone") => ({
      title: {type: "string"},
      author: {type: "relation", bucketId: String(idOf(target)), relationType}
    });

    describe("with an integer key", () => {
      let authors: any;
      let posts: any;
      let editors: any;

      beforeAll(async () => {
        authors = await createBucket(
          {},
          {properties: {id: {type: "integer", options: {generated: true}}, name: {type: "string"}}}
        );
        await insert(authors, {name: "ann"});
        posts = await createBucket(relationTo(authors));
        editors = await createBucket(relationTo(authors, "onetomany"));
      });

      it("should accept the key as a number or as a string", async () => {
        await insert(posts, {title: "a", author: 1});
        await insert(posts, {title: "b", author: "1"});

        expect((await rows(posts)).map(row => row.author)).toEqual([1, 1]);
      });

      it("should name a one to one relation that is not an integer", async () => {
        await expect(insert(posts, {title: "p", author: "abc"})).rejects.toMatchObject(
          badRequest("The property .author must be a valid integer key.")
        );
      });

      it("should name a one to many relation that holds a value that is not an integer", async () => {
        await expect(insert(editors, {title: "p", author: [1, "abc"]})).rejects.toMatchObject(
          badRequest("The property .author must be a valid integer key.")
        );
      });

      it("should report a missing document, not a wrong type, for an integer that is free", async () => {
        await expect(insert(posts, {title: "p", author: 404})).rejects.toMatchObject(
          badRequest("The property .author refers to a document that does not exist.")
        );
      });
    });

    describe("with a text key", () => {
      let authors: any;
      let posts: any;

      beforeAll(async () => {
        authors = await createBucket(
          {},
          {primary: "code", properties: {code: {type: "string"}, name: {type: "string"}}}
        );
        await insert(authors, {code: "ann", name: "Ann"});
        posts = await createBucket(relationTo(authors));
      });

      it("should accept an existing key", async () => {
        await insert(posts, {title: "a", author: "ann"});

        expect((await rows(posts)).map(row => row.author)).toEqual(["ann"]);
      });

      it("should name a relation that is not a string", async () => {
        await expect(insert(posts, {title: "p", author: 5})).rejects.toMatchObject(
          badRequest("The property .author must be a valid text key.")
        );
      });

      it("should name a missing document", async () => {
        await expect(insert(posts, {title: "p", author: "bob"})).rejects.toMatchObject(
          badRequest("The property .author refers to a document that does not exist.")
        );
      });
    });

    describe("with a uuid key", () => {
      it("should name a relation that is not a uuid", async () => {
        const authors = await createBucket({name: {type: "string"}});
        const posts = await createBucket(relationTo(authors));

        await expect(insert(posts, {title: "p", author: "not-a-uuid"})).rejects.toMatchObject(
          badRequest("The property .author must be a valid uuid key.")
        );
      });
    });
  });

  describe("a document that a required property refers to", () => {
    it("should not be deleted", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = await insert(authors, {name: "ann"});
      const posts = await createBucket(
        {author: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetoone"}},
        {required: ["author"]}
      );
      await insert(posts, {author: ann.id});

      await expect(remove(authors, ann.id)).rejects.toMatchObject(
        badRequest(
          "The document is referenced by a required property of another document and cannot be deleted."
        )
      );
      expect(await rows(authors)).toHaveLength(1);
    });
  });

  describe("a value the table refuses", () => {
    it("should name a required property that is missing", async () => {
      const bucket = await createBucket({title: {type: "string"}}, {required: ["title"]});

      await expect(insert(bucket, {})).rejects.toMatchObject(
        badRequest("The property .title is required.")
      );
    });

    it("should name a required property of a required object", async () => {
      const bucket = await createBucket(
        {address: {type: "object", required: ["city"], properties: {city: {type: "string"}}}},
        {required: ["address"]}
      );

      await expect(insert(bucket, {address: {}})).rejects.toMatchObject(
        badRequest("The property .address.city is required.")
      );
    });

    it("should name a property whose value is not one of the allowed ones", async () => {
      const bucket = await createBucket({kind: {type: "string", enum: ["a", "b"]}});

      await expect(insert(bucket, {kind: "c"})).rejects.toMatchObject(
        badRequest("The property .kind has a value that is not allowed.")
      );
      await insert(bucket, {kind: "a"});
    });

    it("should report a number that does not fit as a database error", async () => {
      const bucket = await createBucket({age: {type: "integer"}});

      await expect(insert(bucket, {age: 3_000_000_000})).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("Database error: ")
      });
    });
  });

  describe("an error that is not about a value", () => {
    const metadata = describeBucket("0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90", {
      title: "b",
      primary: "id",
      acl: {read: "", write: ""},
      properties: {id: {type: "uuid", options: {generated: true}}}
    } as any);

    it("should be left as it is", () => {
      const lost = Object.assign(new Error("the connection was lost"), {code: "08006"});

      expect(translateWriteError(lost, metadata, "write")).toBe(lost);
      expect(translateWriteError("not an error", metadata, "write")).toBe("not an error");
    });

    it("should become a database error when the constraint is not known", () => {
      const unknown = Object.assign(new Error("exclusion violation"), {code: "23P01"});

      expect(translateWriteError(unknown, metadata, "write")).toMatchObject({
        status: 400,
        message: "Database error: exclusion violation"
      });
    });
  });
});
