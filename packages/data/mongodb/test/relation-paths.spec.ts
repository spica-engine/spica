import {PassthroughResultShaper} from "@spica-server/data";
import {MongoBucketQueryFacade, MongoIdTypes} from "@spica-server/data-mongodb";
import {DatabaseService} from "@spica-server/database";
import {markRelationsToResolve} from "../src/bucket/relation-paths";
import {preferences, resolveSchema, schemas} from "./bucket-scenarios";

describe("markRelationsToResolve", () => {
  it("should end every path with the marker the relation map resolves on", () => {
    expect(markRelationsToResolve([["author"], ["meta", "reviewer"]])).toEqual([
      ["author", "_id"],
      ["meta", "reviewer", "_id"]
    ]);
  });

  it("should leave a path that already ends with it as it is", () => {
    expect(markRelationsToResolve([["author", "_id"]])).toEqual([["author", "_id"]]);
  });

  it("should accept no paths", () => {
    expect(markRelationsToResolve(undefined)).toEqual([]);
    expect(markRelationsToResolve([])).toEqual([]);
  });
});

describe("MongoBucketQueryFacade relation paths", () => {
  async function pipelineFor(relationPaths: string[][]) {
    const pipelines: object[][] = [];
    const db = {
      collection: () => ({
        aggregate: (pipeline: object[]) => {
          pipelines.push(pipeline);
          return {toArray: async () => [], next: async () => null};
        },
        estimatedDocumentCount: async () => 0
      })
    } as unknown as DatabaseService;
    const facade = new MongoBucketQueryFacade(
      db,
      new PassthroughResultShaper(),
      new MongoIdTypes()
    );

    await facade.find(
      schemas.books,
      {relationPaths},
      {resolveSchema: resolveSchema as any, preferences: async () => preferences}
    );
    return pipelines[0];
  }

  it("should resolve a relation named by a plain path", async () => {
    const pipeline = await pipelineFor([["author"]]);

    expect(JSON.stringify(pipeline)).toContain('"$lookup"');
  });

  it.each([["author"], ["co_authors"]])(
    "should build the same pipeline for %s with or without the key at the end",
    async relation => {
      expect(await pipelineFor([[relation]])).toEqual(await pipelineFor([[relation, "_id"]]));
    }
  );

  it("should not resolve a relation nobody asked for", async () => {
    expect(JSON.stringify(await pipelineFor([]))).not.toContain('"$lookup"');
  });
});
