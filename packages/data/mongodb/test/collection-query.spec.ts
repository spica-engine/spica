import {PassthroughResultShaper} from "@spica-server/data";
import {MongoCollectionQueryFacade, MongoIdTypes} from "@spica-server/data-mongodb";
import {executePaginationPlan, PipelineBuilder} from "@spica-server/database-pipeline";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {replaceFilterDates, replaceFilterObjectIds} from "@spica-server/filter";
import {Test} from "@nestjs/testing";
import {COLLECTION_QUERY, CollectionQueryFacade, ResultShaper} from "@spica-server/interface-data";

// Records every pipeline the facade sends so it can be compared with the pipeline today's callers
// build with PipelineBuilder.
function recordingDatabase() {
  const calls: {collection: string; pipeline: object[]}[] = [];
  const db = {
    collection: (collection: string) => ({
      aggregate: (pipeline: object[]) => {
        calls.push({collection, pipeline});
        return {toArray: async () => [], next: async () => null};
      },
      estimatedDocumentCount: async () => 42
    })
  };
  return {db: db as unknown as DatabaseService, calls};
}

const resourceFilter = {
  $match: {$or: [{_id: {$in: [new ObjectId("5f1e8b9c2a4d3e0012345678")]}}]}
};

const clientFilter = () => ({
  _id: "5f1e8b9c2a4d3e0012345679",
  created_at: "2020-01-01T00:00:00.000Z",
  name: "x"
});

