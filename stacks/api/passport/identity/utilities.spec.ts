import {attachIdentityAccess} from "./utilities";

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
    expect(attachIdentityAccess(request)).toEqual({
      ...request,
      user: {_id: "test_user", policies: ["IdentityFullAccess"]}
    });
  });
});
