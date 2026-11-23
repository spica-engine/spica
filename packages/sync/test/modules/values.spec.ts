import {createHmac} from "node:crypto";
import {
  MissingValuesError,
  applyPlan,
  buildPlan,
  chain,
  countChanges,
  envVarModule,
  fromMap,
  memorySource,
  secretModule,
  SYSTEM_KEY_FIELDS,
  withValues
} from "@spica-server/sync";

function projectWith(files: Record<string, object>) {
  return memorySource(
    Object.fromEntries(Object.entries(files).map(([file, data]) => [file, JSON.stringify(data)]))
  );
}

function httpWith(remote: {"env-var"?: object[]; secret?: object[]}) {
  return {
    get: jest.fn(async (url: string) => remote[url as "env-var" | "secret"] ?? []),
    post: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({})
  } as any;
}

async function planWith(
  values: Record<string, string>,
  files: Record<string, object>,
  http: ReturnType<typeof httpWith>
) {
  const modules = withValues([envVarModule, secretModule], chain(fromMap(values)));
  return buildPlan(modules, http, "", {source: projectWith(files)});
}

const SHAPES = Object.entries(SYSTEM_KEY_FIELDS);

describe.each(SHAPES)("sync with resolved values (%s records)", (_shape, keyField) => {
  it("updates an env var whose resolved value differs from the instance", async () => {
    const http = httpWith({"env-var": [{[keyField]: "1", key: "API_URL", value: "old"}]});

    const plan = await planWith(
      {API_URL: "new"},
      {"env-var/API_URL/schema.yaml": {key: "API_URL"}},
      http
    );

    expect(plan.modules[0].updates.map(e => e.slug)).toEqual(["API_URL"]);
    expect(plan.modules[0].updates[0].changedFields).toEqual(["value"]);
  });

  it("falls back to the schema default for an env var", async () => {
    const http = httpWith({});

    const plan = await planWith(
      {},
      {"env-var/API_URL/schema.yaml": {key: "API_URL", value: "default"}},
      http
    );

    await applyPlan(plan, http);

    expect(http.post).toHaveBeenCalledWith("env-var", {key: "API_URL", value: "default"});
  });

  it("creates a new secret with the resolved value", async () => {
    const http = httpWith({});

    const plan = await planWith({TOKEN: "s3"}, {"secret/TOKEN/schema.yaml": {key: "TOKEN"}}, http);
    await applyPlan(plan, http);

    expect(http.post).toHaveBeenCalledWith("secret", {key: "TOKEN", value: "s3"});
  });

  it("re-applies an existing secret that has no remote hash yet", async () => {
    const http = httpWith({secret: [{[keyField]: "7", key: "TOKEN"}]});

    const plan = await planWith({TOKEN: "s3"}, {"secret/TOKEN/schema.yaml": {key: "TOKEN"}}, http);
    await applyPlan(plan, http);

    expect(http.put).toHaveBeenCalledWith("secret/7", {key: "TOKEN", value: "s3"});
  });

  it("leaves an existing secret whose local value matches the remote hash", async () => {
    const value_hash = createHmac("sha256", "salt").update("s3").digest("hex");
    const http = httpWith({secret: [{[keyField]: "7", key: "TOKEN", salt: "salt", value_hash}]});

    const plan = await planWith({TOKEN: "s3"}, {"secret/TOKEN/schema.yaml": {key: "TOKEN"}}, http);
    await applyPlan(plan, http);

    expect(countChanges(plan)).toBe(0);
    expect(http.put).not.toHaveBeenCalled();
  });

  it("leaves an existing secret without a local value alone", async () => {
    const http = httpWith({secret: [{[keyField]: "7", key: "TOKEN"}]});

    const plan = await planWith({}, {"secret/TOKEN/schema.yaml": {key: "TOKEN"}}, http);

    expect(plan.modules[1].updates).toEqual([]);
    expect(plan.modules[1].creates).toEqual([]);
  });

  it("fails the plan before any change when values are missing", async () => {
    const http = httpWith({});

    const error = await planWith(
      {},
      {
        "env-var/API_URL/schema.yaml": {key: "API_URL"},
        "secret/TOKEN/schema.yaml": {key: "TOKEN"}
      },
      http
    ).catch(e => e);

    expect(error).toBeInstanceOf(MissingValuesError);
    expect(error.missing).toEqual(["env-var/API_URL", "secret/TOKEN"]);
    expect(http.post).not.toHaveBeenCalled();
  });
});