describe("MongoCollectionQueryFacade", () => {
  describe("pipeline parity", () => {
    let calls: {collection: string; pipeline: object[]}[];
    let facade: MongoCollectionQueryFacade;

    beforeEach(() => {
      const recording = recordingDatabase();
      calls = recording.calls;
      facade = new MongoCollectionQueryFacade(
        recording.db,
        new MongoIdTypes(),
        new PassthroughResultShaper()
      );
    });

    async function legacyPlan(
      replacers: ((filter: object) => Promise<object>)[] | undefined,
      chain: {resourceFilter?: object; filter?: object; id?: ObjectId},
      seeking: {sort?: any; skip?: number; limit?: number; fields?: any}
    ) {
      const base = await new PipelineBuilder(replacers)
        .findOneIfRequested(chain.id)
        .filterResources(chain.resourceFilter)
        .filterByUserRequest(chain.filter);
      const seekingPipeline = new PipelineBuilder()
        .sort(seeking.sort)
        .skip(seeking.skip)
        .limit(seeking.limit)
        .setVisibilityOfFields(seeking.fields)
        .result();
      return base.buildPaginationPlan(seekingPipeline, async () => 42);
    }

    const identitySecrets = {password: 0, lastPasswords: 0, "authFactor.secret": 0} as const;

    it("should build the identity list pipeline", async () => {
      const legacy = await legacyPlan(
        undefined,
        {resourceFilter, filter: clientFilter()},
        {sort: {_id: -1}, skip: 5, limit: 10, fields: identitySecrets}
      );

      await facade.find("identity", {
        resourceFilter,
        filter: clientFilter(),
        sort: {_id: -1},
        skip: 5,
        limit: 10,
        fields: identitySecrets
      });

      expect(calls).toEqual([{collection: "identity", pipeline: legacy.dataPipeline}]);
    });

    it("should count filtered identity pages with the same count pipeline", async () => {
      const legacy = await legacyPlan(
        undefined,
        {resourceFilter, filter: clientFilter()},
        {sort: {_id: -1}, skip: 5, limit: 10, fields: identitySecrets}
      );

      const page = await facade.paginate(
        "identity",
        {
          resourceFilter,
          filter: clientFilter(),
          sort: {_id: -1},
          skip: 5,
          limit: 10,
          fields: identitySecrets
        },
        "estimate-unless-filtered"
      );

      expect(calls.map(call => call.pipeline)).toEqual([legacy.dataPipeline, legacy.countPipeline]);
      expect(page).toEqual({meta: {total: 0}, data: []});
    });

    it("should estimate unfiltered pages instead of counting", async () => {
      const page = await facade.paginate(
        "env_var",
        {resourceFilter, skip: 0, limit: 0},
        "estimate-unless-filtered"
      );

      expect(calls).toEqual([{collection: "env_var", pipeline: [resourceFilter]}]);
      expect(page).toEqual({meta: {total: 42}, data: []});
    });

    it("should run caller replacers before the id and date replacers like UserPipelineBuilder", async () => {
      const providerReplacer = async (filter: any) => {
        if (filter.email) {
          filter["email.hash"] = `hashed:${filter.email}`;
          delete filter.email;
        }
        return filter;
      };
      const legacy = await legacyPlan(
        [providerReplacer, replaceFilterObjectIds, replaceFilterDates],
        {resourceFilter, filter: {...clientFilter(), email: "a@b.c"}},
        {fields: identitySecrets}
      );

      await facade.find("user", {
        resourceFilter,
        filter: {...clientFilter(), email: "a@b.c"},
        filterReplacers: [providerReplacer],
        fields: identitySecrets
      });

      expect(calls[0].pipeline).toEqual(legacy.dataPipeline);
    });

    it("should build the token hashing refresh token list pipeline", async () => {
      const tokenReplacer = async (filter: any) => {
        if (filter.token) {
          filter.token = `hashed:${filter.token}`;
        }
        return filter;
      };
      const legacy = await legacyPlan(
        [replaceFilterObjectIds, replaceFilterDates, tokenReplacer],
        {resourceFilter, filter: {...clientFilter(), token: "t"}},
        {sort: {created_at: 1}, skip: 1, limit: 2, fields: {token: 0}}
      );

      await facade.find("refresh_token", {
        resourceFilter,
        filter: {...clientFilter(), token: "t"},
        filterReplacers: [tokenReplacer],
        sort: {created_at: 1},
        skip: 1,
        limit: 2,
        fields: {token: 0}
      });

      expect(calls[0].pipeline).toEqual(legacy.dataPipeline);
    });

    it("should build the single document pipelines of user, refresh token and secret", async () => {
      const id = new ObjectId();
      for (const [collection, fields] of [
        ["user", identitySecrets],
        ["refresh_token", {token: 0}],
        ["secret", {value: 0}]
      ] as const) {
        const legacy = new PipelineBuilder()
          .findOneIfRequested(id)
          .setVisibilityOfFields(fields)
          .result();

        await facade.findOne(collection, {id, fields});

        expect(calls.pop()).toEqual({collection, pipeline: legacy});
      }
    });

    it("should put the secret projection after the seeking stages", async () => {
      const legacy = await legacyPlan(
        undefined,
        {resourceFilter, filter: clientFilter()},
        {sort: {key: 1}, skip: 2, limit: 3, fields: {value: 0}}
      );

      await facade.find("secret", {
        resourceFilter,
        filter: clientFilter(),
        sort: {key: 1},
        skip: 2,
        limit: 3,
        fields: {value: 0}
      });

      expect(calls[0].pipeline).toEqual(legacy.dataPipeline);
    });

    it("should build the resource filtered and sorted schema list pipelines", async () => {
      await facade.find("buckets", {resourceFilter, sort: {order: 1}});
      await facade.find("dashboard", {resourceFilter});
      await facade.find("strategy", {filter: {type: "oauth"}, fields: {options: 0}});

      expect(calls).toEqual([
        {collection: "buckets", pipeline: [resourceFilter, {$sort: {order: 1}}]},
        {collection: "dashboard", pipeline: [resourceFilter]},
        {
          collection: "strategy",
          pipeline: [{$match: {type: "oauth"}}, {$project: {options: 0}}]
        }
      ]);
    });

    it("should build the apikey $facet pipeline for exact counts", async () => {
      const sort = {_id: -1} as const;
      const legacy = [
        resourceFilter,
        {
          $facet: {
            meta: [{$count: "total"}],
            data: [{$sort: sort}, {$skip: 0}, {$limit: 10}]
          }
        },
        {
          $set: {
            meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {$const: {total: 0}}]}
          }
        }
      ];

      await facade.paginate("apikey", {resourceFilter, sort, skip: 0, limit: 10}, "exact");

      expect(calls).toEqual([{collection: "apikey", pipeline: legacy}]);
    });

    describe("function", () => {
      const envLookup = {
        $lookup: {from: "env_var", localField: "env_vars", foreignField: "_id", as: "env_vars"}
      };
      const secretLookup = {
        $lookup: {from: "secret", localField: "secrets", foreignField: "_id", as: "secrets"}
      };
      const hideSecrets = {$project: {"secrets.value": 0}};

      it("should build the function list pipeline of FunctionPipelineBuilder", async () => {
        await facade.find("function", {
          resourceFilter,
          relations: ["env_vars", "secrets"],
          fields: {"secrets.value": 0}
        });

        expect(calls[0].pipeline).toEqual([resourceFilter, envLookup, secretLookup, hideSecrets]);
      });

      it("should build the single function pipelines", async () => {
        const id = new ObjectId();

        await facade.findOne("function", {
          id,
          relations: ["env_vars", "secrets"],
          fields: {"secrets.value": 0}
        });
        await facade.findOne("function", {id, relations: ["env_vars", "secrets"]});

        expect(calls.map(call => call.pipeline)).toEqual([
          [{$match: {_id: id}}, envLookup, secretLookup, hideSecrets],
          [{$match: {_id: id}}, envLookup, secretLookup]
        ]);
      });

      it("should build the functions with secrets pipeline", async () => {
        const ids = [new ObjectId(), new ObjectId()];

        await facade.find("function", {where: {_id: {in: ids}}, relations: ["secrets"]});

        expect(calls[0].pipeline).toEqual([{$match: {_id: {$in: ids}}}, secretLookup]);
      });

      it("should reject relations the collection does not define", async () => {
        await expect(facade.find("function", {relations: ["owner"]})).rejects.toThrow(
          "Collection function has no relation named owner."
        );
      });
    });

    it("should build the function logs pipeline", async () => {
      const from = new Date("2024-01-01T00:00:00.000Z");
      const to = new Date("2024-01-01T23:59:59.999Z");

      await facade.find("function_logs", {
        createdBetween: {from, to},
        where: {
          channel: {eq: "stdout"},
          level: {in: [1, 2]},
          function: {in: ["fn"]},
          content: {matches: "err", caseInsensitive: true}
        },
        sort: {_id: -1},
        skip: 10,
        limit: 20,
        relations: ["function"]
      });

      expect(calls[0].pipeline).toEqual([
        {
          $match: {
            _id: {
              $gte: ObjectId.createFromTime(from.getTime() / 1000),
              $lt: ObjectId.createFromTime(to.getTime() / 1000)
            },
            channel: "stdout",
            level: {$in: [1, 2]},
            function: {$in: ["fn"]},
            content: {$regex: "err", $options: "i"}
          }
        },
        {$sort: {_id: -1}},
        {$skip: 10},
        {$limit: 20},
        {$set: {fn_id: {$toObjectId: "$function"}}},
        {$lookup: {from: "function", localField: "fn_id", foreignField: "_id", as: "fn"}},
        {$unwind: {path: "$fn", preserveNullAndEmptyArrays: true}},
        {$set: {function: {$ifNull: ["$fn.name", "$function"]}}},
        {$unset: ["fn", "fn_id"]}
      ]);
    });

    it("should keep the empty $match of the webhook logs pipeline", async () => {
      await facade.find("webhook_logs", {where: {}, sort: {_id: -1}});

      expect(calls[0].pipeline).toEqual([{$match: {}}, {$sort: {_id: -1}}]);
    });

    it("should count pages narrowed by where conditions exactly", async () => {
      await facade.paginate(
        "webhook_logs",
        {where: {succeed: {eq: true}}},
        "estimate-unless-filtered"
      );

      expect(calls.map(call => call.pipeline)).toEqual([
        [{$match: {succeed: true}}],
        [{$match: {succeed: true}}, {$count: "total"}]
      ]);
    });

    it("should keep $skip in the $facet data stage when nothing else is requested", async () => {
      await facade.paginate("apikey", {resourceFilter}, "exact");

      expect(calls[0].pipeline[1]).toEqual({
        $facet: {meta: [{$count: "total"}], data: [{$skip: 0}]}
      });
    });
  });

  it("should pass every result through the result shaper", async () => {
    const recording = recordingDatabase();
    const shaped = {shaped: true};
    const shaper: ResultShaper = {shape: jest.fn().mockReturnValue(shaped) as any};
    const facade = new MongoCollectionQueryFacade(recording.db, new MongoIdTypes(), shaper);

    expect(await facade.find("identity")).toBe(shaped);
    expect(await facade.findOne("identity", {})).toBe(shaped);
    expect(await facade.paginate("identity", {}, "exact")).toBe(shaped);
    expect(await facade.paginate("identity", {}, "estimate-unless-filtered")).toBe(shaped);
    expect(shaper.shape).toHaveBeenCalledTimes(4);
    expect(shaper.shape).toHaveBeenCalledWith({kind: "collection", name: "identity"}, []);
  });

  describe("against MongoDB", () => {
    let db: DatabaseService;
    let facade: CollectionQueryFacade;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [DatabaseTestingModule.replicaSet()]
      }).compile();
      db = module.get(DatabaseService);
      facade = module.get(COLLECTION_QUERY);
      await db
        .collection("webhook")
        .insertMany([{title: "a"}, {title: "b"}, {title: "c"}].map(doc => ({...doc})));
    });

    it("should return the same exact page as the webhook $facet pipeline", async () => {
      const legacy = await db
        .collection("webhook")
        .aggregate([
          {$match: {}},
          {
            $facet: {
              meta: [{$count: "total"}],
              data: [{$sort: {_id: -1}}, {$skip: 1}, {$limit: 1}]
            }
          },
          {$set: {meta: {$ifNull: [{$arrayElemAt: ["$meta", 0]}, {total: 0}]}}}
        ])
        .next();

      const page = await facade.paginate(
        "webhook",
        {resourceFilter: {$match: {}}, sort: {_id: -1}, skip: 1, limit: 1},
        "exact"
      );

      expect(page).toEqual(legacy);
      expect(page.meta).toEqual({total: 3});
    });

    it("should report zero for an empty exact page like the webhook pipeline", async () => {
      const page = await facade.paginate(
        "webhook",
        {resourceFilter: {$match: {title: "none"}}, sort: {_id: -1}, skip: 0, limit: 10},
        "exact"
      );

      expect(page).toEqual({meta: {total: 0}, data: []});
    });

    it("should match succeed like the webhook logs $eq condition", async () => {
      await db.collection("webhook_logs").insertMany([{succeed: true}, {succeed: false}]);
      const legacy = await db
        .collection("webhook_logs")
        .aggregate([{$match: {succeed: {$eq: true}}}, {$sort: {_id: -1}}])
        .toArray();

      const logs = await facade.find("webhook_logs", {
        where: {succeed: {eq: true}},
        sort: {_id: -1}
      });

      expect(logs).toEqual(legacy);
      expect(logs).toHaveLength(1);
    });

    it("should return the same page as executePaginationPlan", async () => {
      const plan = (
        await new PipelineBuilder().filterResources({$match: {}}).filterByUserRequest({title: "b"})
      ).buildPaginationPlan([{$sort: {title: 1}}], () =>
        db.collection("webhook").estimatedDocumentCount()
      );
      const legacy = await executePaginationPlan(db.collection("webhook"), plan);

      const page = await facade.paginate(
        "webhook",
        {resourceFilter: {$match: {}}, filter: {title: "b"}, sort: {title: 1}},
        "estimate-unless-filtered"
      );

      expect(page).toEqual(legacy);
      expect(page.meta).toEqual({total: 1});
    });
  });
});
