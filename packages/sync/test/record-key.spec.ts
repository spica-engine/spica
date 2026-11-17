import {
  bucketModule,
  envVarModule,
  fetchSystemKeyField,
  functionModule,
  policyModule,
  recordKey,
  recordKeyField,
  secretModule,
  KEY_FIELDS,
  SYSTEM_KEY_FIELDS
} from "@spica-server/sync";

const mongoRecord = {_id: "abc", name: "n"};
const postgresRecord = {id: "abc", name: "n"};

describe("record key", () => {
  it("should read the key a MongoDB record carries", () => {
    expect(recordKeyField(mongoRecord)).toBe("_id");
    expect(recordKey(mongoRecord)).toBe("abc");
  });

  it("should read the key a PostgreSQL record carries", () => {
    expect(recordKeyField(postgresRecord)).toBe("id");
    expect(recordKey(postgresRecord)).toBe("abc");
  });

  it("should prefer _id when a record has both", () => {
    expect(recordKey({_id: "mongo", id: "other"})).toBe("mongo");
  });

  it.each([[{name: "n"}], [null], [undefined], ["abc"], [3]])("should find no key in %p", value => {
    expect(recordKeyField(value)).toBeUndefined();
    expect(recordKey(value)).toBeUndefined();
  });

  it("should know both key names and map each engine to one", () => {
    expect(KEY_FIELDS).toEqual(["_id", "id"]);
    expect(SYSTEM_KEY_FIELDS).toEqual({mongodb: "_id", postgresql: "id"});
  });
});

describe("fetchSystemKeyField", () => {
  const httpFor = (engine: string) => ({get: jest.fn().mockResolvedValue({engine})});

  it.each([
    ["mongodb", "_id"],
    ["postgresql", "id"]
  ])("should map the %s engine to %s", async (engine, field) => {
    const http = httpFor(engine);

    await expect(fetchSystemKeyField(http)).resolves.toBe(field);
    expect(http.get).toHaveBeenCalledWith("status/engine");
  });

  it("should refuse an engine it does not know", async () => {
    await expect(fetchSystemKeyField(httpFor("oracle"))).rejects.toThrow(
      'Unknown database engine "oracle".'
    );
  });
});

describe.each([
  ["env-var", envVarModule, {key: "K", value: "v"}],
  ["secret", secretModule, {key: "K", value: "v"}],
  ["policy", policyModule, {name: "P", description: "d", statement: []}],
  ["bucket", bucketModule, {title: "B", properties: {}}]
] as const)("%s module", (_name, module, body) => {
  const remote = (key: object) => ({get: jest.fn().mockResolvedValue([{...key, ...body}])}) as any;

  it("should take the remote id from a MongoDB record", async () => {
    const [resource] = await module.readRemote(remote({_id: "m1"}));

    expect(resource.id).toBe("m1");
  });

  it("should take the remote id from a PostgreSQL record", async () => {
    const [resource] = await module.readRemote(remote({id: "p1"}));

    expect(resource.id).toBe("p1");
  });

  it("should ignore either key when it looks for updates", () => {
    expect(module.ignoredFields).toEqual(expect.arrayContaining(["_id", "id"]));
  });
});

describe("function module", () => {
  it("should ignore either key in the schema", () => {
    expect(functionModule.ignoredFields).toEqual(expect.arrayContaining(["_id", "id"]));
  });

  it.each([
    ["_id", {_id: "m1"}],
    ["id", {id: "p1"}]
  ])("should read the local id from a schema keyed by %s", (_field, key) => {
    const data = {schema: {name: "fn", ...key}} as any;

    expect(functionModule.extractLocalId(data)).toBe(Object.values(key)[0]);
  });
});
