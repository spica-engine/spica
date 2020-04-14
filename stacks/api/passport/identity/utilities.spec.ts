import {attachIdentityAcces} from "./utilities";

describe("Attach Identity Access", () => {
  it("should attach when condition is valid", () => {
    let request = {
      method: "PUT",
      params: {
        id: "test_user"
      },
      user: {
        _id: "test_user",
        policies: []
      }
    };
    expect(attachIdentityAcces(request)).toEqual({
      ...request,
      user: {_id: "test_user", policies: ["IdentityFullAccess"]}
    });
  });
});
