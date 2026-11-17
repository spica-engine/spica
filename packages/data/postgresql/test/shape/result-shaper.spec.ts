import {PostgresResultShaper} from "@spica-server/data-postgresql";
import {describeAll, definition, uuid} from "./support.js";

const ID = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";

describe("PostgresResultShaper", () => {
  const describe = describeAll({[ID]: definition({title: {type: "string"}})});
  const descriptions = {load: jest.fn(async () => describe)};
  const shaper = new PostgresResultShaper(descriptions as any);
  const resource = {kind: "bucket", bucketId: ID} as const;
  const row = (n: number, title: string) => ({main: {id: uuid(n), title}});

  beforeEach(() => descriptions.load.mockClear());

  it("should shape a row set, a list and a page the way the facades pass them", async () => {
    await expect(shaper.shape(resource, row(1, "a"))).resolves.toEqual({id: uuid(1), title: "a"});
    await expect(shaper.shape(resource, [row(1, "a"), row(2, "b")])).resolves.toEqual([
      {id: uuid(1), title: "a"},
      {id: uuid(2), title: "b"}
    ]);
    await expect(shaper.shape(resource, {meta: {total: 5}, data: [row(1, "a")]})).resolves.toEqual({
      meta: {total: 5},
      data: [{id: uuid(1), title: "a"}]
    });
  });

  it("should pass nothing, empty lists and empty pages through without loading buckets", async () => {
    await expect(shaper.shape(resource, null)).resolves.toBeNull();
    await expect(shaper.shape(resource, undefined)).resolves.toBeUndefined();
    await expect(shaper.shape(resource, [])).resolves.toEqual([]);
    await expect(shaper.shape(resource, {meta: {total: 0}, data: []})).resolves.toEqual({
      meta: {total: 0},
      data: []
    });
    expect(descriptions.load).not.toHaveBeenCalled();
  });

  it("should leave collection resources untouched", async () => {
    const result = [{id: "1"}];

    await expect(shaper.shape({kind: "collection", name: "identity"}, result)).resolves.toBe(
      result
    );
  });

  it("should load the bucket once for a whole result", async () => {
    await shaper.shape(resource, [row(1, "a"), row(2, "b")]);

    expect(descriptions.load).toHaveBeenCalledTimes(1);
  });
});
