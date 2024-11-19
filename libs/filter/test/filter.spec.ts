import {
  DefaultExtractor,
  extractFilterPropertyMap,
  LogicalExtractor,
  replaceFilterObjectIds
} from "@spica/filter";
import {ObjectId} from "@spica-server/database";

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
});
