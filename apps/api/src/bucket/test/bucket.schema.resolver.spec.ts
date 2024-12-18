import {Test, TestingModule} from "@nestjs/testing";
import {BucketService} from "@spica-server/bucket/services";
import {BucketSchemaResolver} from "@spica-server/bucket/src/bucket.schema.resolver";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {Observable, Subject} from "rxjs";
import {bufferCount, take} from "rxjs/operators";

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
        options: {position: "left"}
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
        options: {position: "left", translate: true}
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
    jest.spyOn(bs, "findOne").mockReturnValue(Promise.resolve({...bucket}) as any);
    jest.spyOn(bs, "getPreferences").mockReturnValue(Promise.resolve(preference) as any);
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
});
