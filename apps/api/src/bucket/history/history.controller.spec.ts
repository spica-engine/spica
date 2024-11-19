import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {HistoryModule} from "@spica/api/src/bucket/history";
import {ServicesModule} from "@spica/api/src/bucket/services";
import {CoreTestingModule, Request} from "@spica/core";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica/database";
import {PassportTestingModule} from "@spica/api/src/passport/testing";
import {PreferenceTestingModule} from "@spica/api/src/preference/testing";

describe("History Acceptance", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  const bucketId = new ObjectId();
  const anotherBucketId = new ObjectId();
  const anotherBucketDocumentId = new ObjectId();

  const documentId = new ObjectId();
  const anotherDocumentId = new ObjectId();

  const firstHistoryId = new ObjectId(
    Math.floor(new Date(2018, 5, 10).getTime() / 1000).toString(16) + "0000000000000000"
  );
  const secondHistoryId = new ObjectId(
    Math.floor(new Date(2018, 5, 11).getTime() / 1000).toString(16) + "0000000000000000"
  );
  const thirdHistoryId = new ObjectId(
    Math.floor(new Date(2018, 5, 12).getTime() / 1000).toString(16) + "0000000000000000"
  );

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.create(),
        PreferenceTestingModule,
        ServicesModule.initialize(undefined),
        HistoryModule.register()
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);

    await app
      .get(DatabaseService)
      .collection("buckets")
      .insertOne({
        _id: bucketId,
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        },
        history: true
      });

    await app
      .get(DatabaseService)
      .collection(`bucket_${bucketId}`)
      .insertMany([
        {
          _id: documentId,
          title: "last updated title",
          description: "last updated description"
        },
        {
          _id: anotherDocumentId,
          title: "another title",
          description: "another description"
        }
      ]);

    await app
      .get(DatabaseService)
      .collection("history")
      .insertMany([
        {
          _id: firstHistoryId,
          bucket_id: bucketId,
          document_id: documentId,
          changes: [
            {
              kind: 1,
              path: ["title"],
              patches: [
                {
                  diffs: [[-1, "updated"], [1, "initial"], [0, " tit"]],
                  start1: 0,
                  start2: 0,
                  length1: 11,
                  length2: 11
                }
              ]
            },
            {
              kind: 1,
              path: ["description"],
              patches: [
                {
                  diffs: [[-1, "updated"], [1, "initial"], [0, " des"]],
                  start1: 0,
                  start2: 0,
                  length1: 11,
                  length2: 11
                }
              ]
            }
          ]
        },
        {
          _id: secondHistoryId,
          bucket_id: bucketId,
          document_id: documentId,
          changes: [
            {
              kind: 1,
              path: ["title"],
              patches: [
                {
                  diffs: [[-1, "last "], [0, "upda"]],
                  start1: 0,
                  start2: 0,
                  length1: 9,
                  length2: 4
                }
              ]
            },
            {
              kind: 1,
              path: ["description"],
              patches: [
                {
                  diffs: [[-1, "last "], [0, "upda"]],
                  start1: 0,
                  start2: 0,
                  length1: 9,
                  length2: 4
                }
              ]
            }
          ]
        },
        {
          _id: thirdHistoryId,
          bucket_id: anotherBucketId,
          document_id: anotherBucketDocumentId,
          changes: []
        }
      ]);
  }, 120000);

  afterEach(async () => {
    await app
      .get(DatabaseService)
      .collection("buckets")
      .deleteMany({});
    await app
      .get(DatabaseService)
      .collection(`bucket_${bucketId}`)
      .deleteMany({});
    await app
      .get(DatabaseService)
      .collection("history")
      .deleteMany({});

    await app.close();
  });

  it("should get all histories of spesific bucket document", async () => {
    const response = await req.get(`/bucket/${bucketId}/history/${documentId}`, {});
    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

    const histories = response.body;
    expect(histories).toEqual([
      {_id: secondHistoryId.toHexString(), date: new Date(2018, 5, 11).toISOString(), changes: 2},
      {_id: firstHistoryId.toHexString(), date: new Date(2018, 5, 10).toISOString(), changes: 2}
    ]);
  });

  it("should get document as reverted one change", async () => {
    const response = await req.get(
      `/bucket/${bucketId}/history/${documentId}/${secondHistoryId}`,
      {}
    );
    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

    expect(response.body).toEqual({
      _id: documentId.toHexString(),
      title: "updated title",
      description: "updated description"
    });
  });

  it("should get document as reverted two changes", async () => {
    const response = await req.get(
      `/bucket/${bucketId}/history/${documentId}/${firstHistoryId}`,
      {}
    );
    expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

    expect(response.body).toEqual({
      _id: documentId.toHexString(),
      title: "initial title",
      description: "initial description"
    });
  });

  it("should clear histories for given bucketId", async () => {
    const response = await req.delete(`/bucket/${bucketId}/history`);
    expect(response.statusCode).toEqual(204);
    expect(response.body).toEqual(undefined);

    const {body: deletedHistories} = await req.get(`/bucket/${bucketId}/history/${documentId}`, {});
    expect(deletedHistories).toEqual([]);

    const {body: histories} = await req.get(
      `/bucket/${anotherBucketId}/history/${anotherBucketDocumentId}`,
      {}
    );
    expect(histories).toEqual([
      {_id: thirdHistoryId.toHexString(), date: new Date(2018, 5, 12).toISOString(), changes: 0}
    ]);
  });
});
