import {provideLanguageFinalizer} from "@spica-server/bucket-common";

describe("provideLanguageChangeUpdater", () => {
  let childrenSpy: jest.SpyInstance;
  /**
   * The fixture now carries **genuinely** translatable fields.
   *
   * It used to write `properties: {title: {}}` and none of them declared `options.translate`; because the
   * filtering happened inside a mocked aggregation, it made no difference. Once the filtering moved to the
   * application layer (`hasTranslatedProperties`) the fixture had to live up to its own name.
   */
  const translate = {options: {translate: true}};
  const translatableBuckets = [
    {_id: "bucket1", properties: {title: {...translate}, description: {...translate}}},
    {_id: "bucket2", properties: {name: {...translate}}}
  ];

  const bucketDataService: any = {
    updateMany: jest.fn(() => Promise.resolve()),
    children: schema => bucketDataService
  };

  /**
   * `find`, NOT `aggregate`: the `$objectToArray` chain that ran to find the translatable buckets was
   * removed and the filtering moved to the application layer. That chain's only job was asking the
   * database for something the schema already contains.
   */
  const bucketService: any = {
    find: jest.fn(() => Promise.resolve(translatableBuckets))
  };

  const updaterFactory = provideLanguageFinalizer(bucketService, bucketDataService);

  beforeAll(() => {
    childrenSpy = jest.spyOn(bucketDataService, "children");
  });

  afterEach(() => {
    childrenSpy.mockClear();
  });

  it("should return updater function", () => {
    expect(typeof updaterFactory == "function").toBe(true);
  });

  it("should return empty promise when language added", () => {
    updaterFactory(
      {
        language: {
          available: {
            en_US: "English"
          }
        }
      },
      {
        language: {
          available: {
            en_US: "English",
            tr_TR: "Turkish"
          }
        }
      }
    ).then(result => expect(result).toBeUndefined());
  });

  it("should update bucket entries when language removed", async () => {
    await updaterFactory(
      {
        language: {
          available: {
            en_US: "English",
            tr_TR: "Turkish",
            fr: "French",
            de: "Deutschland"
          }
        }
      },
      {
        language: {
          available: {
            en_US: "English",
            tr_TR: "Turkish"
          }
        }
      }
    );

    // A single read; the filtering is in the application layer.
    expect(bucketService.find).toHaveBeenCalledTimes(1);

    expect(childrenSpy).toHaveBeenCalledTimes(2);
    expect(childrenSpy.mock.calls).toEqual([[translatableBuckets[0]], [translatableBuckets[1]]]);

    expect(bucketDataService.updateMany).toHaveBeenCalledTimes(2);
    expect(bucketDataService.updateMany.mock.calls).toEqual([
      [{}, {$unset: {"title.fr": "", "title.de": "", "description.fr": "", "description.de": ""}}],
      [{}, {$unset: {"name.fr": "", "name.de": ""}}]
    ]);
  });
});
