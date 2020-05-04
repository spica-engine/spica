import {Action} from "@spica-server/activity/services";
import {createApikeyResource} from "./activity.resource";

describe("Activity Resource", () => {
  it("should return activity from post request", () => {
    const res = {
      _id: "apikey_id"
    };
    const action = Action.POST;

    const resource = createApikeyResource(action, {}, res);
    expect(resource).toEqual(["passport", "apikey", "apikey_id"]);
  });

  it("should return activity from put request", () => {
    const req = {
      params: {
        id: "apikey_id"
      }
    };
    const action = Action.PUT;

    const resource = createApikeyResource(action, req, {});
    expect(resource).toEqual(["passport", "apikey", "apikey_id"]);
  });

  it("should return activity from delete request", () => {
    const req = {
      params: {
        id: "apikey_id"
      }
    };
    const action = Action.DELETE;

    const resource = createApikeyResource(action, req, {});
    expect(resource).toEqual(["passport", "apikey", "apikey_id"]);
  });

  it("should return activity from policy update request", () => {
    const req = {
      params: {
        id: "apikey_id"
      },
      body: ["policy1", "policy2"]
    };
    const action = Action.PUT;

    const resource = createApikeyResource(action, req, {});
    expect(resource).toEqual(["passport", "apikey", "apikey_id"]);
  });
});
