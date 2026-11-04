import {MongoBucketRuleValidator} from "@spica-server/data-mongodb";

describe("MongoBucketRuleValidator", () => {
  const validator = new MongoBucketRuleValidator();
  const bucket = (read: string): any => ({acl: {read, write: "true==true"}});

  it.each([
    "true==true",
    "document.owner == auth._id",
    "has(document.title) && !(document.title == 'y')",
    "some(document.tags, ['a'])"
  ])("should accept %s", async rule => {
    await expect(validator.validateReadRule(bucket(rule))).resolves.toBeUndefined();
  });

  it.each(["document.owner ==", "nope(document.title)", "has()"])(
    "should reject %s",
    async rule => {
      await expect(validator.validateReadRule(bucket(rule))).rejects.toThrow();
    }
  );
});
