import {Test, TestingModule} from "@nestjs/testing";
import {createBucketActivity} from "@spica-server/bucket-common";
import {BucketChangeDispatcher, BucketService} from "@spica-server/bucket-services";
import {SchemaModule} from "@spica-server/core-schema";
import {provideRepository, idOf} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {Action} from "@spica-server/interface-activity";
import {
  Bucket,
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_RULE_VALIDATOR,
  BUCKET_SCHEMA_MANAGER,
  BucketRuleValidator
} from "@spica-server/interface-bucket";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import * as CRUD from "../src/crud";

contractSuite("bucket crud insert", engine => {
  let module: TestingModule;
  let buckets: BucketService;
  let rules: BucketRuleValidator;

  const bucket = (): Bucket =>
    ({
      title: "Books",
      description: "Books of the library",
      primary: "title",
      acl: {read: "true==true", write: "true==true"},
      properties: {title: {type: "string", options: {}}}
    }) as Bucket;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module(), PreferenceTestingModule, SchemaModule.forChild()],
      providers: [
        BucketChangeDispatcher,
        provideRepository(BUCKET_REPOSITORY),
        provideRepository(BUCKET_DATA_REPOSITORY),
        provideRepository(BUCKET_SCHEMA_MANAGER),
        BucketService
      ]
    }).compile();
    await module.init();

    buckets = module.get(BucketService);
    rules = module.get(BUCKET_RULE_VALIDATOR);
  });

  afterEach(() => module.close());

  it("should answer with the stored bucket", async () => {
    const inserted = await CRUD.insert(buckets, rules, bucket());

    expect(idOf(inserted)).toBeDefined();
    expect(inserted).toMatchObject({title: "Books", primary: "title"});
    expect(await buckets.findById(idOf(inserted))).toEqual(inserted);
  });

  it("should give the activity the id of the stored bucket", async () => {
    const inserted = await CRUD.insert(buckets, rules, bucket());

    const activities = createBucketActivity(
      {action: Action.POST, identifier: "tester"},
      {},
      inserted
    );

    expect(activities).toEqual([
      {action: Action.POST, identifier: "tester", resource: ["bucket", String(idOf(inserted))]}
    ]);
  });
});
