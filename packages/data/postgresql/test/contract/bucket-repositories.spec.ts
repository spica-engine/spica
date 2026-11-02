import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {BUCKET_REPOSITORY, BucketRepository} from "@spica-server/interface-bucket";
import {HISTORY_REPOSITORY, HistoryRepository} from "@spica-server/interface-bucket-history";
import {ID_TYPES, IdType, IdTypes} from "@spica-server/interface-data";
import {clearStorage} from "./support.js";

contractSuite("bucket repositories", engine => {
  let module: TestingModule;
  let idType: IdType;
  let buckets: BucketRepository;
  let histories: HistoryRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [provideRepository(BUCKET_REPOSITORY), provideRepository(HISTORY_REPOSITORY)]
    }).compile();
    await module.init();

    idType = module.get<IdTypes>(ID_TYPES).unscoped();
    buckets = module.get(BUCKET_REPOSITORY);
    histories = module.get(HISTORY_REPOSITORY);
  }, 120_000);

  beforeEach(() =>
    clearStorage(engine, module, {
      mongodb: ["buckets", "history"],
      postgresql: ["buckets", "histories"]
    })
  );

  afterAll(() => module.close());

  const missingId = () => idType.generate();

  const bucket = (title: string, extra: object = {}): any => ({
    title,
    primary: "title",
    acl: {read: "true==true", write: "true==true"},
    properties: {title: {type: "string", options: {}}},
    ...extra
  });

  describe("bucket", () => {
    it("keeps the column order of a compound index", async () => {
      const indexes = [
        {definition: {b: 1, a: -1, c: 1}, options: {}},
        {definition: {z: 1, y: 1}, options: {unique: true}}
      ];

      const inserted = await buckets.insert(bucket("Indexed", {indexes}));

      const found = await buckets.findById(inserted._id);
      expect(found?.indexes?.map(index => Object.keys(index.definition))).toEqual([
        ["b", "a", "c"],
        ["z", "y"]
      ]);
      expect(found?.indexes).toEqual(indexes);
    });

    it("inserts a bucket and finds it by id", async () => {
      const inserted = await buckets.insert(
        bucket("Books", {
          icon: "book",
          history: true,
          readOnly: false,
          order: 2,
          required: ["title"],
          documentSettings: {countLimit: 10, limitExceedBehaviour: "prevent"},
          indexes: [{definition: {title: 1}, options: {unique: true}}]
        })
      );

      expect(inserted._id).toBeDefined();
      expect(await buckets.findById(inserted._id)).toMatchObject({
        title: "Books",
        icon: "book",
        primary: "title",
        history: true,
        readOnly: false,
        order: 2,
        required: ["title"],
        acl: {read: "true==true", write: "true==true"},
        documentSettings: {countLimit: 10, limitExceedBehaviour: "prevent"},
        indexes: [{definition: {title: 1}, options: {unique: true}}],
        properties: {title: {type: "string", options: {}}}
      });
      expect(await buckets.findById(missingId())).toBeNull();
    });

    it("lists buckets in creation order", async () => {
      await buckets.insert(bucket("a"));
      await buckets.insert(bucket("b"));

      expect((await buckets.findAll()).map(b => b.title)).toEqual(["a", "b"]);
    });

    it("replaces a bucket and resolves to the replaced one", async () => {
      const {_id} = await buckets.insert(bucket("a", {description: "old"}));

      const replaced = await buckets.replaceById(_id, bucket("renamed"));

      expect(replaced).toMatchObject({title: "renamed"});
      expect(replaced).not.toHaveProperty("description");
      expect(await buckets.replaceById(missingId(), bucket("x"))).toBeNull();
    });

    it("deletes a bucket and resolves to it", async () => {
      const {_id} = await buckets.insert(bucket("a"));

      expect(await buckets.deleteById(_id)).toMatchObject({title: "a"});
      expect(await buckets.deleteById(_id)).toBeNull();
    });

    it("removes schema properties by their dotted paths", async () => {
      const {_id} = await buckets.insert(
        bucket("a", {
          properties: {
            title: {type: "string", options: {}},
            author: {
              type: "object",
              options: {},
              properties: {name: {type: "string"}, born: {type: "number"}}
            },
            extra: {type: "string", options: {}}
          }
        })
      );

      const modified = await buckets.unsetProperties(_id, [
        "properties.author.properties.born",
        "properties.extra"
      ]);

      expect(modified).toBe(1);
      expect((await buckets.findById(_id)).properties).toEqual({
        title: {type: "string", options: {}},
        author: {type: "object", options: {}, properties: {name: {type: "string"}}}
      });
      expect(await buckets.unsetProperties(missingId(), ["properties.title"])).toBe(0);
    });

    it("removes other bucket fields given as paths", async () => {
      const {_id} = await buckets.insert(bucket("a", {description: "d", icon: "i"}));

      await buckets.unsetProperties(_id, ["description", "acl.write"]);

      const stored = await buckets.findById(_id);
      expect(stored).not.toHaveProperty("description");
      expect(stored.acl).toEqual({read: "true==true"});
      expect(stored.icon).toBe("i");
    });

    it("sums the document count limits", async () => {
      expect(await buckets.sumOfCountLimits()).toBe(0);
      await buckets.insert(
        bucket("a", {documentSettings: {countLimit: 10, limitExceedBehaviour: "prevent"}})
      );
      await buckets.insert(
        bucket("b", {documentSettings: {countLimit: 5, limitExceedBehaviour: "remove"}})
      );
      await buckets.insert(bucket("c"));

      expect(await buckets.sumOfCountLimits()).toBe(15);
    });

    it("finds the buckets with translatable properties and only those properties", async () => {
      const translatable = await buckets.insert(
        bucket("a", {
          properties: {
            title: {type: "string", options: {translate: true}},
            body: {type: "string", options: {translate: true}},
            slug: {type: "string", options: {translate: false}},
            views: {type: "number", options: {}}
          }
        })
      );
      await buckets.insert(
        bucket("b", {properties: {title: {type: "string", options: {translate: false}}}})
      );
      await buckets.insert(bucket("c", {properties: undefined}));

      const found = await buckets.findTranslatable();

      expect(found).toHaveLength(1);
      expect(String(found[0]._id)).toBe(String(translatable._id));
      expect(found[0].properties).toEqual({
        title: {type: "string", options: {translate: true}},
        body: {type: "string", options: {translate: true}}
      });
    });

    it("finds the buckets with a top-level relation to a bucket", async () => {
      const target = await buckets.insert(bucket("target"));
      const referencing = await buckets.insert(
        bucket("a", {
          properties: {
            title: {type: "string", options: {}},
            author: {type: "relation", bucketId: String(target._id), relationType: "onetoone"}
          }
        })
      );
      await buckets.insert(
        bucket("nested", {
          properties: {
            group: {
              type: "object",
              properties: {author: {type: "relation", bucketId: String(target._id)}}
            }
          }
        })
      );
      await buckets.insert(bucket("unrelated"));

      expect(await buckets.findReferencing(String(target._id))).toEqual([String(referencing._id)]);
      expect(await buckets.findReferencing(String(missingId()))).toEqual([]);
    });

    it("reports its status", async () => {
      await buckets.insert(bucket("a"));
      await buckets.insert(bucket("b"));

      expect(await buckets.status()).toMatchObject({current: 2, unit: "count"});
    });
  });

  describe("history", () => {
    const document = (id: unknown, fields: object) => ({_id: id, ...fields});

    async function record(bucketId: unknown, documentId: unknown, title: string, previous: string) {
      await histories.createHistory(
        bucketId as any,
        document(documentId, {title: previous}),
        document(documentId, {title})
      );
    }

    it("records the changes between two versions of a document", async () => {
      const bucketId = missingId();
      const documentId = missingId();

      await record(bucketId, documentId, "new", "old");

      const summaries = await histories.findSummaries(bucketId, documentId);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].changes).toBe(1);
      expect(summaries[0].date).toBeInstanceOf(Date);
      expect(summaries[0]._id).toBeDefined();
    });

    it("records nothing when the document did not change", async () => {
      const bucketId = missingId();
      const documentId = missingId();

      await record(bucketId, documentId, "same", "same");

      expect(await histories.findSummaries(bucketId, documentId)).toEqual([]);
    });

    it("lists the summaries of one document, newest first", async () => {
      const bucketId = missingId();
      const documentId = missingId();
      for (const title of ["b", "c", "d"]) {
        await record(bucketId, documentId, title, "a");
      }
      await record(bucketId, missingId(), "other", "a");

      const summaries = await histories.findSummaries(bucketId, documentId);

      expect(summaries).toHaveLength(3);
      const dates = summaries.map(summary => summary.date.getTime());
      expect([...dates].sort((a, b) => b - a)).toEqual(dates);
    });

    it("keeps the latest ten histories of a document", async () => {
      const bucketId = missingId();
      const documentId = missingId();
      for (let index = 0; index < 10; index++) {
        await record(bucketId, documentId, `title ${index}`, "a");
      }
      const full = (await histories.findSummaries(bucketId, documentId)).map(s => String(s._id));
      expect(full).toHaveLength(10);

      await record(bucketId, documentId, "one more", "a");

      const trimmed = (await histories.findSummaries(bucketId, documentId)).map(s => String(s._id));
      expect(trimmed).toHaveLength(10);
      expect(trimmed).not.toContain(full[full.length - 1]);
      expect(full.slice(0, 9).every(id => trimmed.includes(id))).toBe(true);
    });

    it("finds the histories since a given one, newest first", async () => {
      const bucketId = missingId();
      const documentId = missingId();
      for (const title of ["b", "c", "d", "e"]) {
        await record(bucketId, documentId, title, "a");
      }
      const summaries = await histories.findSummaries(bucketId, documentId);
      const second = summaries[2]._id;

      const since = await histories.findSince(bucketId, documentId, second);

      expect(since.map(history => String(history._id))).toEqual(
        summaries.slice(0, 3).map(summary => String(summary._id))
      );
      expect(since[0]).toMatchObject({changes: expect.any(Array)});
      expect(String(since[0].bucket_id)).toBe(String(bucketId));
      expect(String(since[0].document_id)).toBe(String(documentId));
    });

    it("deletes the histories of a bucket and of a document", async () => {
      const bucketId = missingId();
      const otherBucket = missingId();
      const documentId = missingId();
      const otherDocument = missingId();
      await record(bucketId, documentId, "b", "a");
      await record(bucketId, documentId, "c", "a");
      await record(bucketId, otherDocument, "b", "a");
      await record(otherBucket, missingId(), "b", "a");

      expect(await histories.deleteByDocument(documentId)).toBe(2);
      expect(await histories.deleteByBucket(bucketId)).toBe(1);
      expect(await histories.deleteByBucket(bucketId)).toBe(0);
      expect(await histories.deleteByBucket(otherBucket)).toBe(1);
    });

    describe("when the schema changes", () => {
      const schema = (id: unknown, descriptionType: string) => ({
        _id: id,
        primary: "title",
        acl: {read: "true==true", write: "true==true"},
        properties: {
          title: {type: "string", options: {}},
          description: {type: descriptionType, options: {}}
        }
      });

      async function recordFields(
        bucketId: unknown,
        documentId: unknown,
        previous: object,
        current: object
      ) {
        await histories.createHistory(
          bucketId as any,
          document(documentId, previous),
          document(documentId, current)
        );
      }

      it("drops the changes of a property whose type changed and the histories left empty", async () => {
        const bucketId = missingId();
        const documentId = missingId();
        await recordFields(
          bucketId,
          documentId,
          {title: "a", description: "x"},
          {title: "b", description: "y"}
        );
        await recordFields(bucketId, documentId, {description: "y"}, {description: "z"});

        await histories.updateHistories(
          schema(bucketId, "string") as any,
          schema(bucketId, "number") as any
        );

        const summaries = await histories.findSummaries(bucketId, documentId);
        expect(summaries.map(summary => summary.changes)).toEqual([1]);
      });

      it("keeps the histories when the schema change does not affect them", async () => {
        const bucketId = missingId();
        const documentId = missingId();
        await recordFields(bucketId, documentId, {title: "a"}, {title: "b"});

        await histories.updateHistories(
          schema(bucketId, "string") as any,
          {
            ...schema(bucketId, "string"),
            properties: {
              ...schema(bucketId, "string").properties,
              extra: {type: "string", options: {}}
            }
          } as any
        );

        expect((await histories.findSummaries(bucketId, documentId)).map(s => s.changes)).toEqual([
          1
        ]);
      });

      it("only touches the histories of the changed bucket", async () => {
        const bucketId = missingId();
        const otherBucket = missingId();
        const documentId = missingId();
        const otherDocument = missingId();
        await recordFields(bucketId, documentId, {description: "x"}, {description: "y"});
        await recordFields(otherBucket, otherDocument, {description: "x"}, {description: "y"});

        await histories.updateHistories(
          schema(bucketId, "string") as any,
          schema(bucketId, "number") as any
        );

        expect(await histories.findSummaries(bucketId, documentId)).toEqual([]);
        expect(await histories.findSummaries(otherBucket, otherDocument)).toHaveLength(1);
      });
    });
  });
});
