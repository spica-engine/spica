import {Test} from "@nestjs/testing";
import {DATA_ENGINE} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {DATA_HEALTH, PG_POOL} from "@spica-server/interface-data";
import {MINIMUM_SERVER_VERSION_NUM} from "@spica-server/data-postgresql";

describe("PostgreSQL connection", () => {
  let module;

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [DatabaseTestingModule.postgres()]}).compile();
    await module.init();
  });

  afterAll(() => module.close());

  it("binds the postgresql engine", () => {
    expect(module.get(DATA_ENGINE)).toBe("postgresql");
  });

  it("connects to a server of the minimum version or newer", async () => {
    const {rows} = await module.get(PG_POOL).query("SHOW server_version_num");
    expect(Number(rows[0].server_version_num)).toBeGreaterThanOrEqual(MINIMUM_SERVER_VERSION_NUM);
  });

  it("answers the health ping", async () => {
    await expect(module.get(DATA_HEALTH).ping()).resolves.toBeUndefined();
  });

  it("gives each module its own database", async () => {
    const other = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()]
    }).compile();
    await other.init();
    const names = await Promise.all(
      [module, other].map(async m => {
        const {rows} = await m.get(PG_POOL).query("SELECT current_database() AS name");
        return rows[0].name;
      })
    );
    await other.close();
    expect(names[0]).not.toEqual(names[1]);
  });
});
