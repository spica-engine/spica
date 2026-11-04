import {provideLanguageFinalizer} from "@spica-server/bucket-common";

describe("provideLanguageChangeUpdater", () => {
  const translatableBuckets = [
    {_id: "bucket1", properties: {title: {}, description: {}}},
    {_id: "bucket2", properties: {name: {}}}
  ];

  const bucketData: any = {
    unsetFields: jest.fn(() => Promise.resolve())
  };

  const buckets: any = {
    findTranslatable: jest.fn(() => Promise.resolve(translatableBuckets))
  };

  const updaterFactory = provideLanguageFinalizer(buckets, bucketData);

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

    expect(buckets.findTranslatable).toHaveBeenCalledTimes(1);

    expect(bucketData.unsetFields).toHaveBeenCalledTimes(2);
    expect(bucketData.unsetFields.mock.calls).toEqual([
      [
        translatableBuckets[0],
        [
          ["title", "fr"],
          ["title", "de"],
          ["description", "fr"],
          ["description", "de"]
        ]
      ],
      [
        translatableBuckets[1],
        [
          ["name", "fr"],
          ["name", "de"]
        ]
      ]
    ]);
  });
});
