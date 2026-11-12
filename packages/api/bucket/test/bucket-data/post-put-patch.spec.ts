import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp, withoutNulls} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: post, put and patch", engine => {
  let api: BucketApp;
  let myBucketId: string;
  let key: string;

  beforeEach(async () => {
    api = await startBucketApp(engine);
    key = api.keyField;
    const bucket = await api.createBucket({
      title: {type: "string", title: "title", description: "Title of the row", options: {}},
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {}
      }
    });
    myBucketId = idOf(bucket);
  });

  afterEach(() => api.close());

  describe("post", () => {
    it("should insert document to bucket and return inserted document", async () => {
      const insertedDocument = (
        await api.req.post(`/bucket/${myBucketId}/data`, {
          title: "first title",
          description: "first description"
        })
      ).body;

      const bucketDocument = (
        await api.req.get(`/bucket/${myBucketId}/data/${insertedDocument[key]}`, {})
      ).body;

      expect(bucketDocument).toEqual(insertedDocument);

      delete insertedDocument[key];
      expect(insertedDocument).toEqual({title: "first title", description: "first description"});
    });

    it("should insert document with id", async () => {
      const given = api.unknownKey();
      const insertedDocument = (
        await api.req.post(`/bucket/${myBucketId}/data`, {
          [key]: given,
          title: "first title",
          description: "first description"
        })
      ).body;

      const bucketDocument = (await api.req.get(`/bucket/${myBucketId}/data/${given}`, {})).body;

      expect(bucketDocument).toEqual(insertedDocument);
      expect(insertedDocument).toEqual({
        [key]: given,
        title: "first title",
        description: "first description"
      });
    });

    it("should return error if id is not valid", async () => {
      const response = await api.req
        .post(`/bucket/${myBucketId}/data`, {
          [key]: "invalid_id",
          title: "title",
          description: "description"
        })
        .catch(e => e);
      expect(response.statusCode).toBe(400);
      expect(response.statusText).toBe("Bad Request");
      expect(response.body).toEqual({
        statusCode: 400,
        message: api.invalidKeyMessage,
        error: "validation failed"
      });
    });

    it("should return error if id has already exist", async () => {
      const existingId = await api.req
        .post(`/bucket/${myBucketId}/data`, {
          title: "title",
          description: "description"
        })
        .then(r => r.body[key]);

      const response = await api.req
        .post(`/bucket/${myBucketId}/data`, {
          [key]: existingId,
          title: "title2",
          description: "description2"
        })
        .catch(e => e);
      expect(response.statusCode).toBe(400);
      expect(response.statusText).toBe("Bad Request");
      expect(response.body).toEqual({
        statusCode: 400,
        message: `Value of the property .${key} should unique across all documents.`
      });
    });

    it("should return error if title isnt valid for bucket", async () => {
      const response = await api.req
        .post(`/bucket/${myBucketId}/data`, {
          title: true,
          description: "description"
        })
        .then(() => null)
        .catch(e => e);
      expect(response.statusCode).toBe(400);
      expect(response.statusText).toBe("Bad Request");
      expect(response.body).toEqual({
        statusCode: 400,
        message: ".title must be string",
        error: "validation failed"
      });
    });
  });

  describe("put/patch", () => {
    let insertedDocument;
    beforeEach(async () => {
      const {body} = await api.req.post(`/bucket/${myBucketId}/data`, {
        title: "first title",
        description: "first description"
      });
      insertedDocument = body;
    });

    it("should update document", async () => {
      const {body: updatedDocument} = await api.req.put(
        `/bucket/${myBucketId}/data/${insertedDocument[key]}`,
        {
          ...insertedDocument,
          title: "updated title"
        }
      );
      const {body: bucketDocument} = await api.req.get(
        `/bucket/${myBucketId}/data/${updatedDocument[key]}`
      );
      expect(bucketDocument).toEqual(updatedDocument);
      expect(updatedDocument).toEqual({
        [key]: updatedDocument[key],
        title: "updated title",
        description: "first description"
      });
    });

    it("should patch document", async () => {
      const response = await api.req.patch(`/bucket/${myBucketId}/data/${insertedDocument[key]}`, {
        title: "new_title",
        description: null
      });

      expect(response.statusCode).toEqual(200);
      expect(withoutNulls(response.body)).toEqual({
        [key]: insertedDocument[key],
        title: "new_title"
      });
    });

    it("should throw error when patched document is not valid", async () => {
      const response = await api.req
        .patch(`/bucket/${myBucketId}/data/${insertedDocument[key]}`, {
          title: 1001
        })
        .catch(e => e);

      expect(response.statusCode).toBe(400);
      expect(response.statusText).toBe("Bad Request");
      expect(response.body).toEqual({
        statusCode: 400,
        message: ".title must be string",
        error: "validation failed"
      });
    });

    it("should throw error when patched document does not exist", async () => {
      const missing = api.unknownKey();
      const response = await api.req
        .patch(`/bucket/${myBucketId}/data/${missing}`, {
          title: null
        })
        .catch(e => e);

      expect(response.statusCode).toBe(404);
      expect(response.statusText).toBe("Not Found");
      expect(response.body).toEqual({
        statusCode: 404,
        message: `Could not find the document with id ${missing}`,
        error: "Not Found"
      });
    });

    it("should throw error when put document does not exist", async () => {
      const missing = api.unknownKey();
      const response = await api.req
        .put(`/bucket/${myBucketId}/data/${missing}`, {
          title: "test"
        })
        .catch(e => e);

      expect(response.statusCode).toBe(404);
      expect(response.statusText).toBe("Not Found");
      expect(response.body).toEqual({
        statusCode: 404,
        message: `Could not find the document with id ${missing}`,
        error: "Not Found"
      });
    });
  });

  it("should return error if description isnt valid for bucket", async () => {
    const response = await api.req
      .post(`/bucket/${myBucketId}/data`, {
        title: "title",
        description: [1, 2, 3]
      })
      .catch(e => e);
    expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
    expect([response.body.error, response.body.message]).toEqual([
      "validation failed",
      ".description must be string"
    ]);
  });
});
