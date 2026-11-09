import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";

contractSuite("BucketDataController: unique fields", engine => {
  let api: BucketApp;
  let bucket;
  let key: "_id" | "id";

  beforeEach(async () => {
    api = await startBucketApp(engine);
    key = api.keyField;
    bucket = await api.createBucket(
      {
        title: {type: "string", options: {}},
        description: {type: "string", options: {}}
      },
      {
        title: "new bucket",
        description: "new bucket",
        indexes: [
          {
            definition: {title: 1},
            options: {unique: true}
          }
        ]
      }
    );
  });

  afterEach(() => api.close());

  it("should insert documents when they have unique values", async () => {
    const document = {
      title: "Rat Of The Eternal",
      description: "Description of book"
    };

    let response = await api.req.post(`/bucket/${bucket._id}/data`, document);
    expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

    document.title = "Hawk Without Hate";

    response = await api.req.post(`/bucket/${bucket._id}/data`, document);
    expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
  });

  it("should update document when updated one have unique value", async () => {
    let document: any = {
      title: "Men Without Faith",
      description: "Description of book"
    };

    let response = await api.req.post(`/bucket/${bucket._id}/data`, document).then(res => {
      document = res.body;
      return res;
    });
    expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

    document.title = "Creators Of The Day";

    response = await api.req.put(`/bucket/${bucket._id}/data/${document[key]}`, document);
    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
  });

  it("should not update document when updated one does not have unique value", async () => {
    const document = {
      title: "Fish And Companions",
      description: "Description of book"
    };

    let document2: any = {
      title: "Mice And Enemies",
      description: "Description of book"
    };

    await api.req.post(`/bucket/${bucket._id}/data`, document);
    document2 = await api.req.post(`/bucket/${bucket._id}/data`, document2).then(r => r.body);

    document2.title = "Fish And Companions";

    const response = await api.req
      .put(`/bucket/${bucket._id}/data/${document2[key]}`, document2)
      .catch(e => e);

    expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
    expect(response.body.message).toEqual(
      "Value of the property .title should unique across all documents."
    );
  });

  it("should not insert documents when they do not have unique values", async () => {
    const document = {
      title: "Mice And Enemies",
      description: "Description of book"
    };

    await api.req.post(`/bucket/${bucket._id}/data`, document);

    const response = await api.req.post(`/bucket/${bucket._id}/data`, document).catch(e => e);

    expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
    expect(response.body.message).toEqual(
      "Value of the property .title should unique across all documents."
    );
  });
});
