import {Test, TestingModule} from "@nestjs/testing";
import {BucketService} from "@spica-server/bucket/services";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {
  BucketSchemaResolver,
  provideBucketSchemaResolver,
  getCustomKeywords
} from "@spica-server/bucket/src/bucket.schema.resolver";
import {Subject, Observable} from "rxjs";
import {take, bufferCount} from "rxjs/operators";

describe("Bucket Schema Resolver", () => {
  class MockBucketService {
    onLanguageUpdated = new Subject();
    onBucketUpdated = new Subject();
    constructor() {}
    findOne() {}
    getPreferences() {}
    watch(bucketId: string, propagateOnStart: boolean) {
      return new Observable(observer => {
        if (propagateOnStart) {
          Promise.resolve(observer.next(bucket));
        }
        this.onBucketUpdated.subscribe(bucket => observer.next(bucket));
      });
    }
    watchPreferences(propagateOnStart: boolean) {
      return new Observable(observer => {
        if (propagateOnStart) {
          observer.next(preference);
        }
        this.onLanguageUpdated.subscribe(prefs => {
          observer.next(prefs);
        });
      });
    }
  }

  let module: TestingModule;
  let schemaResolver: BucketSchemaResolver;
  let bs: BucketService;

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

  beforeEach(async () => {
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

  afterEach(async () => await module.close());

  it("should resolve initial schema and update schema when preference and bucket changed", () => {
    bs["onLanguageUpdated"].next({
      language: {
        available: {
          en_US: "English"
        },
        default: "en_US"
      }
    });

    let updatedBucket = bucket;
    delete updatedBucket.properties.text;
    bs["onBucketUpdated"].next(updatedBucket);

    expectAsync(
      schemaResolver
        .resolve(bucket._id.toHexString())
        .pipe(
          take(3),
          bufferCount(3)
        )
        .toPromise()
    ).toBeResolvedTo([
      //initial schema
      {
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
      } as any,
      //preference updates
      {
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
              en_US: {
                type: "string",
                title: "translatable text",
                description: "Text of the row"
              }
            }
          }
        }
      } as any,
      //bucket updates
      {
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
          }
        }
      } as any
    ]);
    // IMPORTANT: Do not remove "as any" otherwise the compiler will hang forever.
  });

  describe("provideBucketSchemaResolver", () => {
    let validator;
    let bucketService;
    beforeEach(() => {
      validator = {
        registerUriResolver: jasmine.createSpy("registerUriResolver"),
        registerKeyword: jasmine.createSpy("registerKeyword"),
        _defaults: {
          get: jasmine.createSpy("_defaults.get").and.returnValue(undefined)
        }
      };
      bucketService = {
        watchPreferences: jasmine.createSpy("watchPreferences"),
        watch: jasmine.createSpy("watch")
      };
    });
    it("should register uri resolver and keyword", () => {
      let resolver = provideBucketSchemaResolver(validator as any, bucketService as any);

      expect(resolver).toEqual(jasmine.any(BucketSchemaResolver));

      expect(validator.registerUriResolver).toHaveBeenCalledTimes(1);
      expect(validator.registerUriResolver).toEqual(jasmine.any(Function));

      expect(validator.registerKeyword).toHaveBeenCalledTimes(2);
      expect(validator.registerKeyword.calls.first().args[0]).toEqual(
        "default",
        "should work when custom default keyword registered "
      );
    });

    it("should put default value", () => {
      let compile = getCustomKeywords(validator)[0].def.compile;

      let defaultValue = "default_value";
      let bucketProperty = {type: "string", readOnly: true, default: "default_value"};
      let sendedValue = "new_value";
      let sendedData = {field: "new_value", field2: "test"};

      let logic = compile(defaultValue, bucketProperty, {dataLevel: 1});

      logic(sendedValue, ".field", sendedData);

      expect(sendedData).toEqual({field: "default_value", field2: "test"});
    });
  });
});
