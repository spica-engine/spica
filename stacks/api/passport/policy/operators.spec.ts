import {
  getStatementResult,
  createLastState,
  wrapArray,
  policyAggregation,
  createLastDecision
} from "./operators";
import {Statement} from "./interface";
import {ObjectId} from "@spica-server/database";

describe("ActionGuard Operators", () => {
  describe("wrapper", () => {
    it("should convert string to string array", () => {
      expect(wrapArray("test")).toEqual(["test"]);
    });
    it("should not change string array", () => {
      expect(wrapArray(["test"])).toEqual(["test"]);
    });
  });

  describe("statement results", () => {
    it("should return true when the resource is * and pass the state to the headers", () => {
      let request = {
        headers: {}
      };
      const statements: Statement[] = [
        {
          action: "function:index",
          effect: "allow",
          resource: "*",
          service: "function"
        }
      ];
      const action = "function:index";
      const resource = "function/";
      expect(getStatementResult(request, statements, action, resource)).toEqual(true);
      expect(request.headers["resource-state"]).toEqual({alloweds: ["*"], denieds: []});
    });

    it("should return false when there is no allowed resources", () => {
      let request = {
        headers: {}
      };
      const statements: Statement[] = [
        {
          action: "passport:apikey:index",
          effect: "allow",
          resource: [],
          service: "passport/apikey"
        }
      ];
      const action = "passport:apikey:index";
      const resource = "passport/apikey";
      expect(getStatementResult(request, statements, action, resource)).toEqual(false);
    });

    it("should return true if action is create and allowed", () => {
      let request = {
        headers: {}
      };
      const statements: Statement[] = [
        {
          action: "function:create",
          effect: "allow",
          resource: [],
          service: "function"
        }
      ];
      const action = "function:create";
      const resource = "function/";
      expect(getStatementResult(request, statements, action, resource)).toEqual(true);
    });

    it("should return true if allowed and requested resource matches", () => {
      let request = {
        headers: {}
      };
      const statements: Statement[] = [
        {
          action: "bucket:data:index",
          effect: "allow",
          resource: ["test"],
          service: "bucket:data"
        }
      ];
      const action = "bucket:data:index";
      const resource = "bucket:data/test";
      expect(getStatementResult(request, statements, action, resource)).toEqual(true);
    });

    it("should return false if denied and requested resource matches", () => {
      let request = {
        headers: {}
      };
      const statements: Statement[] = [
        {
          action: "bucket:data:index",
          effect: "deny",
          resource: ["test"],
          service: "bucket:data"
        }
      ];
      const action = "bucket:data:index";
      const resource = "bucket:data/test";
      expect(getStatementResult(request, statements, action, resource)).toEqual(false);
    });
  });

  describe("createLastDecision", () => {
    it("should return true", () => {
      expect(
        createLastDecision([{action: "test", service: "test", effect: "allow", resource: "test"}])
      ).toEqual(true);
    });

    it("should return false", () => {
      expect(
        createLastDecision([
          {action: "test", service: "test", effect: "allow", resource: "test"},
          {action: "test", service: "test", effect: "deny", resource: "test"}
        ])
      ).toEqual(false);
    });
  });

  describe("createLastState", () => {
    it("should return allow all", () => {
      expect(
        createLastState([{resource: "*", effect: "allow", service: "test", action: "test"}])
      ).toEqual({alloweds: ["*"], denieds: []});
    });

    it("should return deny all", () => {
      expect(
        createLastState([{resource: "*", effect: "deny", service: "test", action: "test"}])
      ).toEqual({alloweds: [], denieds: ["*"]});
    });

    it("should return allow all and deny 'test'", () => {
      expect(
        createLastState([
          {resource: "*", effect: "allow", service: "test", action: "test"},
          {resource: "test", effect: "deny", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: ["*"], denieds: ["test"]});
    });

    it("should return deny all and allow 'test'", () => {
      expect(
        createLastState([
          {resource: "*", effect: "deny", service: "test", action: "test"},
          {resource: "test", effect: "allow", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: ["test"], denieds: ["*"]});
    });

    it("should move resource from alloweds to denieds", () => {
      expect(
        createLastState([
          {resource: ["test", "test2"], effect: "allow", service: "test", action: "test"},
          {resource: "test", effect: "deny", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: ["test2"], denieds: ["test"]});
    });

    it("should move resource from denieds to alloweds", () => {
      expect(
        createLastState([
          {resource: ["test", "test2"], effect: "deny", service: "test", action: "test"},
          {resource: "test", effect: "allow", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: ["test"], denieds: ["test2"]});
    });

    it("should clear denied resources and insert allow all", () => {
      expect(
        createLastState([
          {resource: "test", effect: "deny", service: "test", action: "test"},
          {resource: "*", effect: "allow", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: ["*"], denieds: []});
    });

    it("should clear allowed resources and insert deny all", () => {
      expect(
        createLastState([
          {resource: "test", effect: "allow", service: "test", action: "test"},
          {resource: "*", effect: "deny", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: [], denieds: ["*"]});
    });

    it("should not override alloweds", () => {
      expect(
        createLastState([
          {resource: "*", effect: "allow", service: "test", action: "test"},
          {resource: "test", effect: "allow", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: ["*"], denieds: []});
    });

    it("should not override denieds", () => {
      expect(
        createLastState([
          {resource: "*", effect: "deny", service: "test", action: "test"},
          {resource: "test", effect: "deny", service: "test", action: "test"}
        ])
      ).toEqual({alloweds: [], denieds: ["*"]});
    });
  });

  describe("policyAggregation", () => {
    let allowedId;
    let deniedId;
    beforeAll(() => {
      allowedId = new ObjectId();
      deniedId = new ObjectId();
    });
    it("should return empty aggregation if allowed all", () => {
      expect(policyAggregation({alloweds: ["*"], denieds: []})).toEqual([]);
    });

    it("should return aggregation if denied resource exists", () => {
      expect(policyAggregation({alloweds: [], denieds: [deniedId]})).toEqual([
        {
          $match: {
            _id: {
              $nin: [deniedId]
            }
          }
        }
      ]);
    });

    it("should return aggregation if allowed resource exists", () => {
      expect(policyAggregation({alloweds: [allowedId], denieds: []})).toEqual([
        {
          $match: {
            _id: {
              $in: [allowedId]
            }
          }
        }
      ]);
    });

    it("should return aggregation if allowed and denied resources exist", () => {
      expect(policyAggregation({alloweds: [allowedId], denieds: [deniedId]})).toEqual([
        {
          $match: {
            _id: {
              $in: [allowedId],
              $nin: [deniedId]
            }
          }
        }
      ]);
    });
  });
});
