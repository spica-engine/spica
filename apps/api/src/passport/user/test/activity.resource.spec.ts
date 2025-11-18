import {Action} from "@spica-server/interface/activity";
import {createUserActivity} from "@spica-server/passport/user/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "user_id"
    };

    const activities = createUserActivity({action: Action.POST, identifier: "test_user"}, {}, res);
    expect(activities).toEqual([
      {
        action: Action.POST,
        identifier: "test_user",
        resource: ["passport", "user", "user_id"]
      }
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "user_id"
      }
    };

    const activities = createUserActivity({action: Action.PUT, identifier: "test_user"}, req, {});
    expect(activities).toEqual([
      {
        action: Action.PUT,
        identifier: "test_user",
        resource: ["passport", "user", "user_id"]
      }
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "user_id"
      }
    };

    const activities = createUserActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "user", "user_id"]
      }
    ]);
  });

  it("should return activity from policy update request", () => {
    const req = {
      params: {
        id: "user_id"
      },
      body: ["policy1", "policy2"]
    };

    const activities = createUserActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["passport", "user", "user_id"]
      }
    ]);
  });
});
