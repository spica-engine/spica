import {
  DefaultExtractor,
  LogicalExtractor,
  extractFilterPropertyMap,
  replaceFilterObjectIds,
  replaceFilterDates
} from "@spica-server/bucket/common";
import {ObjectId} from "@spica-server/database";

describe("Bucket data filter", () => {
  describe("Property map extraction", () => {
    describe("Extractors", () => {
      describe("Default", () => {
        it("should extract property map", () => {
          const expression = {
            "user.name": "name"
          };

          const map = DefaultExtractor.factory(expression);
          expect(map).toEqual([["user", "name"]]);
        });
      });

      describe("Logical", () => {
        it("should extract property map", () => {
          const expression = {
            $or: [
              {
                title: "test"
              },
              {
                "user.name": "name123"
              }
            ]
          };

          const map = LogicalExtractor.factory(expression);
          expect(map).toEqual([["title"], ["user", "name"]]);
        });
      });
    });

    describe("Integrity", () => {
      it("should extract property map from filter which include logical operator", () => {
        const filter = {
          $and: [{description: "test"}, {name: "test123"}]
        };

        const map = extractFilterPropertyMap(filter);

        expect(map).toEqual([["description"], ["name"]]);
      });

      it("should extract property map from filter which include basic equality", () => {
        const filter = {
          "user.name": "name333",
          description: "desc111"
        };

        const map = extractFilterPropertyMap(filter);

        expect(map).toEqual([["user", "name"], ["description"]]);
      });
    });
  });

  describe("filter", () => {
    let filter;

    beforeEach(() => {
      // properties that should be kept as it is
      filter = {
        title: "hey",
        order: 1,
        products: [{type: "book", quantity: 2}],
        "meta.profile_picture": "asdqwe.com"
      };
    });

    describe("ObjectId", () => {
      let objectId1;
      let objectId2;

      let stringId1;
      let stringId2;

      beforeEach(() => {
        objectId1 = new ObjectId();
        objectId2 = new ObjectId();

        stringId1 = objectId1.toString();
        stringId2 = objectId2.toString();
      });

      it("should not construct if value is not a valid object id", async () => {
        filter._id = "not_id";
        const replacedFilter = await replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: "not_id"});
      });

      it("should construct object id", async () => {
        filter._id = stringId1;
        const replacedFilter = await replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: objectId1});
      });

      it("should construct object id in nested queries", async () => {
        filter["user._id"] = stringId1;
        const replacedFilter = await replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, "user._id": objectId1});
      });

      it("should construct objectid array", async () => {
        filter._id = {$in: [stringId1, stringId2]};
        const replacedFilter = await replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: {$in: [objectId1, objectId2]}});
      });

      it("should construct if object id is used with operator", async () => {
        filter._id = {$eq: stringId1};
        const replacedFilter = await replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: {$eq: objectId1}});
      });

      it("should construct if object id is used with multiple operators", async () => {
        filter._id = {$gt: stringId1, $lt: stringId2};
        const replacedFilter = await replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: {$gt: objectId1, $lt: objectId2}});
      });

      it("should construct if there is a logical operator", async () => {
        const filterBefore = {
          $or: [{...filter, _id: stringId1}, {_id: {$gt: stringId1, $lt: stringId2}}]
        };
        const replacedFilter = await replaceFilterObjectIds(filterBefore);
        const filterAfter = {
          $or: [{...filter, _id: objectId1}, {_id: {$gt: objectId1, $lt: objectId2}}]
        };
        expect(replacedFilter).toEqual(filterAfter);
      });
    });

    describe("Date", () => {
      let dueDate1 = new Date(2000, 0, 1, 0, 0, 0, 0);
      let dueDate2 = new Date(2000, 0, 2, 0, 0, 0, 0);

      let dueString1 = "2000-01-01T00:00:00.000Z";
      let dueString2 = "2000-01-02T00:00:00.000Z";

      let schema = {
        properties: {
          due_date: {
            type: "date"
          },
          user: {
            type: "object",
            properties: {
              created_at: {
                type: "date"
              }
            }
          },
          login_dates: {
            type: "array",
            items: {
              type: "date"
            }
          },
          meta: {
            type: "object",
            properties: {
              photos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    created_at: {
                      type: "date"
                    }
                  }
                }
              }
            }
          },
          addresses: {
            type: "relation",
            bucketId: "address_bucket_id",
            relationType: "onetomany"
          }
        }
      } as any;

      let addressSchema = {
        _id: "address_bucket_id",
        properties: {
          built_at: {
            type: "date"
          }
        }
      };

      const schemas = [schema, addressSchema];
      const resolve = id => {
        return Promise.resolve(schemas.find(s => s._id == id) as any);
      };

      it("should not construct if value is not a valid date", async () => {
        filter.due_date = "not_date";
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: "not_date"});
      });

      it("should construct date", async () => {
        filter.due_date = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: dueDate1});
      });

      it("should construct date in nested queries", async () => {
        filter["user.created_at"] = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, "user.created_at": dueDate1});
      });

      it("should construct dates in array", async () => {
        filter.login_dates = [dueString1];
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, login_dates: [dueDate1]});
      });

      it("should construct dates in object array", async () => {
        filter["meta.photos.created_at"] = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, "meta.photos.created_at": dueDate1});
      });

      it("should construct date array", async () => {
        filter.due_date = {$in: [dueString1, dueString2]};
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: {$in: [dueDate1, dueDate2]}});
      });

      it("should construct if date is used with operator", async () => {
        filter.due_date = {$eq: dueString1};
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: {$eq: dueDate1}});
      });

      it("should construct if date is used with multiple operators", async () => {
        filter.due_date = {$gt: dueString1, $lt: dueString2};
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, due_date: {$gt: dueDate1, $lt: dueDate2}});
      });

      it("should construct if there is a logical operator", async () => {
        const filterBefore = {
          $or: [{...filter, due_date: dueString1}, {due_date: {$gt: dueString1, $lt: dueString2}}]
        };
        const replacedFilter = await replaceFilterDates(filterBefore, schema, resolve);
        const filterAfter = {
          $or: [{...filter, due_date: dueDate1}, {due_date: {$gt: dueDate1, $lt: dueDate2}}]
        };
        expect(replacedFilter).toEqual(filterAfter);
      });

      it("should construct date for related buckets", async () => {
        filter["addresses.built_at"] = dueString1;
        const replacedFilter = await replaceFilterDates(filter, schema, resolve);
        expect(replacedFilter).toEqual({...filter, "addresses.built_at": dueDate1});
      });
    });
  });
});
