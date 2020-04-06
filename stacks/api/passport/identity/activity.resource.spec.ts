import {Action} from "@spica-server/activity/services";
import {createIdentityResource} from "./activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "identity_id"
    };
    const action = Action.POST;

    const resource = createIdentityResource(action, {}, res);
    expect(resource).toEqual({
      name: "Identity",
      documentId: ["identity_id"]
    });
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "identity_id"
      }
    };
    const action = Action.PUT;

    const resource = createIdentityResource(action, req, {});
    expect(resource).toEqual({
      name: "Identity",
      documentId: ["identity_id"]
    });
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "identity_id"
      }
    };
    const action = Action.DELETE;

    const resource = createIdentityResource(action, req, {});
    expect(resource).toEqual({
      name: "Identity",
      documentId: ["identity_id"]
    });
  });

  it("should return activity from policy update request", () => {
    const req = {
      params: {
        id: "identity_id"
      },
      body: ["policy1", "policy2"]
    };
    const action = Action.PUT;

    const resource = createIdentityResource(action, req, {});
    expect(resource).toEqual({
      name: "Identity",
      documentId: ["identity_id"]
    });
  });
});
