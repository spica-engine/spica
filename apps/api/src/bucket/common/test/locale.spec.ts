import {provideLanguageFinalizer} from "@spica-server/bucket/common";

describe("provideLanguageChangeUpdater", () => {
  let childrenSpy: jest.SpyInstance;
  const translatableBuckets = [
    {_id: "bucket1", properties: {title: {}, description: {}}},
    {_id: "bucket2", properties: {name: {}}}
  ];

  const bucketDataService: any = {
    updateMany: jest.fn(() => Promise.resolve()),
    children: schema => bucketDataService
  };

  const bucketService: any = {
    aggregate: jest.fn(() => ({
      toArray: () => Promise.resolve(translatableBuckets)
    }))
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

    expect(bucketService.aggregate).toHaveBeenCalledTimes(1);
    expect(bucketService.aggregate).toHaveBeenCalledWith([
      {
        $project: {
          properties: {
            $objectToArray: "$properties"
          }
        }
      },
      {
        $match: {
          "properties.v.options.translate": true
        }
      },
      {
        $project: {
          properties: {
            $filter: {
              input: "$properties",
              as: "property",
              cond: {$eq: ["$$property.v.options.translate", true]}
            }
          }
        }
      },
      {
        $project: {
          properties: {
            $arrayToObject: "$properties"
          }
        }
      }
    ]);

    expect(childrenSpy).toHaveBeenCalledTimes(2);
    expect(childrenSpy.mock.calls).toEqual([[translatableBuckets[0]], [translatableBuckets[1]]]);

    expect(bucketDataService.updateMany).toHaveBeenCalledTimes(2);
    expect(bucketDataService.updateMany.mock.calls).toEqual([
      [{}, {$unset: {"title.fr": "", "title.de": "", "description.fr": "", "description.de": ""}}],
      [{}, {$unset: {"name.fr": "", "name.de": ""}}]
    ]);
  });
});
