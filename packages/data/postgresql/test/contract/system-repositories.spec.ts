import {Test, TestingModule} from "@nestjs/testing";
import {DuplicateKeyError, provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {DASHBOARD_REPOSITORY, DashboardRepository} from "@spica-server/interface-dashboard";
import {ID_TYPES, IdType, IdTypes} from "@spica-server/interface-data";
import {ENV_VAR_REPOSITORY, EnvVarRepository} from "@spica-server/interface-env_var";
import {SECRET_REPOSITORY, SecretRepository} from "@spica-server/interface-secret";
import {STATUS_OPTIONS, STATUS_REPOSITORY, StatusRepository} from "@spica-server/interface-status";
import {clearStorage, waitForMongoIndexes} from "./support.js";

contractSuite("system repositories", engine => {
  let module: TestingModule;
  let idType: IdType;
  let envVars: EnvVarRepository;
  let secrets: SecretRepository;
  let dashboards: DashboardRepository;
  let status: StatusRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        {provide: STATUS_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        provideRepository(ENV_VAR_REPOSITORY),
        provideRepository(SECRET_REPOSITORY),
        provideRepository(DASHBOARD_REPOSITORY),
        provideRepository(STATUS_REPOSITORY)
      ]
    }).compile();
    await module.init();
    await waitForMongoIndexes(engine, module, {env_var: ["key_1"], secret: ["key_1"]});

    idType = module.get<IdTypes>(ID_TYPES).unscoped();
    envVars = module.get(ENV_VAR_REPOSITORY);
    secrets = module.get(SECRET_REPOSITORY);
    dashboards = module.get(DASHBOARD_REPOSITORY);
    status = module.get(STATUS_REPOSITORY);
  }, 120_000);

  beforeEach(() =>
    clearStorage(engine, module, {
      mongodb: ["env_var", "secret", "dashboard", "status"],
      postgresql: ["env_vars", "secrets", "dashboards", "statuses"]
    })
  );

  afterAll(() => module.close());

  const missingId = () => idType.generate();

  describe("env var", () => {
    it("inserts an env var and finds it by id", async () => {
      const updated_at = new Date("2024-01-01T00:00:00Z");
      const inserted = await envVars.insert({key: "A", value: "1", updated_at});

      expect(await envVars.findById(inserted._id)).toMatchObject({
        key: "A",
        value: "1",
        updated_at
      });
      expect(await envVars.findById(missingId())).toBeNull();
    });

    it("reports duplicate keys as DuplicateKeyError", async () => {
      await envVars.insert({key: "A", value: "1"});
      const {_id} = await envVars.insert({key: "B", value: "2"});

      const inserted = await envVars.insert({key: "A", value: "3"}).catch(e => e);
      const replaced = await envVars.replaceById(_id, {key: "A", value: "3"}).catch(e => e);
      const updated = await envVars.updateById(_id, {key: "A"}).catch(e => e);

      for (const error of [inserted, replaced, updated]) {
        expect(error).toBeInstanceOf(DuplicateKeyError);
        expect(error.keyValue).toEqual({key: "A"});
      }
    });

    it("resolves to the env var as it is after a replacement or an update", async () => {
      const {_id} = await envVars.insert({key: "A", value: "1"});

      expect(await envVars.replaceById(_id, {key: "A", value: "2"})).toMatchObject({value: "2"});
      expect(await envVars.updateById(_id, {value: "3"})).toMatchObject({key: "A", value: "3"});
      expect(await envVars.replaceById(missingId(), {key: "Z", value: "1"})).toBeNull();
      expect(await envVars.updateById(missingId(), {value: "1"})).toBeNull();
    });

    it("deletes an env var and resolves to it", async () => {
      const {_id} = await envVars.insert({key: "A", value: "1"});

      expect(await envVars.deleteById(_id)).toMatchObject({key: "A"});
      expect(await envVars.deleteById(_id)).toBeNull();
    });
  });

  describe("secret", () => {
    const encrypted = (value: string) => ({encrypted: value, iv: "iv", authTag: "tag"});

    it("inserts a secret and finds it by id", async () => {
      const inserted = await secrets.insert({key: "S", value: encrypted("x")});

      expect(await secrets.findById(inserted._id)).toMatchObject({key: "S", value: encrypted("x")});
      expect(await secrets.findById(missingId())).toBeNull();
    });

    it("reports duplicate keys as DuplicateKeyError", async () => {
      await secrets.insert({key: "S", value: encrypted("x")});
      const {_id} = await secrets.insert({key: "T", value: encrypted("y")});

      const inserted = await secrets.insert({key: "S", value: encrypted("z")}).catch(e => e);
      const updated = await secrets.updateById(_id, {key: "S"}).catch(e => e);

      for (const error of [inserted, updated]) {
        expect(error).toBeInstanceOf(DuplicateKeyError);
        expect(error.keyValue).toEqual({key: "S"});
      }
    });

    it("resolves to the secret as it was before a replacement or an update", async () => {
      const {_id} = await secrets.insert({key: "S", value: encrypted("one")});

      expect(await secrets.replaceById(_id, {key: "S", value: encrypted("two")})).toMatchObject({
        value: encrypted("one")
      });
      expect(await secrets.updateById(_id, {value: encrypted("three")})).toMatchObject({
        value: encrypted("two")
      });
      expect((await secrets.findById(_id)).value).toEqual(encrypted("three"));
      expect(await secrets.replaceById(missingId(), {key: "Z", value: encrypted("x")})).toBeNull();
      expect(await secrets.updateById(missingId(), {key: "Z"})).toBeNull();
    });

    it("deletes a secret and resolves to it", async () => {
      const {_id} = await secrets.insert({key: "S", value: encrypted("x")});

      expect(await secrets.deleteById(_id)).toMatchObject({key: "S"});
      expect(await secrets.deleteById(_id)).toBeNull();
    });
  });

  describe("dashboard", () => {
    const dashboard = (name: string) => ({
      name,
      icon: "dashboard",
      components: [{name: "chart", url: "https://example.com", type: "iframe", ratio: "16/9"}]
    });

    it("inserts, finds and lists dashboards", async () => {
      const first = await dashboards.insert(dashboard("a"));
      await dashboards.insert(dashboard("b"));

      expect(await dashboards.findById(first._id)).toMatchObject(dashboard("a"));
      expect((await dashboards.findAll()).map(d => d.name)).toEqual(["a", "b"]);
      expect(await dashboards.findById(missingId())).toBeNull();
    });

    it("replaces a dashboard and resolves to the replaced one", async () => {
      const {_id} = await dashboards.insert(dashboard("a"));

      expect(await dashboards.replaceById(_id, {...dashboard("b"), components: []})).toMatchObject({
        name: "b",
        components: []
      });
      expect(await dashboards.replaceById(missingId(), dashboard("x"))).toBeNull();
    });

    it("deletes a dashboard and resolves to it", async () => {
      const {_id} = await dashboards.insert(dashboard("a"));

      expect(await dashboards.deleteById(_id)).toMatchObject({name: "a"});
      expect(await dashboards.deleteById(_id)).toBeNull();
    });
  });

  describe("status", () => {
    const request = (size: number, response: number) => ({
      request: {size},
      response: {size: response}
    });
    const hour = 60 * 60 * 1000;

    it("summarizes nothing when no request was recorded", async () => {
      expect(await status.summarize()).toMatchObject({request: 0, uploaded: 0, downloaded: 0});
    });

    it("adds every recorded request to the totals", async () => {
      await status.record(request(10, 100));
      await status.record(request(20, 200));
      await status.record(request(5, 0));

      expect(await status.summarize()).toMatchObject({request: 3, uploaded: 35, downloaded: 300});
    });

    it("summarizes only the requests of the given range", async () => {
      await status.record(request(10, 100));

      const around = await status.summarize({
        from: new Date(Date.now() - hour),
        to: new Date(Date.now() + hour)
      });
      const past = await status.summarize({
        from: new Date(Date.now() - 2 * hour),
        to: new Date(Date.now() - hour)
      });

      expect(around).toMatchObject({request: 1, uploaded: 10, downloaded: 100});
      expect(past).toMatchObject({request: 0, uploaded: 0, downloaded: 0});
    });

    if (engine.name == "postgresql") {
      it("counts concurrent requests exactly", async () => {
        await Promise.all(Array.from({length: 25}, () => status.record(request(1, 2))));

        expect(await status.summarize()).toEqual({request: 25, uploaded: 25, downloaded: 50});
      });
    }
  });
});
