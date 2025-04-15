import {Action} from "@spica-server/activity/services";
import {
  createFunctionActivity,
  createFunctionDependencyActivity,
  createFunctionEnvVarActivity,
  createFunctionIndexActivity
} from "@spica-server/function/src/activity.resource";

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

  it("should return activity from post request for index", () => {
    const req = {
      params: {
        id: "function_id"
      }
    };

    const activities = createFunctionIndexActivity(
      {action: Action.POST, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {action: Action.POST, identifier: "test_user", resource: ["function", "function_id", "index"]}
    ]);
  });

  it("should return activity from post request for dependency", () => {
    const req = {
      params: {
        id: "function_id"
      },
      body: {
        name: "axios"
      }
    };

    const activities = createFunctionDependencyActivity(
      {action: Action.POST, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.POST,
        identifier: "test_user",
        resource: ["function", "function_id", "dependency", "axios"]
      }
    ]);
  });

  it("should return activity from delete request for dependency", () => {
    const req = {
      params: {
        id: "function_id",
        name: "axios"
      }
    };

    const activities = createFunctionDependencyActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["function", "function_id", "dependency", "axios"]
      }
    ]);
  });

  it("should return activity from put request for environment variable", () => {
    const req = {
      params: {
        id: "function_id",
        envVarId: "env_var_id"
      }
    };

    const activities = createFunctionEnvVarActivity(
      {action: Action.PUT, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.PUT,
        identifier: "test_user",
        resource: ["function", "function_id", "env-var", "env_var_id"]
      }
    ]);
  });

  it("should return activity from delete request for environment variable", () => {
    const req = {
      params: {
        id: "function_id",
        envVarId: "env_var_id"
      }
    };

    const activities = createFunctionEnvVarActivity(
      {action: Action.DELETE, identifier: "test_user"},
      req,
      {}
    );
    expect(activities).toEqual([
      {
        action: Action.DELETE,
        identifier: "test_user",
        resource: ["function", "function_id", "env-var", "env_var_id"]
      }
    ]);
  });
});
