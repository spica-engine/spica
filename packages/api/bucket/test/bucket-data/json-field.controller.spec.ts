import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: json field type", engine => {
  let api: BucketApp;
  let bucket;
  let rows;
  let key: string;

  beforeEach(async () => {
    api = await startBucketApp(engine);
    key = api.keyField;
    bucket = await api.createBucket(
      {
        name: {type: "string", options: {}},
        characteristics: {type: "json", options: {}}
      },
      {title: "new bucket", description: "new bucket"}
    );

    rows = [
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {
        name: "James",
        characteristics: {height: 184, weight: "75kg"}
      }),
      await api.req.post(`/bucket/${idOf(bucket)}/data`, {
        name: "Braim",
        characteristics: {height: 170, weight: "70kg"}
      })
    ].map(r => r.body);
  });

  afterEach(async () => {
    await api.req.delete(`/bucket/${idOf(bucket)}`);
    await api.close();
  });

  it("should get documents", async () => {
    const res = await api.req.get(`/bucket/${idOf(bucket)}/data`);

    const {statusCode, statusText, body} = res;

    expect([statusCode, statusText]).toEqual([200, "OK"]);
    expect(body).toEqual(rows);
  });

  it("should insert new document", async () => {
    const newDocument = {
      name: "Modric",
      characteristics: {height: 174, weight: "74kg"}
    };

    const res = await api.req.post(`/bucket/${idOf(bucket)}/data`, newDocument);
    expect([res.statusCode, res.statusText]).toEqual([201, "Created"]);

    const document = await api.req.get(`/bucket/${idOf(bucket)}/data/${res.body[key]}`);
    const {statusCode, statusText, body} = document;

    expect([statusCode, statusText]).toEqual([200, "OK"]);
    expect(body).toEqual({...newDocument, [key]: res.body[key]});
  });

  it("should update document", async () => {
    await api.req.patch(`/bucket/${idOf(bucket)}/data/${rows[0][key]}`, {
      characteristics: {height: 200}
    });
    const document = await api.req.get(`/bucket/${idOf(bucket)}/data/${rows[0][key]}`);

    const {statusCode, statusText, body} = document;

    expect([statusCode, statusText]).toEqual([200, "OK"]);
    expect(body).toEqual({
      ...rows[0],
      characteristics: {...rows[0].characteristics, height: 200}
    });
  });

  it("should replace document", async () => {
    const newDocument = {
      name: "James",
      characteristics: {height: 200, weight: "80kg"}
    };

    await api.req.put(`/bucket/${idOf(bucket)}/data/${rows[0][key]}`, newDocument);
    const document = await api.req.get(`/bucket/${idOf(bucket)}/data/${rows[0][key]}`);

    const {statusCode, statusText, body} = document;

    expect([statusCode, statusText]).toEqual([200, "OK"]);
    expect(body).toEqual({...newDocument, [key]: rows[0][key]});
  });
});
