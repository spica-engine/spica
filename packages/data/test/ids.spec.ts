import {bindIdTypes, ids} from "@spica-server/data";
import {IdTypes} from "@spica-server/interface-data";

describe("ids", () => {
  beforeEach(() => bindIdTypes(undefined as IdTypes));

  it("should throw when no adapter has bound id types", () => {
    expect(() => ids()).toThrow(
      "No data adapter is bound. Register one with DataModule.forRoot()."
    );
  });

  it("should return the bound id types", () => {
    const idTypes = {} as IdTypes;
    bindIdTypes(idTypes);
    expect(ids()).toBe(idTypes);
  });

  it("should replace previously bound id types", () => {
    const first = {} as IdTypes;
    const second = {} as IdTypes;
    bindIdTypes(first);
    bindIdTypes(second);
    expect(ids()).toBe(second);
  });
});
