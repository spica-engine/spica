import {Action} from "@spica-server/interface/activity";
import {createEnvVarActivity} from "../src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "env_var_id"
    };

    const activities = createEnvVarActivity(
      {action: Action.POST, identifier: "test_user"},
      {},
      res
    );
    expect(activities).toEqual([
      {action: Action.POST, identifier: "test_user", resource: ["env_var", "env_var_id"]}
    ]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "env_var_id"
      }
    };

    const activities = createEnvVarActivity({action: Action.PUT, identifier: "test_user"}, req, {});
    expect(activities).toEqual([
      {action: Action.PUT, identifier: "test_user", resource: ["env_var", "env_var_id"]}
    ]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "env_var_id"
      }
    };

    const activities = createEnvVarActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.DELETE, identifier: "test_user", resource: ["env_var", "env_var_id"]}
    ]);
  });
});
