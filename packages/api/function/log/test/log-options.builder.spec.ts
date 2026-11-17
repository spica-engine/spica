import {LogOptionsBuilder} from "../src/log-options.builder";

const request = (query: URLSearchParams) => ({query});

describe("LogOptionsBuilder", () => {
  const query = () => {
    const params = new URLSearchParams();
    params.append("functions", "f1");
    params.append("functions", "f2");
    params.set("begin", "2020-01-02T03:04:05.678Z");
    params.set("content", "error");
    params.set("sort", '{"created_at":-1}');
    params.set("limit", "10");
    return params;
  };

  describe("for MongoDB", () => {
    it("should build a MongoDB filter", () => {
      const options = LogOptionsBuilder.fromLogQuery(request(query()));

      expect(options).toEqual({
        filter: {
          function: {$in: ["f1", "f2"]},
          created_at: {$gte: new Date("2020-01-02T03:04:05.000Z")},
          content: {$regex: "error", $options: "i"}
        },
        sort: {created_at: -1},
        limit: 10
      });
    });
  });

  describe("for an engine that filters with expressions", () => {
    it("should build conditions instead of a filter", () => {
      const options = LogOptionsBuilder.fromLogQuery(request(query()), "expression");

      expect(options.filter).toBeUndefined();
      expect(options).toEqual({
        where: {function: {in: ["f1", "f2"]}, content: {matches: "error", caseInsensitive: true}},
        createdBetween: {from: new Date("2020-01-02T03:04:05.000Z"), to: new Date(8.64e15)},
        sort: {created_at: -1},
        limit: 10
      });
    });

    it("should start from now when no begin is given and tell the request", () => {
      const params = new URLSearchParams();
      const before = Date.now();

      const options = LogOptionsBuilder.fromLogQuery(request(params), "expression");

      expect(options.createdBetween.from.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(options.createdBetween.from.getMilliseconds()).toBe(0);
      expect(options.where).toBeUndefined();
      expect(params.get("begin")).toBeDefined();
    });
  });
});
