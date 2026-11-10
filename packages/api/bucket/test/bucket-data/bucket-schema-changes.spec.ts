import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";

contractSuite("BucketController: data when buckets change", engine => {
  let api: BucketApp;
  let key: "_id" | "id";

  beforeEach(async () => {
    api = await startBucketApp(engine);
    key = api.keyField;
  });

  afterEach(() => api.close());

  it("should delete a bucket and its documents", async () => {
    const kept = await api.createBucket({name: {type: "string"}}, {title: "Kept"});
    const removed = await api.createBucket({name: {type: "string"}}, {title: "Removed"});
    const {body: inserted} = await api.req.post(`/bucket/${removed._id}/data`, {name: "name"});
    expect((await api.req.get(`/bucket/${removed._id}/data`)).body).toEqual([inserted]);

    const deleteResponse = await api.req.delete(`/bucket/${removed._id}`);

    expect([deleteResponse.statusCode, deleteResponse.statusText]).toEqual([204, "No Content"]);
    const buckets = (await api.req.get("/bucket")).body;
    expect(buckets.map(bucket => bucket._id)).toEqual([kept._id]);
    const getData = await api.req.get(`/bucket/${removed._id}/data`).catch(e => e);
    expect([getData.statusCode, getData.statusText]).toEqual([404, "Not Found"]);
  });

  describe("related buckets", () => {
    let usersBucket;
    let settingsBucket;
    let scoresBucket;
    let score;
    let setting;

    const scoresProperties = (user: object) => ({
      score: {type: "number", options: {}},
      user,
      setting: {
        type: "relation",
        bucketId: undefined as string,
        relationType: "onetoone",
        options: {}
      }
    });

    const scores = (user: object) => {
      const properties = scoresProperties(user);
      properties.setting.bucketId = settingsBucket._id;
      return api.definition(properties, {title: "Scores", description: "Scores bucket"});
    };

    const relationToUsers = () => ({
      type: "relation",
      bucketId: usersBucket._id,
      relationType: "onetoone",
      options: {}
    });

    beforeEach(async () => {
      usersBucket = await api.createBucket(
        {name: {type: "string", options: {}}},
        {title: "Users", description: "Users bucket"}
      );
      settingsBucket = await api.createBucket(
        {setting: {type: "string", options: {}}},
        {title: "Settings", description: "Settings Bucket"}
      );
      scoresBucket = (await api.req.post("/bucket", scores(relationToUsers()))).body;

      const user = (await api.req.post(`/bucket/${usersBucket._id}/data`, {name: "user1"})).body;
      setting = (await api.req.post(`/bucket/${settingsBucket._id}/data`, {setting: "setting1"}))
        .body;
      score = (
        await api.req.post(`/bucket/${scoresBucket._id}/data`, {
          score: 500,
          user: user[key],
          setting: setting[key]
        })
      ).body;
    });

    const scoreDocument = async () =>
      (await api.req.get(`/bucket/${scoresBucket._id}/data`)).body[0];

    it("should delete users, update scores bucket schema and data when the users bucket deleted", async () => {
      const deleteResponse = await api.req.delete(`/bucket/${usersBucket._id}`);
      expect([deleteResponse.statusCode, deleteResponse.statusText]).toEqual([204, "No Content"]);
      expect(deleteResponse.body).toEqual(undefined);

      const {body: usersBucketResponse} = await api.req.get(`/bucket/${usersBucket._id}`);
      expect(usersBucketResponse).toBeUndefined();

      const usersDocumentResponse = await api.req
        .get(`/bucket/${usersBucket._id}/data`)
        .catch(e => e);
      expect([usersDocumentResponse.statusCode, usersDocumentResponse.statusText]).toEqual([
        404,
        "Not Found"
      ]);

      const {body: scoresBucketResponse} = await api.req.get(`/bucket/${scoresBucket._id}`);
      expect(scoresBucketResponse.properties).not.toHaveProperty("user");
      expect(scoresBucketResponse.properties).toMatchObject({
        score: {type: "number", options: {}},
        setting: {
          type: "relation",
          bucketId: settingsBucket._id,
          relationType: "onetoone",
          options: {},
          dependent: false
        }
      });

      expect(await scoreDocument()).toEqual({
        [key]: score[key],
        score: 500,
        setting: setting[key]
      });
    });

    it("should update scores when scores bucket schema relation type changed", async () => {
      await api.req.put(
        `/bucket/${scoresBucket._id}`,
        scores({...relationToUsers(), relationType: "onetomany"})
      );

      const document = await scoreDocument();
      expect(document).toMatchObject({[key]: score[key], score: 500, setting: setting[key]});
      expect(document.user ?? []).toEqual([]);
    });

    it("should update scores when scores bucket schema relational bucket changed", async () => {
      await api.req.put(
        `/bucket/${scoresBucket._id}`,
        scores({...relationToUsers(), bucketId: settingsBucket._id})
      );

      const document = await scoreDocument();
      expect(document).toMatchObject({[key]: score[key], score: 500, setting: setting[key]});
      expect(document.user ?? null).toBeNull();
    });
  });
});
