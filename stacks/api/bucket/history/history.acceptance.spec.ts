import {INestApplication} from "@nestjs/common";
import {Request, CoreTestingModule} from "@spica-server/core/testing";
import {TestingModule, Test} from "@nestjs/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {DatabaseTestingModule, DatabaseService, ObjectId} from "@spica-server/database/testing";
import {HistoryModule} from "./history.module";

describe("History Acceptance", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  const bucketId = new ObjectId();
  const documentId = new ObjectId();
  const anotherDocumentId = new ObjectId();

  const firstHistoryId = new ObjectId(
    Math.floor(new Date(2018, 5, 10).getTime() / 1000).toString(16) + "0000000000000000"
  );
  const secondHistoryId = new ObjectId(
    Math.floor(new Date(2018, 5, 11).getTime() / 1000).toString(16) + "0000000000000000"
  );

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        HistoryModule
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);

    //add bucket
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
            options: {position: "left", visible: true}
          },
          description: {
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      });
    //add documents
    await app
      .get(DatabaseService)
      .collection(`bucket_${bucketId}`)
      .insertMany([
        //we need to keep last updated data
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
    //add histories

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
                  diffs: [[-1, "updated"], [1, "current"], [0, " tit"]],
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
                  diffs: [[-1, "updated"], [1, "current"], [0, " des"]],
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
        }
      ]);
  }, 120000);

  afterAll(async () => {
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
      title: "current title",
      description: "current description"
    });
  });
});
