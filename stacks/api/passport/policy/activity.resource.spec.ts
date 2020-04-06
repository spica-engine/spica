import {Action} from "@spica-server/activity";
import {createPolicyResource} from "./activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "policy_id"
    };
    const action = Action.POST;

    const resource = createPolicyResource(action, {}, res);
    expect(resource).toEqual({
      name: "Policy",
      documentId: ["policy_id"]
    });
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "policy_id"
      }
    };
    const action = Action.PUT;

    const resource = createPolicyResource(action, req, {});
    expect(resource).toEqual({
      name: "Policy",
      documentId: ["policy_id"]
    });
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "policy_id"
      }
    };
    const action = Action.DELETE;

    const resource = createPolicyResource(action, req, {});
    expect(resource).toEqual({
      name: "Policy",
      documentId: ["policy_id"]
    });
  });
});
