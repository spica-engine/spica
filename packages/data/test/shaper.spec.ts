import {PassthroughResultShaper} from "@spica-server/data";

describe("PassthroughResultShaper", () => {
  it("should return the result it was given", async () => {
    const result = {data: [{id: "1"}], meta: {total: 1}};
    await expect(
      new PassthroughResultShaper().shape({kind: "collection", name: "identity"}, result)
    ).resolves.toBe(result);
  });
});
