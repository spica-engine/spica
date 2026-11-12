import {systemKeyField} from "@spica-server/data";
import {ExpressionBucketDataOptionsBuilder} from "@spica-server/bucket-realtime";

const request = (
  query: Record<string, string> = {},
  user: any = {[systemKeyField()]: {toString: () => "u1"}, role: "member"}
) => ({user, query: new URLSearchParams(query)}) as any;

describe("ExpressionBucketDataOptionsBuilder", () => {
  it("should leave the options empty for a request with no query", async () => {
    expect(await ExpressionBucketDataOptionsBuilder.fromBucketQuery(request(), false)).toEqual({});
  });

  it("should keep the filter as the expression it is", async () => {
    const options = await ExpressionBucketDataOptionsBuilder.fromBucketQuery(
      request({filter: `document.age > 20 && document.title == "a"`}),
      false
    );

    expect(options.filter).toBe(`document.age > 20 && document.title == "a"`);
  });

  it("should read the sort, the limit and the skip", async () => {
    const options = await ExpressionBucketDataOptionsBuilder.fromBucketQuery(
      request({sort: '{"age":-1}', limit: "5", skip: "2"}),
      false
    );

    expect(options).toEqual({sort: {age: -1}, limit: 5, skip: 2});
  });

  it("should ask for the read rule with the user, whose id is text", async () => {
    const options = await ExpressionBucketDataOptionsBuilder.fromBucketQuery(request(), true);

    expect(options).toEqual({applyAcl: true, user: {[systemKeyField()]: "u1", role: "member"}});
  });

  it("should hand over the secret the hashed fields need", async () => {
    const options = await ExpressionBucketDataOptionsBuilder.fromBucketQuery(
      request(),
      false,
      "secret"
    );

    expect(options).toEqual({hashSecret: "secret"});
  });

  it.each([
    ["filter", ""],
    ["filter", "   "],
    ["limit", "-1"],
    ["limit", "many"],
    ["skip", "-1"],
    ["sort", "{"]
  ])("should answer 400 for the %s %p", async (name, value) => {
    await expect(
      ExpressionBucketDataOptionsBuilder.fromBucketQuery(request({[name]: value}), false)
    ).rejects.toMatchObject({statusCode: 400});
  });
});
