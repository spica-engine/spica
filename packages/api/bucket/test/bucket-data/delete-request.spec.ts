import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";

contractSuite("BucketDataController: delete requests", engine => {
  let api: BucketApp;
  let myBucketId: string;
  let keys: string[];

  beforeEach(async () => {
    api = await startBucketApp(engine);
    const bucket = await api.createBucket({
      title: {type: "string", title: "title", description: "Title of the row", options: {}},
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {}
      }
    });
    myBucketId = bucket._id;

    keys = [];
    for (const document of [
      {title: "first title", description: "first description"},
      {title: "last title", description: "last description"}
    ]) {
      keys.push((await api.req.post(`/bucket/${myBucketId}/data`, document)).body[api.keyField]);
    }
  });

  afterEach(() => api.close());

  it("should delete document", async () => {
    const response = await api.req.delete(`/bucket/${myBucketId}/data/${keys[1]}`);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe(undefined);

    const bucketData = (await api.req.get(`/bucket/${myBucketId}/data`, {})).body;

    expect(bucketData.length).toBe(1);
    expect(bucketData[0].title).toBe("first title");
    expect(bucketData[0].description).toBe("first description");
  });

  it("should throw error when document does not exist", async () => {
    const missing = api.unknownKey();

    const response = await api.req.delete(`/bucket/${myBucketId}/data/${missing}`).catch(e => e);

    expect(response.statusCode).toBe(404);
    expect(response.statusText).toBe("Not Found");
    expect(response.body).toEqual({
      statusCode: 404,
      message: `Could not find the document with id ${missing}`,
      error: "Not Found"
    });
  });
});
