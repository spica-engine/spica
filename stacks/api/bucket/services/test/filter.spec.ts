import { createRelationMap } from "@spica-server/bucket/common";
import {
  DefaultExtractor,
  LogicalExtractor,
  extractFilterPropertyMap,
  replaceFilterObjectIds,
  replaceFilterDates
} from "@spica-server/bucket/services/src";
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

      it("should not construct if value is not valid an object id", () => {
        filter._id = "not_id";
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: "not_id"});
      });

      it("should construct object id", () => {
        filter._id = stringId1;
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: objectId1});
      });

      it("should construct object id in nested queries", () => {
        filter["user._id"] = stringId1;
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, "user._id": objectId1});
      });

      it("should construct objectid array", () => {
        filter._id = {$in: [stringId1, stringId2]};
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: {$in: [objectId1, objectId2]}});
      });

      it("should construct if object id is used with operator", () => {
        filter._id = {$eq: stringId1};
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: {$eq: objectId1}});
      });

      it("should construct if object id is used with multiple operators", () => {
        filter._id = {$gt: stringId1, $lt: stringId2};
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, _id: {$gt: objectId1, $lt: objectId2}});
      });

      it("should construct if there is a logical operator", () => {
        const filterBefore = {
          $or: [{...filter, _id: stringId1}, {_id: {$gt: stringId1, $lt: stringId2}}]
        };
        const replacedFilter = replaceFilterObjectIds(filterBefore);
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
          }
        }
      } as any;

      it("should not construct if value is not a valid date", () => {
        filter.due_date = "not_date";
        const replacedFilter = replaceFilterDates(filter, schema);
        expect(replacedFilter).toEqual({...filter, due_date: "not_date"});
      });

      it("should construct date", () => {
        filter.due_date = dueString1;
        const replacedFilter = replaceFilterDates(filter, schema);
        expect(replacedFilter).toEqual({...filter, due_date: dueDate1});
      });

      it("should construct date in nested queries", () => {
        filter["user.created_at"] = dueString1;
        const propMap = extractFilterPropertyMap(filter);
        createRelationMap({paths:propMap,properties:schema.properties,resolve:(id) => Promise.resolve({properties:{}})})
        return;
        const replacedFilter = replaceFilterObjectIds(filter);
        expect(replacedFilter).toEqual({...filter, "user.created_at": dueDate1});
      });

      it("should construct date array", () => {
        filter.due_date = {$in: [dueString1, dueString2]};
        const replacedFilter = replaceFilterDates(filter, schema);
        expect(replacedFilter).toEqual({...filter, due_date: {$in: [dueDate1, dueDate2]}});
      });

      it("should construct if date is used with operator", () => {
        filter.due_date = {$eq: dueString1};
        const replacedFilter = replaceFilterDates(filter, schema);
        expect(replacedFilter).toEqual({...filter, due_date: {$eq: dueDate1}});
      });

      it("should construct if date is used with multiple operators", () => {
        filter.due_date = {$gt: dueString1, $lt: dueString2};
        const replacedFilter = replaceFilterDates(filter, schema);
        expect(replacedFilter).toEqual({...filter, due_date: {$gt: dueDate1, $lt: dueDate2}});
      });

      it("should construct if there is a logical operator", () => {
        const filterBefore = {
          $or: [{...filter, due_date: dueString1}, {due_date: {$gt: dueString1, $lt: dueString2}}]
        };
        const replacedFilter = replaceFilterDates(filterBefore, schema);
        const filterAfter = {
          $or: [{...filter, due_date: dueDate1}, {due_date: {$gt: dueDate1, $lt: dueDate2}}]
        };
        expect(replacedFilter).toEqual(filterAfter);
      });
    });
  });
});
