import {FilterLanguageError, PassthroughResultShaper} from "@spica-server/data";
import {MongoCollectionQueryFacade, MongoIdTypes} from "@spica-server/data-mongodb";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {Test} from "@nestjs/testing";
import {hash} from "@spica-server/core-encryption";
import {COLLECTION_QUERY, CollectionQueryFacade, ResultShaper} from "@spica-server/interface-data";

// Records every pipeline the facade sends, so a test can state the stages it expects.
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

const neutralResourceFilter = {include: ["5f1e8b9c2a4d3e0012345678"], exclude: []};

// What the client filter above becomes: the keys turn into ObjectIds and the dates into Dates.
const clientMatch = (extra: object = {}) => ({
  $match: {
    _id: new ObjectId("5f1e8b9c2a4d3e0012345679"),
    created_at: new Date("2020-01-01T00:00:00.000Z"),
    name: "x",
    ...extra
  }
});

const clientFilter = () => ({
  _id: "5f1e8b9c2a4d3e0012345679",
  created_at: "2020-01-01T00:00:00.000Z",
  name: "x"
});

describe("MongoCollectionQueryFacade", () => {
  describe("pipelines", () => {
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

    const identitySecrets = {password: 0, lastPasswords: 0, "authFactor.secret": 0} as const;

    it("should build the identity list pipeline", async () => {
      await facade.find("identity", {
        resourceFilter: neutralResourceFilter,
        filter: clientFilter(),
        sort: {_id: -1},
        skip: 5,
        limit: 10,
        fields: identitySecrets
      });

      expect(calls).toEqual([
        {
          collection: "identity",
          pipeline: [
            resourceFilter,
            clientMatch(),
            {$sort: {_id: -1}},
            {$skip: 5},
            {$limit: 10},
            {$project: identitySecrets}
          ]
        }
      ]);
    });

    it("should count filtered identity pages with the filters alone", async () => {
      const page = await facade.paginate(
        "identity",
        {
          resourceFilter: neutralResourceFilter,
          filter: clientFilter(),
          sort: {_id: -1},
          skip: 5,
          limit: 10,
          fields: identitySecrets
        },
        "estimate-unless-filtered"
      );

      expect(calls.map(call => call.pipeline)).toEqual([
        [
          resourceFilter,
          clientMatch(),
          {$sort: {_id: -1}},
          {$skip: 5},
          {$limit: 10},
          {$project: identitySecrets}
        ],
        [resourceFilter, clientMatch(), {$count: "total"}]
      ]);
      expect(page).toEqual({meta: {total: 0}, data: []});
    });

    it("should estimate unfiltered pages instead of counting", async () => {
      const page = await facade.paginate(
        "env_var",
        {resourceFilter: neutralResourceFilter, skip: 0, limit: 0},
        "estimate-unless-filtered"
      );

      expect(calls).toEqual([{collection: "env_var", pipeline: [resourceFilter]}]);
      expect(page).toEqual({meta: {total: 42}, data: []});
    });

    it("should run caller replacers before the id and date replacers", async () => {
      const providerReplacer = async (filter: any) => {
        if (filter.email) {
          filter["email.hash"] = `hashed:${filter.email}`;
          delete filter.email;
        }
        return filter;
      };
      await facade.find("user", {
        resourceFilter: neutralResourceFilter,
        filter: {...clientFilter(), email: "a@b.c"},
        filterReplacers: [providerReplacer],
        fields: identitySecrets
      });

      expect(calls[0].pipeline).toEqual([
        resourceFilter,
        clientMatch({"email.hash": "hashed:a@b.c"}),
        {$project: identitySecrets}
      ]);
    });

    it("should compare the declared hashed fields with the hash of the given value", async () => {
      await facade.find("user", {
        filter: {
          $or: [{email: "a@b.c"}, {phone: {$in: ["1", "2"]}}],
          username: "bob"
        },
        hashed: {secret: "s", fields: {email: "email.hash", phone: "phone.hash"}}
      });

      expect(calls[0].pipeline).toEqual([
        {
          $match: {
            $or: [
              {"email.hash": hash("a@b.c", "s")},
              {"phone.hash": {$in: [hash("1", "s"), hash("2", "s")]}}
            ],
            username: "bob"
          }
        }
      ]);
    });

    it("should build the token hashing refresh token list pipeline", async () => {
      const tokenReplacer = async (filter: any) => {
        if (filter.token) {
          filter.token = `hashed:${filter.token}`;
        }
        return filter;
      };
      await facade.find("refresh_token", {
        resourceFilter: neutralResourceFilter,
        filter: {...clientFilter(), token: "t"},
        filterReplacers: [tokenReplacer],
        sort: {created_at: 1},
        skip: 1,
        limit: 2,
        fields: {token: 0}
      });

      expect(calls[0].pipeline).toEqual([
        resourceFilter,
        clientMatch({token: "hashed:t"}),
        {$sort: {created_at: 1}},
        {$skip: 1},
        {$limit: 2},
        {$project: {token: 0}}
      ]);
    });

    it("should build the single document pipelines of user, refresh token and secret", async () => {
      const id = new ObjectId();
      for (const [collection, fields] of [
        ["user", identitySecrets],
        ["refresh_token", {token: 0}],
        ["secret", {value: 0}]
      ] as const) {
        await facade.findOne(collection, {id, fields});

        expect(calls.pop()).toEqual({
          collection,
          pipeline: [{$match: {_id: id}}, {$project: fields}]
        });
      }
    });

    it("should put the secret projection after the seeking stages", async () => {
      await facade.find("secret", {
        resourceFilter: neutralResourceFilter,
        filter: clientFilter(),
        sort: {key: 1},
        skip: 2,
        limit: 3,
        fields: {value: 0}
      });

      expect(calls[0].pipeline).toEqual([
        resourceFilter,
        clientMatch(),
        {$sort: {key: 1}},
        {$skip: 2},
        {$limit: 3},
        {$project: {value: 0}}
      ]);
    });

    it("should build the resource filtered and sorted schema list pipelines", async () => {
      await facade.find("buckets", {resourceFilter: neutralResourceFilter, sort: {order: 1}});
      await facade.find("dashboard", {resourceFilter: neutralResourceFilter});
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

      await facade.paginate(
        "apikey",
        {resourceFilter: neutralResourceFilter, sort, skip: 0, limit: 10},
        "exact"
      );

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

      it("should build the function list pipeline", async () => {
        await facade.find("function", {
          resourceFilter: neutralResourceFilter,
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

    it("should resolve activity names before matching", async () => {
      const from = new Date("2024-01-01T00:00:00.000Z");
      const to = new Date("2024-02-01T00:00:00.000Z");
      const resolveName = (from: string, field: string) => [
        {$lookup: {from, localField: field, foreignField: "_id", as: field}},
        {$unwind: {path: `$${field}`, preserveNullAndEmptyArrays: true}},
        {$set: {[field]: `$${field}.${field}`}}
      ];

      await facade.find("activity", {
        relations: ["identifier", "username"],
        where: {
          identifier: {eq: "spica"},
          resource: {eq: {name: "bucket", documentId: ["1"]}},
          action: {in: [1, 3]}
        },
        createdBetween: {from, to},
        sort: {_id: -1},
        skip: 5,
        limit: 10
      });
      await facade.find("activity", {relations: ["identifier", "username"], sort: {_id: -1}});

      expect(calls.map(call => call.pipeline)).toEqual([
        [
          ...resolveName("identity", "identifier"),
          ...resolveName("user", "username"),
          {
            $match: {
              identifier: "spica",
              resource: {name: "bucket", documentId: ["1"]},
              action: {$in: [1, 3]},
              _id: {
                $gte: ObjectId.createFromTime(from.getTime() / 1000),
                $lt: ObjectId.createFromTime(to.getTime() / 1000)
              }
            }
          },
          {$sort: {_id: -1}},
          {$skip: 5},
          {$limit: 10}
        ],
        [
          ...resolveName("identity", "identifier"),
          ...resolveName("user", "username"),
          {$sort: {_id: -1}}
        ]
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
      await facade.paginate("apikey", {resourceFilter: neutralResourceFilter}, "exact");

      expect(calls[0].pipeline[1]).toEqual({
        $facet: {meta: [{$count: "total"}], data: [{$skip: 0}]}
      });
    });
  });

  it("should allow aggregations to use disk like BaseCollection", async () => {
    const options: unknown[] = [];
    const db = {
      collection: () => ({
        aggregate: (_: object[], aggregateOptions: unknown) => {
          options.push(aggregateOptions);
          return {toArray: async () => [], next: async () => null};
        },
        estimatedDocumentCount: async () => 0
      })
    } as unknown as DatabaseService;
    const facade = new MongoCollectionQueryFacade(
      db,
      new MongoIdTypes(),
      new PassthroughResultShaper()
    );

    await facade.find("identity");
    await facade.findOne("identity", {});
    await facade.paginate("identity", {filter: {name: "x"}}, "estimate-unless-filtered");
    await facade.paginate("identity", {}, "exact");

    expect(options).toEqual(Array(5).fill({allowDiskUse: true}));
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

    it("should answer 404 for a filter that is an expression", async () => {
      const reads = [
        facade.find("webhook", {filter: "document.title == 'b'"}),
        facade.paginate("webhook", {filter: "document.title == 'b'"}, "exact"),
        facade.findOne("webhook", {filter: "document.title == 'b'"})
      ];

      for (const read of reads) {
        await expect(read).rejects.toBeInstanceOf(FilterLanguageError);
      }
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
        {resourceFilter: {include: [], exclude: []}, sort: {_id: -1}, skip: 1, limit: 1},
        "exact"
      );

      expect(page).toEqual(legacy);
      expect(page.meta).toEqual({total: 3});
    });

    it("should report zero for an empty exact page like the webhook pipeline", async () => {
      const page = await facade.paginate(
        "webhook",
        {
          resourceFilter: {include: ["5f1e8b9c2a4d3e00000000ff"], exclude: []},
          sort: {_id: -1},
          skip: 0,
          limit: 10
        },
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

    it("should count only the documents a filter keeps", async () => {
      const page = await facade.paginate(
        "webhook",
        {resourceFilter: {include: [], exclude: []}, filter: {title: "b"}, sort: {title: 1}},
        "estimate-unless-filtered"
      );

      expect(page.meta).toEqual({total: 1});
      expect(page.data).toEqual([expect.objectContaining({title: "b"})]);
    });
  });
});
