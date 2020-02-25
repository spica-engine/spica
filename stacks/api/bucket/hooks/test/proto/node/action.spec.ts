import {ActionParameters} from "@spica-server/bucket/hooks/proto/node";
import {Action} from "@spica-server/bucket/hooks/proto";

describe("ActionParameters", () => {
  let rawAction: Action.Action;
  beforeEach(() => {
    rawAction = new Action.Action({
      bucket: "test_bucket",
      type: 0,
      headers: [
        new Action.Header({key: "authorization", value: "APIKEY 123123"}),
        new Action.Header({key: "strategy-type", value: "APIKEY"})
      ],
      document: "document_id"
    });
  });
  it("should create", () => {
    const actionParameters = new ActionParameters(rawAction);

    expect(actionParameters.bucket).toEqual("test_bucket");
    expect(actionParameters.document).toEqual("document_id");
    expect(actionParameters.headers).toEqual({
      authorization: "APIKEY 123123",
      "strategy-type": "APIKEY"
    });
    expect(actionParameters.type).toEqual("INSERT");
  });
});
