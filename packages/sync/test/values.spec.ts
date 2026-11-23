import {
  ResourceModule,
  VALUE_ENV_PREFIX,
  MissingValuesError,
  chain,
  envVarModule,
  fromEnv,
  fromMap,
  secretModule,
  withValues
} from "@spica-server/sync";

describe("value handler chain", () => {
  it("resolves from the first handler that has the key", () => {
    const resolver = chain(fromMap({A: "first"}), fromMap({A: "second", B: "second"}));
    expect(resolver.resolve("A")).toBe("first");
    expect(resolver.resolve("B")).toBe("second");
  });

  it("falls through per key and returns undefined when no handler has it", () => {
    const resolver = chain(fromMap({}), fromMap({B: "x"}));
    expect(resolver.resolve("B")).toBe("x");
    expect(resolver.resolve("C")).toBeUndefined();
  });

  it("treats an empty string as a real value", () => {
    const resolver = chain(fromMap({A: ""}), fromMap({A: "fallback"}));
    expect(resolver.resolve("A")).toBe("");
  });

  it("resolves an empty chain to undefined", () => {
    expect(chain().resolve("A")).toBeUndefined();
  });

  it("reads prefixed environment variables only", () => {
    const resolver = fromEnv({[`${VALUE_ENV_PREFIX}A`]: "1", B: "2"});
    expect(resolver.resolve("A")).toBe("1");
    expect(resolver.resolve("B")).toBeUndefined();
  });

  it("does not resolve inherited object properties", () => {
    expect(fromMap({}).resolve("constructor")).toBeUndefined();
    expect(fromEnv({}, "").resolve("toString")).toBeUndefined();
  });
});

describe("withValues", () => {
  const readLocalOf = (mod: ResourceModule, data: object[]): ResourceModule => ({
    ...mod,
    readLocal: async () => data.map((d: any) => ({slug: d.key, data: d}))
  });

  it("injects the resolved value and ignores keys that are not declared", async () => {
    const [mod] = withValues(
      [readLocalOf(envVarModule, [{key: "A"}])],
      fromMap({A: "1", UNDECLARED: "2"})
    );

    const locals = await mod.readLocal("");

    expect(locals).toEqual([{slug: "A", data: {key: "A", value: "1"}}]);
  });

  it("keeps the schema default when nothing resolves", async () => {
    const [mod] = withValues([readLocalOf(envVarModule, [{key: "A", value: "default"}])], chain());
    expect((await mod.readLocal(""))[0].data.value).toBe("default");
  });

  it("leaves other modules untouched", () => {
    const other = {...envVarModule, name: "bucket"};
    expect(withValues([other], chain())[0]).toBe(other);
  });

  it("requires an env-var value even when the env-var exists remotely", () => {
    const [mod] = withValues([envVarModule], chain());
    expect(mod.missingValue!({key: "A"}, {key: "A", value: "x"})).toBe(true);
    expect(mod.missingValue!({key: "A", value: ""}, undefined)).toBe(false);
  });

  it("requires a secret value only when the secret must be created", () => {
    const [mod] = withValues([secretModule], chain());
    expect(mod.missingValue!({key: "S"}, undefined)).toBe(true);
    expect(mod.missingValue!({key: "S"}, {key: "S"})).toBe(false);
    expect(mod.missingValue!({key: "S", value: "v"}, undefined)).toBe(false);
  });
});

describe("MissingValuesError", () => {
  it("lists every missing key and how to set them", () => {
    const error = new MissingValuesError(["env-var/A", "secret/B"]);
    expect(error.message).toContain("env-var/A, secret/B");
    expect(error.message).toContain(`${VALUE_ENV_PREFIX}<KEY>`);
  });

  it("is an Error", () => {
    expect(new MissingValuesError([])).toBeInstanceOf(Error);
  });
});
