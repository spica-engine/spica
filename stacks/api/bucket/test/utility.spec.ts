import {
  isRelation,
  isObject,
  findRelations,
  isArray,
  findUpdatedFields,
  getUpdateParams,
  provideLanguageChangeUpdater,
  getUpdatedLanguages
} from "@spica-server/bucket/src/utility";
import {ChangeKind} from "../history/differ";

describe("Utilities", () => {
  it("should check whether schema is object or not", () => {
    let schema = {
      type: "object",
      properties: {
        test: ""
      }
    };
    expect(isObject(schema)).toBe(true);

    schema.type = "string";
    expect(isObject(schema)).toBe(false);
  });

  it("should check whether schema is correct relation or not", () => {
    let schema = {
      type: "relation",
      bucketId: "id1"
    };
    expect(isRelation(schema, "id1")).toEqual(true);

    expect(isRelation(schema, "id2")).toEqual(false);

    schema.type = "object";
    expect(isRelation(schema, "id1")).toEqual(false);
  });

  it("should check whether schema is array or not", () => {
    let schema = {type: "array", items: {type: "string"}};
    expect(isArray(schema)).toBe(true);

    schema.type = "string";
    expect(isArray(schema)).toBe(false);
  });

  it("should find relations", () => {
    let schema = {
      nested_relation: {
        type: "object",
        properties: {
          one_to_one: {type: "relation", bucketId: "id1", relationType: "onetoone"},
          one_to_many: {type: "relation", bucketId: "id1", relationType: "onetomany"},
          not_here: {type: "relation", bucketId: "id2"}
        }
      },
      root_relation: {type: "relation", bucketId: "id1", relationType: "onetoone"},
      not_relation: {type: "string"}
    };
    let targets = findRelations(schema, "id1", "", new Map());

    expect(targets).toEqual(
      new Map([
        ["nested_relation.one_to_one", "onetoone"],
        ["nested_relation.one_to_many", "onetomany"],
        ["root_relation", "onetoone"]
      ])
    );
  });

  it("should find removed and updated keys", () => {
    let previousSchema = {
      title: "test_title",
      description: "test_desc",
      properties: {
        nested_object: {
          type: "object",
          options: {},
          properties: {
            nested_object_child: {
              type: "object",
              properties: {
                removed: {type: "string"},
                updated: {type: "string"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        nested_array_object: {
          type: "array",
          options: {},
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                removed: {type: "string"},
                updated: {type: "string"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        root_removed: {
          type: "string",
          options: {}
        },
        root_updated: {
          type: "string",
          options: {}
        },
        root_not_removed_or_updated: {
          type: "string",
          options: {}
        },
        nested_root_removed: {
          type: "object",
          properties: {
            dont_check_me: {
              type: "string"
            }
          }
        },
        nested_root_updated: {
          type: "object",
          properties: {
            dont_check_me: {
              type: "string"
            }
          }
        }
      }
    };

    let updatedSchema = {
      title: "test_title",
      description: "test_desc",
      properties: {
        nested_object: {
          type: "object",
          options: {},
          properties: {
            nested_object_child: {
              type: "object",
              properties: {
                updated: {type: "boolean"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        nested_array_object: {
          type: "array",
          options: {},
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                updated: {type: "date"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        root_updated: {
          type: "relation",
          options: {}
        },
        root_not_removed_or_updated: {
          type: "string",
          options: {}
        },
        nested_root_updated: {
          type: "number"
        }
      }
    };

    let targetFields = findUpdatedFields(
      previousSchema.properties,
      updatedSchema.properties,
      [],
      ""
    );
    expect(targetFields).toEqual([
      "nested_object.nested_object_child.removed",
      "nested_object.nested_object_child.updated",

      "nested_array_object.$[].$[].removed",
      "nested_array_object.$[].$[].updated",

      "root_removed",
      "root_updated",

      "nested_root_removed",
      "nested_root_updated"
    ]);
  });

  it("should get update operation params for one to one relation", () => {
    const updateParams = getUpdateParams("test_key", "onetoone", "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: "document_id"},
      update: {$unset: {test_key: ""}}
    });
  });

  it("should get update operation params for one to many relation", () => {
    const updateParams = getUpdateParams("test_key", "onetomany", "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: {$in: ["document_id"]}},
      update: {$pull: {test_key: "document_id"}}
    });
  });

  describe("provideLanguageChangeUpdater", () => {
    let updaterFactory;
    let bucketService;
    let bucketDataService;
    let translatableBuckets;

    let aggregate: jasmine.Spy = jasmine.createSpy("aggregate").and.returnValue({
      toArray: () => Promise.resolve(translatableBuckets)
    });
    let updateMany: jasmine.Spy = jasmine
      .createSpy("updateMany")
      .and.returnValue(Promise.resolve());

    beforeAll(() => {
      translatableBuckets = [
        {_id: "bucket1", properties: {title: {}, description: {}}},
        {_id: "bucket2", properties: {name: {}}}
      ];

      bucketService = {
        aggregate
      };
      bucketDataService = {
        updateMany
      };

      updaterFactory = provideLanguageChangeUpdater(bucketService, bucketDataService);
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

    it("should return update bucket entries when language removed", async () => {
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

      expect(aggregate).toHaveBeenCalledTimes(1);
      expect(aggregate).toHaveBeenCalledWith([
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

      expect(updateMany).toHaveBeenCalledTimes(2);
      expect(updateMany.calls.allArgs()).toEqual([
        [
          "bucket1",
          {},
          {$unset: {"title.fr": "", "title.de": "", "description.fr": "", "description.de": ""}}
        ],
        ["bucket2", {}, {$unset: {"name.fr": "", "name.de": ""}}]
      ]);
    });
  });

  describe("getUpdatedLanguages", () => {
    let previousPrefs = {
      language: {
        available: {
          en_US: "English",
          tr_TR: "Turkish"
        }
      }
    };
    let currentPrefs = {
      language: {
        available: {
          en_US: "English",
          fr: "French"
        }
      }
    };
    it("should get all updated languages", () => {
      let updatedLanguages = getUpdatedLanguages(previousPrefs, currentPrefs);
      expect(updatedLanguages).toEqual(["tr_TR", "fr"]);
    });

    it("should get only removed languages", () => {
      let updatedLanguages = getUpdatedLanguages(previousPrefs, currentPrefs, ChangeKind.Delete);
      expect(updatedLanguages).toEqual(["tr_TR"]);
    });

    it("should get only added languages", () => {
      let updatedLanguages = getUpdatedLanguages(previousPrefs, currentPrefs, ChangeKind.Add);
      expect(updatedLanguages).toEqual(["fr"]);
    });
  });
});
