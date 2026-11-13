import {BatchQueries} from "../../src/realtime/batch.js";
import {BucketSource} from "../../src/realtime/source.js";

const bucket = {id: "b1", primary: "id"} as any;
const context = {resolveSchema: jest.fn(), preferences: jest.fn()} as any;

describe("BucketSource", () => {
  let find: jest.Mock;
  const source = (options: object = {}) =>
    new BucketSource({find} as any, bucket, context, options);

  beforeEach(() => {
    find = jest.fn(async (_bucket, spec) => ({
      result: (spec.resourceFilter?.include ?? ["a", "b"]).map((id: string) => ({id, nested: {}}))
    }));
  });

  it("should read once for subscriptions that ask the same thing in a batch", async () => {
    const batch = new BatchQueries();

    await source({filter: "document.age > 1"}).matching(["a", "b"], batch);
    await source({filter: "document.age > 1"}).matching(["b", "a"], batch);

    expect(find).toHaveBeenCalledTimes(1);
  });

  it("should read again for another filter, another user or other keys", async () => {
    const batch = new BatchQueries();

    await source({filter: "document.age > 1"}).matching(["a"], batch);
    await source({filter: "document.age > 2"}).matching(["a"], batch);
    await source({filter: "document.age > 1", applyAcl: true, user: {id: "1"}}).matching(
      ["a"],
      batch
    );
    await source({filter: "document.age > 1", applyAcl: true, user: {id: "2"}}).matching(
      ["a"],
      batch
    );
    await source({filter: "document.age > 1"}).matching(["a", "b"], batch);

    expect(find).toHaveBeenCalledTimes(5);
  });

  it("should share for the same user whatever order the properties come in", async () => {
    const batch = new BatchQueries();

    await source({applyAcl: true, user: {id: "1", role: "a"}}).keys(batch);
    await source({user: {role: "a", id: "1"}, applyAcl: true}).keys(batch);

    expect(find).toHaveBeenCalledTimes(1);
  });

  it("should read again in the next batch", async () => {
    await source().keys(new BatchQueries());
    await source().keys(new BatchQueries());

    expect(find).toHaveBeenCalledTimes(2);
  });

  it("should read every time without a batch", async () => {
    await source().keys();
    await source().keys();

    expect(find).toHaveBeenCalledTimes(2);
  });

  it("should not share the window of one range with another", async () => {
    const batch = new BatchQueries();

    await source({sort: {age: 1}, limit: 1}).keys(batch);
    await source({sort: {age: 1}, limit: 2}).keys(batch);

    expect(find).toHaveBeenCalledTimes(2);
  });

  it("should give each subscription its own copy of the documents", async () => {
    const batch = new BatchQueries();

    const [first] = await source().matching(["a"], batch);
    first.nested = {changed: true};
    const [second] = await source().matching(["a"], batch);

    expect(second.nested).toEqual({});
  });

  it("should ask for the key alone when it reads keys", async () => {
    await source({filter: "document.age > 1", sort: {age: 1}, skip: 1, limit: 2}).keys();

    expect(find).toHaveBeenCalledWith(
      bucket,
      {filter: "document.age > 1", sort: {age: 1}, skip: 1, limit: 2, projectMap: [["id"]]},
      context
    );
  });

  it("should let the read rule apply for the user it was given", async () => {
    await source({applyAcl: true, user: {id: "1"}}).documents();

    expect(find).toHaveBeenCalledWith(bucket, {applyAcl: true, user: {id: "1"}}, context);
  });

  it("should never share a result between two users, even for the same filter", async () => {
    const batch = new BatchQueries();
    const asker = (id: string) =>
      source({filter: "document.age > 1", applyAcl: true, user: {id: id, role: "member"}});

    await asker("1").matching(["a"], batch);
    await asker("2").matching(["a"], batch);

    expect(find).toHaveBeenCalledTimes(2);
  });

  it("should tell apart values that only differ inside a class instance", async () => {
    class Id {
      constructor(private readonly value: string) {}
      toJSON() {
        return this.value;
      }
    }
    const batch = new BatchQueries();

    await source({applyAcl: true, user: {id: new Id("1")}}).keys(batch);
    await source({applyAcl: true, user: {id: new Id("2")}}).keys(batch);
    await source({applyAcl: true, user: {id: new Id("2")}}).keys(batch);

    expect(find).toHaveBeenCalledTimes(2);
  });

  it("should tell apart the hash secrets", async () => {
    const batch = new BatchQueries();

    await source({hashSecret: "a"}).keys(batch);
    await source({hashSecret: "b"}).keys(batch);

    expect(find).toHaveBeenCalledTimes(2);
  });
});
