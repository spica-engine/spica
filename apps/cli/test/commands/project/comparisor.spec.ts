import {ResourceGroupComparisor} from "../../../src/commands/project/sync";

describe("ResourceGroupComparisor", () => {
  const record = (id: string, name: string) => ({id, name});

  it("should match records by the key they carry", () => {
    const source = [record("1", "a"), record("2", "b"), record("3", "c")];
    const target = [record("2", "b"), record("3", "renamed"), record("4", "d")];

    const comparisor = new ResourceGroupComparisor(source, target);

    expect(comparisor.insertions()).toEqual([record("1", "a")]);
    expect(comparisor.updations()).toEqual([record("3", "c")]);
    expect(comparisor.deletions()).toEqual([record("4", "d")]);
  });

  it("should match by the given field instead of the key", () => {
    const source = [record("1", "a"), record("2", "b")];
    const target = [record("9", "b")];

    const comparisor = new ResourceGroupComparisor(source, target, "name");

    expect(comparisor.insertions()).toEqual([record("1", "a")]);
    expect(comparisor.deletions()).toEqual([]);
  });
});
