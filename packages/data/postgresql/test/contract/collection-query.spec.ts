import {Test, TestingModule} from "@nestjs/testing";
import {hash} from "@spica-server/core-encryption";
import {FilterLanguageError, provideRepository} from "@spica-server/data";
import {contractSuite, clearStorage, waitForMongoIndexes} from "@spica-server/database-testing";
import {
  COLLECTION_QUERY,
  CollectionQueryFacade,
  ID_TYPES,
  IdTypes
} from "@spica-server/interface-data";
import {ENV_VAR_REPOSITORY, EnvVarRepository} from "@spica-server/interface-env_var";
import {
  FUNCTION_LOG_OPTIONS,
  FUNCTION_LOG_SINK,
  LogSink
} from "@spica-server/interface-function-log";
import {
  ACTIVITY_OPTIONS,
  ACTIVITY_REPOSITORY,
  ActivityRepository
} from "@spica-server/interface-activity";
import {
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY,
  FunctionRepository
} from "@spica-server/interface-function";
import {
  IDENTITY_OPTIONS,
  IDENTITY_REPOSITORY,
  IdentityRepository
} from "@spica-server/interface-passport-identity";
import {USER_OPTIONS, USER_REPOSITORY, UserRepository} from "@spica-server/interface-passport-user";
import {SECRET_REPOSITORY, SecretRepository} from "@spica-server/interface-secret";

