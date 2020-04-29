import {provideActivityFactory} from "./activity";
describe("Function Activity Factory", () => {
  it("should return function url", () => {
    let url = provideActivityFactory({resource: {name: "Function", documentId: "id1"}});
    expect(url).toEqual("function/id1");
  });

  it("should return undefined", () => {
    let url = provideActivityFactory({resource: {name: "unknown_module", documentId: "id1"}});
    expect(url).toEqual(undefined);
  });
});
