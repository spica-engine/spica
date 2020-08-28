import {Action} from "@spica-server/activity/services";
import {createIdentityActivity} from "@spica-server/passport/identity/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "identity_id"
    };

    const activities = createIdentityActivity(
      {action: Action.POST, identifier: "test_user"},
      {},
      res
    );
    expect(activities).toEqual([
      {
        action: Action.POST,
        identifier: "test_user",
        resource: ["passport", "identity", "identity_id"]
      }
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "identity_id"
      }
    };

    const activities = createIdentityActivity(
      {action: Action.PUT, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.PUT,
        identifier: "test_user",
        resource: ["passport", "identity", "identity_id"]
      }
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "identity_id"
      }
    };

    const activities = createIdentityActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "identity", "identity_id"]
      }
    ]);
  });

  it("should return activity from policy update request", () => {
    const req = {
      params: {
        id: "identity_id"
      },
      body: ["policy1", "policy2"]
    };

    const activities = createIdentityActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "identity", "identity_id"]
      }
    ]);
  });
});
