import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: insert with limitations", engine => {
  let api: BucketApp;
  let key: "_id" | "id";

  beforeEach(async () => {
    api = await startBucketApp(engine);
    key = api.keyField;
  });

  afterEach(() => api.close());

  const properties = {
    title: {type: "string", title: "title", description: "Title of the row", options: {}},
    description: {
      type: "textarea",
      title: "description",
      description: "Description of the row",
      options: {}
    }
  };

  const first = {title: "first title", description: "first description"};
  const second = {title: "second title", description: "second description"};

  const insert = async (bucketId: string, document: object) =>
    (await api.req.post(`/bucket/${bucketId}/data`, document)).body;

  describe("prevent inserting", () => {
    let bucketId: string;
    let bucket;

    beforeEach(async () => {
      bucket = api.definition(properties, {
        documentSettings: {countLimit: 1, limitExceedBehaviour: "prevent"}
      });
      bucketId = idOf((await api.req.post("/bucket", bucket)).body);
    });

    it("should throw error and prevent inserting when limit reached", async () => {
      const document1 = await insert(bucketId, first);
      expect(document1).toEqual({...first, [key]: document1[key]});

      const response = await api.req.post(`/bucket/${bucketId}/data`, second).catch(e => e);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toEqual(
        "Database error: Maximum number of documents has been reached"
      );
    });

    it("should disable document count limitation", async () => {
      delete bucket.documentSettings;
      await api.req.put(`/bucket/${bucketId}`, bucket);

      const document1 = await insert(bucketId, first);
      expect(document1).toEqual({...first, [key]: document1[key]});

      const document2 = await insert(bucketId, second);
      expect(document2).toEqual({...second, [key]: document2[key]});
    });
  });

  describe("insert and remove oldest document", () => {
    let bucketId: string;
    let bucket;

    beforeEach(async () => {
      bucket = api.definition(properties, {
        documentSettings: {countLimit: 1, limitExceedBehaviour: "remove"}
      });
      bucketId = idOf((await api.req.post("/bucket", bucket)).body);
    });

    it("should insert document but remove the oldest document of bucket", async () => {
      const document1 = await insert(bucketId, first);
      expect(document1).toEqual({...first, [key]: document1[key]});

      const document2 = await insert(bucketId, second);
      expect(document2).toEqual({...second, [key]: document2[key]});

      const {body: documents} = await api.req.get(`/bucket/${bucketId}/data`);
      expect(documents).toEqual([{...second, [key]: documents[0][key]}]);
    });

    it("should disable document count limitation", async () => {
      delete bucket.documentSettings;
      await api.req.put(`/bucket/${bucketId}`, bucket);

      const document1 = await insert(bucketId, first);
      const document2 = await insert(bucketId, second);

      const {body: documents} = await api.req.get(`/bucket/${bucketId}/data`);
      expect(documents).toEqual([
        {...first, [key]: document1[key]},
        {...second, [key]: document2[key]}
      ]);
    });
  });
});
