import {BatchQueries} from "../../src/realtime/batch.js";
import {CollectionSource} from "../../src/realtime/collection-source.js";

describe("CollectionSource", () => {
  let find: jest.Mock;
  const source = (options: object = {}) =>
    new CollectionSource({find} as any, "env_var", "_id", options);

  beforeEach(() => {
    find = jest.fn(async (_collection, spec) =>
      (spec.where?._id?.in ?? ["a", "b"]).map((_id: string) => ({_id}))
    );
  });

  it("should read the documents of the collection with the options it was given", async () => {
    const options = {
      filter: `document.key == "a"`,
      resourceFilter: {include: ["a"], exclude: []},
      sort: {key: 1},
      skip: 1,
      limit: 2
    };

    await source(options as any).documents();

    expect(find).toHaveBeenCalledWith("env_var", options);
  });

  it("should read only the key when it reads keys", async () => {
    const keys = await source({sort: {key: 1}}).keys();

    expect(find).toHaveBeenCalledWith("env_var", {sort: {key: 1}, fields: {_id: 1}});
    expect(keys).toEqual(["a", "b"]);
  });

  it("should restrict the documents to the keys it is asked about and keep its own conditions", async () => {
    const where = {function: {in: ["f1"]}};
    const createdBetween = {from: new Date(1), to: new Date(2)};

    const documents = await source({where, createdBetween} as any).matching(["b", "a"]);

    expect(find).toHaveBeenCalledWith("env_var", {
      where: {function: {in: ["f1"]}, _id: {in: ["a", "b"]}},
      createdBetween
    });
    expect(documents).toEqual([{_id: "a"}, {_id: "b"}]);
  });

  it("should not read the window or the range when it only looks the keys up", async () => {
    await source({sort: {key: 1}, limit: 1} as any).matching(["a"]);

    expect(find.mock.calls[0][1].limit).toBeUndefined();
    expect(find.mock.calls[0][1].sort).toBeUndefined();
  });

  it("should share what subscriptions with the same options ask in a batch", async () => {
    const batch = new BatchQueries();

    await source({filter: "document.key == 'a'"}).matching(["a"], batch);
    await source({filter: "document.key == 'a'"}).matching(["a"], batch);
    await source({filter: "document.key == 'b'"}).matching(["a"], batch);

    expect(find).toHaveBeenCalledTimes(2);
  });

  it("should not share between collections or between resource filters", async () => {
    const batch = new BatchQueries();

    await source({resourceFilter: {include: ["a"], exclude: []}}).keys(batch);
    await source({resourceFilter: {include: ["b"], exclude: []}}).keys(batch);
    await new CollectionSource({find} as any, "secret", "_id", {
      resourceFilter: {include: ["a"], exclude: []}
    }).keys(batch);

    expect(find).toHaveBeenCalledTimes(3);
  });

  it("should give every subscription its own copy of the documents", async () => {
    const batch = new BatchQueries();

    const [first] = await source().matching(["a"], batch);
    (first as any).changed = true;
    const [second] = await source().matching(["a"], batch);

    expect(second).toEqual({_id: "a"});
  });
});
