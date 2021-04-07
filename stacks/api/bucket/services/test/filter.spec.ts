import {
  DefaultExtractor,
  LogicalExtractor,
  extractFilterPropertyMap
} from "@spica-server/bucket/services/src";

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
});
