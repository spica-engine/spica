import migration from "../../src/migrations/0.19.7/add_user_scope_to_oauth_redirect_uri";

describe("Add user scope to oauth redirect uri", () => {
  const publicUrl = "http://localhost:4300";
  const strategyId = "5f30fffd4a51a68d6fec4d3b";
  const session = {};

  it("should move oauth redirect uris to the user scope", async () => {
    const previousUri = `${publicUrl}/passport/strategy/${strategyId}/complete`;
    const strategy = {
      _id: strategyId,
      type: "oauth",
      options: {
        code: {params: {client_id: "client_id", redirect_uri: previousUri}},
        access_token: {params: {client_id: "client_id", redirect_uri: previousUri}}
      }
    };

    const updateOne = jest.fn();
    const find = jest.fn().mockReturnValue({toArray: () => Promise.resolve([strategy])});
    const collection = jest.fn().mockReturnValue({find, updateOne});

    await migration({database: {collection}, session, console} as any);

    expect(collection).toHaveBeenCalledWith("strategy");
    expect(find).toHaveBeenCalledWith(
      {type: "oauth", "options.code.params.redirect_uri": {$regex: "/passport/strategy/"}},
      {session}
    );

    const currentUri = `${publicUrl}/passport/user/strategy/${strategyId}/complete`;
    expect(updateOne).toHaveBeenCalledWith(
      {_id: strategyId},
      {
        $set: {
          "options.code.params.redirect_uri": currentUri,
          "options.access_token.params.redirect_uri": currentUri
        }
      },
      {session}
    );
  });
});
