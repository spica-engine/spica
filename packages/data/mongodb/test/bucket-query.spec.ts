import fs from "fs";
import path from "path";
import {EJSON} from "bson";
import {PassthroughResultShaper} from "@spica-server/data";
import {MongoBucketQueryFacade} from "@spica-server/data-mongodb";
import {DatabaseService} from "@spica-server/database";
import {preferences, resolveSchema, scenarios, schemas, user} from "./bucket-scenarios";

// The fixture holds the pipelines, Content-language headers and results that the findDocuments
// implementation in bucket-common produced for each scenario, recorded before the bucket read path
// moved into the adapter.
const recorded = EJSON.parse(
  fs.readFileSync(path.join(process.cwd(), "test/fixtures/bucket-read-pipelines.json"), "utf8"),
  {relaxed: true}
);

describe("MongoBucketQueryFacade", () => {
  it.each(scenarios.map(scenario => [scenario.name, scenario]))(
    "should read like findDocuments: %s",
    async (name, scenario) => {
      const pipelines: object[][] = [];
      const db = {
        collection: (collection: string) => {
          expect(collection).toEqual(`bucket_${schemas[scenario.bucket]._id}`);
          return {
            aggregate: (pipeline: object[]) => {
              pipelines.push(pipeline);
              return {toArray: async () => [], next: async () => null};
            },
            estimatedDocumentCount: async () => 7
          };
        }
      } as unknown as DatabaseService;
      const facade = new MongoBucketQueryFacade(db, new PassthroughResultShaper());
      const context = {
        resolveSchema: resolveSchema as any,
        preferences: async () => preferences,
        hashSecret: scenario.hashSecret
      };
      const spec = {...scenario.spec, user};

      const {result, locale} = scenario.paginate
        ? await facade.paginate(schemas[scenario.bucket], spec, context)
        : await facade.find(schemas[scenario.bucket], spec, context);

      expect(pipelines).toEqual(recorded[name].pipelines);
      expect(locale ? [locale.best || locale.fallback] : []).toEqual(recorded[name].headers);
      expect(result).toEqual(recorded[name].result);
    }
  );

  it("should return the first document for findOne", async () => {
    const document = {_id: "1"};
    const db = {
      collection: () => ({
        aggregate: () => ({toArray: async () => [document, {_id: "2"}]})
      })
    } as unknown as DatabaseService;
    const facade = new MongoBucketQueryFacade(db, new PassthroughResultShaper());

    const {result} = await facade.findOne(
      schemas.plain,
      {limit: 1},
      {resolveSchema: resolveSchema as any, preferences: async () => preferences}
    );

    expect(result).toBe(document);
  });

  it("should shape results as bucket resources", async () => {
    const shaper = {shape: jest.fn((_, result) => result)};
    const db = {
      collection: () => ({aggregate: () => ({toArray: async () => []})})
    } as unknown as DatabaseService;
    const facade = new MongoBucketQueryFacade(db, shaper);

    await facade.find(
      schemas.plain,
      {},
      {resolveSchema: resolveSchema as any, preferences: async () => preferences}
    );

    expect(shaper.shape).toHaveBeenCalledWith(
      {kind: "bucket", bucketId: schemas.plain._id.toString()},
      []
    );
  });
});
