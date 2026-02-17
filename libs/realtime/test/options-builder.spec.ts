import {RealtimeOptionsBuilder, RealtimeOptionsError} from "../src/options-builder";

describe("RealtimeOptionsError", () => {
  it("should create error with statusCode and message", () => {
    const error = new RealtimeOptionsError(400, "Invalid input");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Invalid input");
    expect(error.name).toBe("RealtimeOptionsError");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("RealtimeOptionsBuilder", () => {
  describe("applyResourceFilter", () => {
    it("should initialize filter with $and array and push resource filter $match", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.applyResourceFilter({$match: {owner: "user1"}}).result();

      expect(result).toEqual({
        filter: {$and: [{owner: "user1"}]}
      });
    });

    it("should use empty $match when resourceFilter is undefined", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.applyResourceFilter(undefined).result();

      expect(result).toEqual({
        filter: {$and: [{}]}
      });
    });

    it("should use empty $match when resourceFilter is null", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.applyResourceFilter(null).result();

      expect(result).toEqual({
        filter: {$and: [{}]}
      });
    });
  });

  describe("filter", () => {
    it("should parse valid JSON filter and push to $and array when resource filter exists", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder
        .applyResourceFilter({$match: {owner: "user1"}})
        .filter('{"status": "active"}')
        .result();

      expect(result).toEqual({
        filter: {$and: [{owner: "user1"}, {status: "active"}]}
      });
    });

    it("should create $and array if no resource filter was applied", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.filter('{"status": "active"}').result();

      expect(result).toEqual({
        filter: {$and: [{status: "active"}]}
      });
    });

    it("should throw RealtimeOptionsError for invalid JSON", () => {
      const builder = new RealtimeOptionsBuilder();

      expect(() => builder.filter("{invalid}")).toThrowError(RealtimeOptionsError);

      try {
        builder.filter("{invalid}");
      } catch (e) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain("Invalid filter");
      }
    });
  });

  describe("sort", () => {
    it("should parse valid JSON sort", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.sort('{"created_at": -1}').result();

      expect(result).toEqual({sort: {created_at: -1}});
    });

    it("should throw RealtimeOptionsError for invalid JSON", () => {
      const builder = new RealtimeOptionsBuilder();

      expect(() => builder.sort("{invalid}")).toThrowError(RealtimeOptionsError);

      try {
        builder.sort("{invalid}");
      } catch (e) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toContain("Invalid sort");
      }
    });
  });

  describe("limit", () => {
    it("should parse valid numeric limit", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.limit("10").result();

      expect(result).toEqual({limit: 10});
    });

    it("should accept zero as a valid limit", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.limit("0").result();

      expect(result).toEqual({limit: 0});
    });

    it("should throw RealtimeOptionsError for NaN limit", () => {
      const builder = new RealtimeOptionsBuilder();

      expect(() => builder.limit("abc")).toThrowError(RealtimeOptionsError);

      try {
        builder.limit("abc");
      } catch (e) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toBe("Invalid limit parameter");
      }
    });

    it("should throw RealtimeOptionsError for negative limit", () => {
      const builder = new RealtimeOptionsBuilder();

      expect(() => builder.limit("-5")).toThrowError(RealtimeOptionsError);
    });
  });

  describe("skip", () => {
    it("should parse valid numeric skip", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.skip("20").result();

      expect(result).toEqual({skip: 20});
    });

    it("should accept zero as a valid skip", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder.skip("0").result();

      expect(result).toEqual({skip: 0});
    });

    it("should throw RealtimeOptionsError for NaN skip", () => {
      const builder = new RealtimeOptionsBuilder();

      expect(() => builder.skip("abc")).toThrowError(RealtimeOptionsError);

      try {
        builder.skip("abc");
      } catch (e) {
        expect(e.statusCode).toBe(400);
        expect(e.message).toBe("Invalid skip parameter");
      }
    });

    it("should throw RealtimeOptionsError for negative skip", () => {
      const builder = new RealtimeOptionsBuilder();

      expect(() => builder.skip("-3")).toThrowError(RealtimeOptionsError);
    });
  });

  describe("setFilter", () => {
    it("should set filter directly on options", () => {
      const builder = new RealtimeOptionsBuilder();
      const filter = {created_at: {$gte: new Date("2025-01-01")}};
      const result = builder.setFilter(filter).result();

      expect(result).toEqual({filter});
    });
  });

  describe("chaining", () => {
    it("should support full chain of resource filter + filter + sort + limit + skip", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder
        .applyResourceFilter({$match: {owner: "user1"}})
        .filter('{"status": "active"}')
        .sort('{"created_at": -1}')
        .limit("10")
        .skip("5")
        .result();

      expect(result).toEqual({
        filter: {$and: [{owner: "user1"}, {status: "active"}]},
        sort: {created_at: -1},
        limit: 10,
        skip: 5
      });
    });

    it("should support sort + limit + skip without filter", () => {
      const builder = new RealtimeOptionsBuilder();
      const result = builder
        .sort('{"name": 1}')
        .limit("25")
        .skip("0")
        .result();

      expect(result).toEqual({
        sort: {name: 1},
        limit: 25,
        skip: 0
      });
    });
  });

  describe("fromQuery", () => {
    function createMockReq(queryParams: Record<string, string | string[]>, resourceFilter?: any) {
      const query = new Map<string, string | string[]>();
      for (const [key, value] of Object.entries(queryParams)) {
        query.set(key, Array.isArray(value) ? value[0] : value);
      }

      return {
        query: {
          has: (key: string) => query.has(key),
          get: (key: string) => query.get(key),
          getAll: (key: string) => {
            const val = queryParams[key];
            return Array.isArray(val) ? val : [val];
          },
          set: (key: string, value: any) => query.set(key, value)
        },
        resourceFilter
      };
    }

    it("should build options with resource filter and sort/limit/skip", () => {
      const req = createMockReq(
        {sort: '{"name": 1}', limit: "10", skip: "5"},
        {$match: {owner: "user1"}}
      );

      const result = RealtimeOptionsBuilder.fromQuery(req, {useResourceFilter: true});

      expect(result).toEqual({
        filter: {$and: [{owner: "user1"}]},
        sort: {name: 1},
        limit: 10,
        skip: 5
      });
    });

    it("should build options with resource filter and user filter", () => {
      const req = createMockReq({filter: '{"status": "active"}'}, {$match: {owner: "user1"}});

      const result = RealtimeOptionsBuilder.fromQuery(req, {
        useResourceFilter: true,
        useFilter: true
      });

      expect(result).toEqual({
        filter: {$and: [{owner: "user1"}, {status: "active"}]}
      });
    });

    it("should build options with only filter when no resource filter", () => {
      const req = createMockReq({filter: '{"status": "active"}'});

      const result = RealtimeOptionsBuilder.fromQuery(req, {useFilter: true});

      expect(result).toEqual({
        filter: {$and: [{status: "active"}]}
      });
    });

    it("should build empty options when no query params", () => {
      const req = createMockReq({});

      const result = RealtimeOptionsBuilder.fromQuery(req);

      expect(result).toEqual({});
    });

    it("should throw RealtimeOptionsError for invalid sort in fromQuery", () => {
      const req = createMockReq({sort: "{invalid}"});

      expect(() => RealtimeOptionsBuilder.fromQuery(req)).toThrowError(RealtimeOptionsError);
    });

    it("should throw RealtimeOptionsError for invalid filter in fromQuery", () => {
      const req = createMockReq({filter: "{invalid}"});

      expect(() => RealtimeOptionsBuilder.fromQuery(req, {useFilter: true})).toThrowError(
        RealtimeOptionsError
      );
    });

    it("should throw RealtimeOptionsError for invalid limit in fromQuery", () => {
      const req = createMockReq({limit: "not_a_number"});

      expect(() => RealtimeOptionsBuilder.fromQuery(req)).toThrowError(RealtimeOptionsError);
    });

    it("should throw RealtimeOptionsError for invalid skip in fromQuery", () => {
      const req = createMockReq({skip: "not_a_number"});

      expect(() => RealtimeOptionsBuilder.fromQuery(req)).toThrowError(RealtimeOptionsError);
    });
  });
});
