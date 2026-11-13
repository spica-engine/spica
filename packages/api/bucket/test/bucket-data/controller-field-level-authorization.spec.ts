import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp, withoutNulls} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: field level authorization", engine => {
  let api: BucketApp;
  let bucket: any;
  let rows = [];
  let key: string;

  beforeEach(async () => {
    api = await startBucketApp(engine, {}, {passport: {overriddenStrategyType: "USER"}});
    key = api.keyField;
    bucket = await api.createBucket(
      {
        name: {
          type: "string",
          title: "Name of the person",
          options: {},
          maxLength: 20,
          minLength: 3
        },
        age: {type: "number", title: "Age of the person", options: {}},
        created_at: {type: "date", title: "Creation Timestamp", options: {}}
      },
      {title: "Persons", description: "Person bucket"}
    );

    rows = [
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {name: "Jim", age: 20}),
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {name: "Michael", age: 22}),
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {name: "Kevin", age: 25}),
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {name: "Dwight", age: 38}),
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {name: "Toby", age: 30})
    ].map(r => r.body);
  });

  afterEach(() => api.close());

  describe("when name is hidden for noop", () => {
    beforeEach(async () => {
      bucket.properties.name.acl = "auth.identifier != 'noop'";
      await api.req.put(`/bucket/${idOf(bucket)}`, bucket);
    });

    it("shouldn't see name field", async () => {
      const response = await api.req.get(
        `/bucket/${idOf(bucket)}/data`,
        {},
        {Authorization: "USER test"}
      );
      expect(response.body.length).toBe(5);
      response.body.forEach((item: any) => {
        expect(item).not.toHaveProperty("name");
        expect(item).toHaveProperty("age");
      });
    });
  });

  describe("when name is shown only if age > 24", () => {
    beforeEach(async () => {
      bucket.properties.name.acl = "document.age > 24";
      await api.req.put(`/bucket/${idOf(bucket)}`, bucket);
    });

    it("should only show name if age > 24", async () => {
      const response = await api.req.get(
        `/bucket/${idOf(bucket)}/data`,
        {},
        {Authorization: "USER test"}
      );
      expect(response.body.length).toBe(5);
      expect(withoutNulls(response.body)).toEqual([
        {[key]: rows[0][key], age: 20},
        {[key]: rows[1][key], age: 22},
        {[key]: rows[2][key], name: "Kevin", age: 25},
        {[key]: rows[3][key], name: "Dwight", age: 38},
        {[key]: rows[4][key], name: "Toby", age: 30}
      ]);
    });
  });
});
