import {PassthroughResultShaper} from "@spica-server/data";

describe("PassthroughResultShaper", () => {
  it("should return the result it was given", () => {
    const result = {data: [{_id: "1"}], meta: {total: 1}};
    expect(
      new PassthroughResultShaper().shape({kind: "collection", name: "identity"}, result)
    ).toBe(result);
  });
});
