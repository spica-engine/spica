import {provideActivityFactory} from "./activity";
describe("Function Activity Factory", () => {
  it("should return function url", () => {
    let url = provideActivityFactory({resource: ["function", "id1"]});
    expect(url).toEqual("function/id1");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: ["unknown_module", "id1"]});
    expect(url).toEqual(undefined);
  });
});
