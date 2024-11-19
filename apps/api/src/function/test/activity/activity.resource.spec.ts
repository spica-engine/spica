import {Action} from "@spica-server/activity/services";
import {createFunctionActivity} from "@spica-server/function/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "function_id"
    };

    const activities = createFunctionActivity(
      {action: Action.POST, identifier: "test_user"},
      {},
      res
    );
    expect(activities).toEqual([
      {action: Action.POST, identifier: "test_user", resource: ["function", "function_id"]}
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "function_id"
      }
    };

    const activities = createFunctionActivity(
      {action: Action.PUT, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_user", resource: ["function", "function_id"]}
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "function_id"
      }
    };

    const activities = createFunctionActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.DELETE, identifier: "test_user", resource: ["function", "function_id"]}
    ]);
  });
});
