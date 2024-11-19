import {Action} from "@spica/api/src/activity/services";
import {createPolicyActivity} from "@spica/api/src/passport/policy/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "policy_id"
    };

    const activities = createPolicyActivity(
      {action: Action.POST, identifier: "test_user"},
      {},
      res
    );
    expect(activities).toEqual([
      {
        action: Action.POST,
        identifier: "test_user",
        resource: ["passport", "policy", "policy_id"]
      }
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "policy_id"
      }
    };

    const activities = createPolicyActivity({action: Action.PUT, identifier: "test_user"}, req, {});
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_user", resource: ["passport", "policy", "policy_id"]}
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "policy_id"
      }
    };

    const activities = createPolicyActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "policy", "policy_id"]
      }
    ]);
  });
});
