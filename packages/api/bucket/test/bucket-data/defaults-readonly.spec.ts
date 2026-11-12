import {contractSuite} from "@spica-server/database-testing";
import {BucketApp, startBucketApp} from "../support/bucket-app";
import {idOf} from "@spica-server/data";

contractSuite("BucketDataController: defaults and readonly", engine => {
  let api: BucketApp;
  let bucketId: string;

  beforeEach(async () => {
    api = await startBucketApp(engine);
    const bucket = await api.createBucket({
      created_at: {
        type: "date",
        default: ":created_at"
      },
      created_at_readonly: {
        type: "date",
        default: ":created_at",
        readOnly: true
      }
    });
    bucketId = idOf(bucket);
  });

  afterEach(() => api.close());

  it("should work with default and readonly values", async () => {
    const date = new Date("1980-01-01");
    const document = {
      created_at: date,
      created_at_readonly: date
    };
    const insertedDocument = (await api.req.post(`/bucket/${bucketId}/data`, document)).body;

    expect(new Date(insertedDocument.created_at)).toEqual(date);
    expect(new Date(insertedDocument.created_at_readonly)).not.toEqual(date);
  });

  it("should put default values if field does not exist on document", async () => {
    const insertedDocument = (await api.req.post(`/bucket/${bucketId}/data`)).body;

    expect(new Date(insertedDocument.created_at)).toEqual(expect.any(Date));
    expect(new Date(insertedDocument.created_at_readonly)).toEqual(expect.any(Date));
  });
});