contractSuite("collection query", engine => {
  let module: TestingModule;
  let queries: CollectionQueryFacade;
  let envVars: EnvVarRepository;
  let secrets: SecretRepository;
  let logSink: LogSink;
  let activities: ActivityRepository;
  let functions: FunctionRepository;
  let identities: IdentityRepository;
  let users: UserRepository;
  let ids: IdTypes;
  const postgres = engine.name == "postgresql";

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        {provide: FUNCTION_LOG_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        provideRepository(ENV_VAR_REPOSITORY),
        provideRepository(SECRET_REPOSITORY),
        provideRepository(FUNCTION_LOG_SINK),
        {provide: ACTIVITY_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        {provide: FUNCTION_OPTIONS, useValue: {entryLimit: 4}},
        provideRepository(ACTIVITY_REPOSITORY),
        provideRepository(FUNCTION_REPOSITORY),
        {provide: IDENTITY_OPTIONS, useValue: {entryLimit: 5}},
        {provide: USER_OPTIONS, useValue: {entryLimit: 5}},
        provideRepository(IDENTITY_REPOSITORY),
        provideRepository(USER_REPOSITORY)
      ]
    }).compile();
    await module.init();
    await waitForMongoIndexes(engine, module, {env_var: ["key_1"], secret: ["key_1"]});

    queries = module.get(COLLECTION_QUERY);
    envVars = module.get(ENV_VAR_REPOSITORY);
    secrets = module.get(SECRET_REPOSITORY);
    logSink = module.get(FUNCTION_LOG_SINK);
    activities = module.get(ACTIVITY_REPOSITORY);
    functions = module.get(FUNCTION_REPOSITORY);
    identities = module.get(IDENTITY_REPOSITORY);
    users = module.get(USER_REPOSITORY);
    ids = module.get(ID_TYPES);
  }, 120_000);

  beforeEach(() =>
    clearStorage(engine, module, {
      mongodb: ["env_var", "secret", "function_logs", "activity", "function", "identity", "user"],
      postgresql: [
        "env_vars",
        "secrets",
        "function_logs",
        "activities",
        "functions",
        "identities",
        "users"
      ]
    })
  );

  afterAll(() => module.close());

  const filterOf = (json: object, expression: string) => (postgres ? expression : json);
  const keys = (records: any[]) => records.map(record => record.key);

  async function seedEnvVars() {
    const inserted: Record<string, string> = {};
    for (const [key, value] of [
      ["A", "one"],
      ["B", "two"],
      ["C", "three"]
    ]) {
      inserted[key] = String((await envVars.insert({key, value}))._id);
    }
    return inserted;
  }

  describe("reads", () => {
    it("should list everything, sorted, skipped and limited", async () => {
      await seedEnvVars();

      expect(keys(await queries.find("env_var", {sort: {key: 1}}))).toEqual(["A", "B", "C"]);
      expect(keys(await queries.find("env_var", {sort: {key: -1}}))).toEqual(["C", "B", "A"]);
      expect(keys(await queries.find("env_var", {sort: {key: 1}, skip: 1, limit: 1}))).toEqual([
        "B"
      ]);
    });

    it("should return the documents in the shape the API sends", async () => {
      const inserted = await seedEnvVars();
      const [first] = await queries.find<any>("env_var", {sort: {key: 1}, limit: 1});

      expect(String(first._id)).toBe(inserted.A);
      expect(first).toMatchObject({key: "A", value: "one"});
    });

    it("should find one document by id, or null", async () => {
      const inserted = await seedEnvVars();

      const found = await queries.findOne<any>("env_var", {id: ids.unscoped().parse(inserted.B)});
      expect(found.key).toBe("B");
      expect(await queries.findOne("env_var", {id: ids.unscoped().generate()})).toBeNull();
    });

    it("should leave out fields, or keep only the ones asked for", async () => {
      await seedEnvVars();

      const [without] = await queries.find<any>("env_var", {fields: {value: 0}, limit: 1});
      expect(without).toHaveProperty("key");
      expect(without).not.toHaveProperty("value");

      const [only] = await queries.find<any>("env_var", {fields: {key: 1}, limit: 1});
      expect(Object.keys(only).sort()).toEqual(["_id", "key"]);

      const [noId] = await queries.find<any>("env_var", {fields: {key: 1, _id: 0}, limit: 1});
      expect(Object.keys(noId)).toEqual(["key"]);
    });

    it("should keep the included ids and drop the excluded ones", async () => {
      const inserted = await seedEnvVars();

      const included = await queries.find("env_var", {
        resourceFilter: {include: [inserted.A, inserted.C], exclude: []},
        sort: {key: 1}
      });
      expect(keys(included)).toEqual(["A", "C"]);

      const excluded = await queries.find("env_var", {
        resourceFilter: {include: [], exclude: [[inserted.B]]},
        sort: {key: 1}
      });
      expect(keys(excluded)).toEqual(["A", "C"]);
    });

    it("should filter in the language of the engine", async () => {
      await seedEnvVars();

      const found = await queries.find("env_var", {
        filter: filterOf({key: "B"}, `document.key == "B"`)
      });
      expect(keys(found)).toEqual(["B"]);
    });

    it("should read conditions the controllers build", async () => {
      await seedEnvVars();
      const read = async (where: any) =>
        keys(await queries.find("env_var", {where, sort: {key: 1}}));

      expect(await read({key: {eq: "B"}})).toEqual(["B"]);
      expect(await read({key: {in: ["A", "C", "Z"]}})).toEqual(["A", "C"]);
      expect(await read({key: {in: []}})).toEqual([]);
      expect(await read({key: {matches: "^b", caseInsensitive: true}})).toEqual(["B"]);
      expect(await read({key: {matches: "^b"}})).toEqual([]);
      expect(await read({key: {matches: "[AB]"}, value: {eq: "two"}})).toEqual(["B"]);
    });
  });

  describe("pagination", () => {
    it("should count the whole collection, or what the filter keeps", async () => {
      await seedEnvVars();

      const page = await queries.paginate<any>(
        "env_var",
        {sort: {key: 1}, skip: 1, limit: 1},
        "estimate-unless-filtered"
      );
      expect(page.meta).toEqual({total: 3});
      expect(keys(page.data)).toEqual(["B"]);

      const filtered = await queries.paginate(
        "env_var",
        {filter: filterOf({key: {$in: ["A", "B"]}}, `document.key in ["A", "B"]`), limit: 1},
        "estimate-unless-filtered"
      );
      expect(filtered.meta).toEqual({total: 2});
      expect(filtered.data).toHaveLength(1);
    });

    it("should count exactly when asked to", async () => {
      await seedEnvVars();

      const page = await queries.paginate("env_var", {limit: 1}, "exact");
      expect(page.meta).toEqual({total: 3});
    });

    it("should report an empty page", async () => {
      expect(await queries.paginate("env_var", {limit: 5}, "exact")).toEqual({
        meta: {total: 0},
        data: []
      });
    });
  });

  describe("logs", () => {
    const at = (iso: string) => new Date(iso);

    async function seedLogs() {
      const fn = String(ids.unscoped().generate());
      const rows = [
        {content: "Started", level: 1, channel: "stdout"},
        {content: "Failed hard", level: 3, channel: "stderr"},
        {content: "failed again", level: 3, channel: "stderr"}
      ];
      for (const row of rows) {
        await logSink.insert({function: fn, event_id: "e", created_at: new Date(), ...row} as any);
      }
      return fn;
    }

    it("should read the logs of a function in a time range, latest first", async () => {
      const fn = await seedLogs();
      const hour = 3600 * 1000;

      const found = await queries.find<any>("function_logs", {
        where: {function: {in: [fn]}, level: {in: [3]}},
        createdBetween: {from: new Date(Date.now() - hour), to: new Date(Date.now() + hour)},
        sort: {_id: -1}
      });
      expect(found.map(log => log.content)).toEqual(["failed again", "Failed hard"]);

      const past = await queries.find("function_logs", {
        createdBetween: {from: at("2000-01-01T00:00:00Z"), to: at("2000-01-02T00:00:00Z")}
      });
      expect(past).toEqual([]);
    });

    it("should match the content of a log without caring about case", async () => {
      await seedLogs();

      const found = await queries.find<any>("function_logs", {
        where: {content: {matches: "FAILED", caseInsensitive: true}, channel: {eq: "stderr"}},
        sort: {_id: 1}
      });
      expect(found).toHaveLength(2);
    });

    it("should find the activities of a resource list that holds all and any of the given values", async () => {
      await activities.insertMany([
        {action: 1, resource: ["bucket", "1"], created_at: new Date()},
        {action: 2, resource: ["bucket", "2"], created_at: new Date()},
        {action: 3, resource: ["function", "2"], created_at: new Date()}
      ] as any);
      const actions = async (resource: object) =>
        (await queries.find<any>("activity", {where: {resource}, sort: {action: 1}})).map(
          activity => activity.action
        );

      expect(await actions({contains: {all: ["bucket"]}})).toEqual([1, 2]);
      expect(await actions({contains: {any: ["1", "2"]}})).toEqual([1, 2, 3]);
      expect(await actions({contains: {all: ["bucket"], any: ["2"]}})).toEqual([2]);
      expect(await actions({contains: {all: ["bucket", "3"]}})).toEqual([]);
    });
  });

  (postgres ? describe : describe.skip)("hashed fields on PostgreSQL", () => {
    const secret = "hashed-fields-secret";
    const hashed = {secret, fields: {email: "email.hash", phone: "phone.hash"}};

    const seedUsers = async () => {
      const stored = (value: string) => ({
        encrypted: "encrypted",
        iv: "iv",
        authTag: "tag",
        hash: hash(value, secret)
      });
      for (const [username, email, phone] of [
        ["ann", "ann@spica.io", "+100"],
        ["bob", "bob@spica.io", "+200"],
        ["cem", "cem@spica.io", "+300"]
      ]) {
        await users.insert({
          username,
          password: "x",
          policies: [],
          lastPasswords: [],
          failedAttempts: [],
          email: stored(email),
          phone: stored(phone)
        } as any);
      }
    };

    const usernames = async (filter: string) =>
      (await queries.find<any>("user", {filter, hashed, sort: {username: 1}})).map(
        user => user.username
      );

    it("should compare a field with the hash of the given value", async () => {
      await seedUsers();

      expect(await usernames("document.email == 'bob@spica.io'")).toEqual(["bob"]);
      expect(await usernames("document.email == 'nobody@spica.io'")).toEqual([]);
    });

    it("should hash the values of a list and of every side of a logical operator", async () => {
      await seedUsers();

      expect(await usernames("document.email in ['ann@spica.io', 'cem@spica.io']")).toEqual([
        "ann",
        "cem"
      ]);
      expect(
        await usernames("document.email == 'ann@spica.io' || document.phone == '+300'")
      ).toEqual(["ann", "cem"]);
    });

    it("should leave the other fields of the filter as they are", async () => {
      await seedUsers();

      expect(
        await usernames("document.email == 'bob@spica.io' && document.username == 'bob'")
      ).toEqual(["bob"]);
      expect(
        await usernames("document.email == 'bob@spica.io' && document.username == 'ann'")
      ).toEqual([]);
    });
  });

  describe("fields of related documents", () => {
    async function functionWithSecret() {
      const secret = await secrets.insert({
        key: "S",
        value: {encrypted: "x", iv: "i", authTag: "t"} as any
      });
      const envVar = await envVars.insert({key: "A", value: "one"});
      await functions.insert({
        name: "fn",
        timeout: 10,
        language: "javascript",
        triggers: {},
        env_vars: [envVar._id],
        secrets: [secret._id]
      } as any);
      return secret;
    }

    it("should leave out a field of the documents a relation resolves to", async () => {
      const secret = await functionWithSecret();

      const [fn] = await queries.find<any>("function", {
        relations: ["env_vars", "secrets"],
        fields: {"secrets.value": 0}
      });

      expect(fn.secrets).toHaveLength(1);
      expect(String(fn.secrets[0]._id)).toEqual(String(secret._id));
      expect(fn.secrets[0].key).toEqual("S");
      expect(fn.secrets[0]).not.toHaveProperty("value");
      expect(fn.env_vars[0].value).toEqual("one");
    });

    it("should leave out a nested field of the related documents", async () => {
      await functionWithSecret();

      const [fn] = await queries.find<any>("function", {
        relations: ["secrets"],
        fields: {"secrets.value.encrypted": 0}
      });

      expect(fn.secrets[0].value).toEqual({iv: "i", authTag: "t"});
    });

    it("should still resolve the documents when their id is left out", async () => {
      await functionWithSecret();

      const [fn] = await queries.find<any>("function", {
        relations: ["secrets"],
        fields: {"secrets._id": 0}
      });

      expect(fn.secrets).toHaveLength(1);
      expect(fn.secrets[0]).not.toHaveProperty("_id");
      expect(fn.secrets[0].key).toEqual("S");
    });

    it("should keep every field when nothing is excluded", async () => {
      await functionWithSecret();

      const [fn] = await queries.find<any>("function", {relations: ["secrets"]});

      expect(fn.secrets[0].value).toEqual({encrypted: "x", iv: "i", authTag: "t"});
    });
  });

  (postgres ? describe : describe.skip)("relations on PostgreSQL", () => {
    it("should show the name of whoever did an activity, and filter by it", async () => {
      const ann = await identities.insert({
        identifier: "ann",
        password: "x",
        policies: [],
        lastPasswords: [],
        failedAttempts: []
      } as any);
      const bob = await users.insert({
        username: "bob",
        password: "x",
        policies: [],
        lastPasswords: [],
        failedAttempts: []
      } as any);
      const gone = ids.unscoped().generate();
      await activities.insertMany([
        {action: 1, identifier: String(ann._id), resource: ["bucket", "1"], created_at: new Date()},
        {action: 2, username: String(bob._id), resource: ["bucket", "2"], created_at: new Date()},
        {action: 3, identifier: String(gone), resource: ["bucket", "3"], created_at: new Date()}
      ] as any);

      const all = await queries.find<any>("activity", {
        relations: ["identifier", "username"],
        sort: {_id: 1}
      });
      expect(all.map(({identifier, username}) => ({identifier, username}))).toEqual([
        {identifier: "ann"},
        {username: "bob"},
        {}
      ]);

      const byName = await queries.find<any>("activity", {
        relations: ["identifier", "username"],
        where: {identifier: {eq: "ann"}}
      });
      expect(byName.map(activity => activity.action)).toEqual([1]);

      const byResource = await queries.find<any>("activity", {
        where: {resource: {eq: ["bucket", "2"]}}
      });
      expect(byResource.map(activity => activity.action)).toEqual([2]);
    });

    it("should replace the ids of a function with the env vars and secrets they point at", async () => {
      const inserted = await seedEnvVars();
      await functions.insert({
        name: "fn",
        timeout: 10,
        language: "javascript",
        triggers: {},
        env_vars: [inserted.C, inserted.A],
        secrets: []
      } as any);

      const [fn] = await queries.find<any>("function", {relations: ["env_vars", "secrets"]});
      expect(fn.env_vars.map(envVar => envVar.key)).toEqual(["C", "A"]);
      expect(fn.secrets).toEqual([]);

      const [plain] = await queries.find<any>("function", {});
      expect(plain.env_vars.map(String)).toEqual([inserted.C, inserted.A]);
    });

    it("should show the name of a function in its logs, or keep the id of one that is gone", async () => {
      const fn = await functions.insert({
        name: "named",
        timeout: 10,
        language: "javascript",
        triggers: {}
      } as any);
      const gone = String(ids.unscoped().generate());
      for (const target of [String(fn._id), gone]) {
        await logSink.insert({
          function: target,
          event_id: "e",
          content: "hi",
          created_at: new Date(),
          channel: "stdout",
          level: 1
        } as any);
      }

      const found = await queries.find<any>("function_logs", {
        relations: ["function"],
        sort: {_id: 1}
      });
      expect(found.map(log => log.function)).toEqual(["named", gone]);
    });

    it("should refuse a relation the collection does not have", async () => {
      await expect(queries.find("env_var", {relations: ["nope"]})).rejects.toThrow(
        "has no relation named nope"
      );
    });
  });

  (postgres ? describe : describe.skip)("on PostgreSQL", () => {
    it("should answer 404 for a MongoDB filter, and accept an empty one", async () => {
      await expect(queries.find("env_var", {filter: {key: "A"}})).rejects.toBeInstanceOf(
        FilterLanguageError
      );
      await expect(
        queries.paginate("env_var", {filter: {key: "A"}}, "exact")
      ).rejects.toBeInstanceOf(FilterLanguageError);
      expect(await queries.find("env_var", {filter: {}})).toEqual([]);
    });

    it.each([
      [`document.nope == 1`],
      [`document.key == auth.role`],
      [`document.key == "a"; DROP TABLE env_vars`],
      [`document.key ==`]
    ])("should answer 400 for the filter %s", async filter => {
      await expect(queries.find("env_var", {filter})).rejects.toMatchObject({status: 400});
    });

    it("should not let a filter or a sort read a secret one guess at a time", async () => {
      await secrets.insert({key: "S", value: {encrypted: "x", iv: "i", authTag: "t"} as any});

      await expect(
        queries.find("secret", {filter: `document.value.encrypted == "x"`})
      ).rejects.toMatchObject({status: 400});
      await expect(queries.find("secret", {sort: {value: 1}})).rejects.toMatchObject({
        status: 400
      });
      const [secret] = await queries.find<any>("secret", {fields: {value: 0}});
      expect(secret).not.toHaveProperty("value");
    });

    it("should refuse a sort or a condition on a field the collection does not have", async () => {
      await expect(queries.find("env_var", {sort: {nope: 1}})).rejects.toMatchObject({status: 400});
      await expect(queries.find("env_var", {where: {nope: {eq: 1}}})).rejects.toMatchObject({
        status: 400
      });
    });

    it("should refuse a collection it does not know", async () => {
      await expect(queries.find("nope", {})).rejects.toThrow('no collection named "nope"');
    });

    it("should keep a filter value from being read as SQL", async () => {
      await seedEnvVars();
      expect(await queries.find("env_var", {filter: `document.key == "A' OR '1'='1"`})).toEqual([]);
    });
  });
});
