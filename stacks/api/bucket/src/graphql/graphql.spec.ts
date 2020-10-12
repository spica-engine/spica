import {AggregationExtractor} from "./graphql";

describe("GraphQL", () => {
  describe("AggregationExtractor", () => {
    it("should cast input from string to date", () => {
      const now = new Date().toString();
      let castedNow = AggregationExtractor.castToOriginalType(now, {type: "date"});
    });
  });
});
