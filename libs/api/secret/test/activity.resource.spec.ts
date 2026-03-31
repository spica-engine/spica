import {Action} from "@spica-server/interface/activity";
import {createSecretActivity} from "../src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "secret_id"
    };

    const activities = createSecretActivity(
      {action: Action.POST, identifier: "test_user"},
      {},
      res
    );
    expect(activities).toEqual([
      {action: Action.POST, identifier: "test_user", resource: ["secret", "secret_id"]}
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "secret_id"
      }
    };

    const activities = createSecretActivity({action: Action.PUT, identifier: "test_user"}, req, {});
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_user", resource: ["secret", "secret_id"]}
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "secret_id"
      }
    };

    const activities = createSecretActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.DELETE, identifier: "test_user", resource: ["secret", "secret_id"]}
    ]);
  });
});
