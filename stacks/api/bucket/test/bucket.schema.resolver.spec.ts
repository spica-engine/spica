import {Test, TestingModule} from "@nestjs/testing";
import {BucketService} from "@spica-server/bucket/services";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {
  BucketSchemaResolver,
  registerPreferenceWatcher
} from "@spica-server/bucket/src/bucket.schema.resolver";
import {of, Subject, Observable} from "rxjs";

describe("Bucket Schema Resolver", () => {
  let module: TestingModule;
  let schemaResolver: BucketSchemaResolver;
  let bs: BucketService;

  let bucketIds = [new ObjectId(), new ObjectId()];

  class MockBucketService {
    onLanguageUpdated = new Subject();
    constructor() {}
    findOne() {}
    getPreferences() {}
    watchPreferences() {
      return new Observable(observer => {
        this.onLanguageUpdated.subscribe(prefs => {
          observer.next(prefs);
        });
      });
    }
    aggregate() {
      return {
        toArray: () => {
          return Promise.resolve([{_id: bucketIds[0]}, {_id: bucketIds[1]}]);
        }
      };
    }
  }

  const bucket = {
    _id: new ObjectId(),
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
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {position: "right"}
      },
      text: {
        type: "string",
        title: "translatable text",
        description: "Text of the row",
        options: {position: "left", visible: true, translate: true}
      }
    }
  };

  const preference = {
    language: {
      available: {
        tr_TR: "Turkish",
        en_US: "English"
      },
      default: "en_US"
    }
  };

  let validator;

  beforeAll(async () => {
    validator = {
      removeSchema: jasmine.createSpy("removeSchema")
    };

    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create(), PreferenceTestingModule, SchemaModule.forChild()],
      providers: [
        {
          provide: BucketService,
          useClass: MockBucketService
        }
      ]
    }).compile();
    bs = module.get(BucketService);
    schemaResolver = new BucketSchemaResolver(bs);

    spyOn(bs, "findOne").and.returnValue(Promise.resolve({...bucket}) as any);
    spyOn(bs, "getPreferences").and.returnValue(Promise.resolve(preference) as any);
  });

  afterAll(async () => await module.close());

  it("should return the compiled bucket schema", async () => {
    const jsonSchema = await schemaResolver.resolve(bucket._id.toHexString());
    expect(jsonSchema).toEqual({
      $schema: "http://spica.internal/bucket/schema",
      $id: String(bucket._id),
      title: "New Bucket",
      description: "Describe your new bucket",
      readOnly: false,
      additionalProperties: false,
      properties: {
        _schedule: {type: "string", format: "date-time"},
        title: {
          type: "string",
          title: "title",
          description: "Title of the row"
        },
        description: {
          type: "string",
          title: "description",
          description: "Description of the row"
        },
        text: {
          additionalProperties: false,
          type: "object",
          required: ["en_US"],
          properties: {
            tr_TR: {
              type: "string",
              title: "translatable text",
              description: "Text of the row"
            },
            en_US: {
              type: "string",
              title: "translatable text",
              description: "Text of the row"
            }
          }
        }
      }
    } as any);
    // IMPORTANT: Do not remove "as any" otherwise the compiler will hang forever.
  });

  it("should not return anything if invalid objectid is passed", async () => {
    const jsonSchema = await schemaResolver.resolve("absolutely_not_an_objectid");
    expect(jsonSchema).not.toBeTruthy();
  });

  describe("registerPreferenceWatcher", () => {
    let watchSpy: jasmine.Spy<any>;
    let aggregateSpy: jasmine.Spy<any>;

    beforeAll(() => {
      watchSpy = spyOn(bs, "watchPreferences").and.callThrough();
      aggregateSpy = spyOn(bs, "aggregate").and.callThrough();
      registerPreferenceWatcher(bs, validator);
    });

    afterEach(() => {
      watchSpy.calls.reset();
      aggregateSpy.calls.reset();
    });

    it("should handle preference updates", async () => {
      expect(watchSpy).toHaveBeenCalledTimes(1);
      expect(watchSpy).toHaveBeenCalledWith(true);

      //should not remove schemas for initial preferences
      bs["onLanguageUpdated"].next({
        scope: "bucket",
        language: {available: {en_US: "English", tr_TR: "Turkish"}}
      });
      expect(aggregateSpy).toHaveBeenCalledTimes(0);

      //should not remove schemas when there is no change
      bs["onLanguageUpdated"].next({
        scope: "bucket",
        language: {available: {en_US: "English", tr_TR: "Turkish"}}
      });
      expect(aggregateSpy).toHaveBeenCalledTimes(0);

      bs["onLanguageUpdated"].next({
        scope: "bucket",
        language: {available: {en_US: "English"}}
      });
      expect(aggregateSpy).toHaveBeenCalledTimes(1);

      await Promise.resolve();

      expect(validator.removeSchema).toHaveBeenCalledTimes(2);
      expect(validator.removeSchema.calls.allArgs()).toEqual([
        [bucketIds[0].toHexString()],
        [bucketIds[1].toHexString()]
      ]);
    });
  });
});
