import {Action} from "@spica-server/activity/services";
import {createFunctionResource} from "@spica-server/function/src/activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "function_id"
    };
    const action = Action.POST;

    const resource = createFunctionResource(action, {}, res);
    expect(resource).toEqual({
      name: "Function",
      documentId: ["function_id"]
    });
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "function_id"
      }
    };
    const action = Action.PUT;

    const resource = createFunctionResource(action, req, {});
    expect(resource).toEqual({
      name: "Function",
      documentId: ["function_id"]
    });
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "function_id"
      }
    };
    const action = Action.DELETE;

    const resource = createFunctionResource(action, req, {});
    expect(resource).toEqual({
      name: "Function",
      documentId: ["function_id"]
    });
  });
});
