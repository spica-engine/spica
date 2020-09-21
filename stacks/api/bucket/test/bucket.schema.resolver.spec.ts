import {Test, TestingModule} from "@nestjs/testing";
import {BucketService} from "@spica-server/bucket/services";
import {SchemaModule} from "@spica-server/core/schema";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {BucketSchemaResolver} from "@spica-server/bucket/src/bucket.schema.resolver";
import {Subject, Observable} from "rxjs";
import {take, skip} from "rxjs/operators";

describe("Bucket Schema Resolver", () => {
  class MockBucketService {
    onLanguageUpdated = new Subject();
    constructor() {}
    findOne() {}
    getPreferences() {}
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

  beforeAll(async () => {
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

  it("should resolve schema when uri provided", async () => {
    const schemaObservable = schemaResolver.resolve(bucket._id.toHexString());
    schemaObservable.pipe(take(1)).subscribe(schema => {
      expect(schema).toEqual({
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
  });

  it("should update schema when language removed", async () => {
    const schemaObservable = schemaResolver.resolve(bucket._id.toHexString());

    schemaObservable
      .pipe(
        take(2),
        skip(1)
      )
      .subscribe(schema => {
        expect(schema).toEqual({
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
        } as any);
        // IMPORTANT: Do not remove "as any" otherwise the compiler will hang forever.
      });

    await Promise.resolve();

    bs["onLanguageUpdated"].next({
      language: {
        available: {
          en_US: "English"
        },
        default: "en_US"
      }
    });
  });
});
