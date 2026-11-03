import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {RuleCompileError} from "@spica-server/data-postgresql";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {
  BUCKET_REPOSITORY,
  BUCKET_RULE_VALIDATOR,
  BucketRepository,
  BucketRuleValidator
} from "@spica-server/interface-bucket";

describe("PostgresBucketRuleValidator", () => {
  let module: TestingModule;
  let validator: BucketRuleValidator;
  let buckets: BucketRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_REPOSITORY)]
    }).compile();
    await module.init();
    validator = module.get(BUCKET_RULE_VALIDATOR);
    buckets = module.get(BUCKET_REPOSITORY);
  }, 120_000);

  afterAll(() => module.close());

  const bucket = (read: string, extra: object = {}): any => ({
    title: "Books",
    primary: "id",
    acl: {read, write: "true==true"},
    properties: {
      id: {type: "uuid", options: {generated: true}},
      title: {type: "string"},
      // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
      secret: {type: "encrypted"},
      tags: {type: "array", items: {type: "string"}}
    },
    ...extra
  });

  it.each([
    "true==true",
    "document.title == 'x'",
    "has(document.title) && !(document.title == 'y')",
    "some(document.tags, ['a']) || auth.role == 'admin'",
    "regex(document.title, '^a', 'i')"
  ])("should accept %s", async rule => {
    await expect(validator.validateReadRule(bucket(rule))).resolves.toBeUndefined();
  });

  it.each([
    ["document.title ==", "syntax"],
    ["document.nope == 1", "unknown field"],
    // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
    ["document.secret == 'x'", "encrypted field"],
    ["regex(document.title, 'a', 'm')", "unsupported regex flag"],
    ["regex(document.title, '(?<=a)b')", "unsupported regex syntax"],
    ["some(document.tags, document.tags)", "list against a field"],
    ["document.title > null", "ordering against null"],
    ["nope(document.title)", "unknown function"]
  ])("should reject %s (%s)", async rule => {
    await expect(validator.validateReadRule(bucket(rule))).rejects.toBeInstanceOf(RuleCompileError);
  });

  it("should check a bucket that was not saved yet", async () => {
    await expect(validator.validateReadRule(bucket("document.title =="))).rejects.toThrow();
    await expect(
      validator.validateReadRule({...bucket("true==true"), _id: undefined})
    ).resolves.toBeUndefined();
  });

  it("should leave a bucket without a usable table layout to the schema manager", async () => {
    await expect(
      validator.validateReadRule(bucket("document.nope == 1", {primary: undefined}))
    ).resolves.toBeUndefined();
  });

  it("should skip a bucket without a read rule", async () => {
    await expect(validator.validateReadRule(bucket("", {acl: {}}))).resolves.toBeUndefined();
  });

  describe("relations", () => {
    let authorId: string;

    beforeAll(async () => {
      const author = await buckets.insert({
        title: "Authors",
        primary: "id",
        acl: {read: "true==true", write: "true==true"},
        properties: {
          id: {type: "uuid", options: {generated: true}},
          name: {type: "string"},
          // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
          secret: {type: "encrypted"}
        }
      } as any);
      authorId = String(author._id);
    });

    const withAuthor = (read: string, bucketId = () => authorId) =>
      bucket(read, {
        properties: {
          id: {type: "uuid", options: {generated: true}},
          author: {type: "relation", bucketId: bucketId(), relationType: "onetoone"}
        }
      });

    it("should follow a relation to a stored bucket", async () => {
      await expect(
        validator.validateReadRule(withAuthor("document.author.name == 'x'"))
      ).resolves.toBeUndefined();
      await expect(
        validator.validateReadRule(withAuthor("document.author.id == auth._id"))
      ).resolves.toBeUndefined();
    });

    it("should reject a field the related bucket does not have", async () => {
      await expect(
        validator.validateReadRule(withAuthor("document.author.nope == 'x'"))
      ).rejects.toBeInstanceOf(RuleCompileError);
    });

    // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
    it("should reject an encrypted field of the related bucket", async () => {
      await expect(
        validator.validateReadRule(withAuthor("document.author.secret == 'x'"))
      ).rejects.toBeInstanceOf(RuleCompileError);
    });

    it("should leave a relation to a bucket that does not exist to the schema manager", async () => {
      await expect(
        validator.validateReadRule(
          withAuthor("document.author.name == 'x'", () => "0198a7e0-0000-7d2e-9f3a-4b5c6d7e8f99")
        )
      ).resolves.toBeUndefined();
    });
  });

  describe("field level rules", () => {
    const withFieldRule = (acl: string): any =>
      bucket("true==true", {
        properties: {
          id: {type: "uuid", options: {generated: true}},
          title: {type: "string", acl},
          // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
          secret: {type: "encrypted"}
        }
      });

    it.each(["true==true", "document.title == 'x'", "auth.role == 'admin'"])(
      "should accept %s",
      async rule => {
        await expect(validator.validateFieldRules(withFieldRule(rule))).resolves.toBeUndefined();
      }
    );

    // [part9-encrypted] Pins the refusal of encrypted fields in rules. Remove or rewrite when Part 9 lands a comparable hash (docs/postgresql/09-writes.md).
    it.each(["document.title ==", "document.secret == 'x'", "document.nope == 1"])(
      "should reject %s",
      async rule => {
        await expect(validator.validateFieldRules(withFieldRule(rule))).rejects.toBeInstanceOf(
          RuleCompileError
        );
      }
    );

    it("should accept a bucket without field rules", async () => {
      await expect(validator.validateFieldRules(bucket("true==true"))).resolves.toBeUndefined();
    });
  });
});
