import {Test} from "@nestjs/testing";
import {DATA_ENGINE, DataModule, ids} from "@spica-server/data";
import {MongoDataAdapter, MongoIdTypes} from "@spica-server/data-mongodb";
import {DatabaseModule} from "@spica-server/database";
import {ID_TYPES} from "@spica-server/interface-data";

describe("MongoDataAdapter", () => {
  it("should connect through DatabaseModule", () => {
    const adapter = MongoDataAdapter.forRoot("mongodb://localhost:27017", {
      database: "spica",
      changeStreamAwaitTimeMS: 100
    });

    expect(adapter.engine).toBe("mongodb");
    expect(adapter.module.imports).toHaveLength(1);
    expect(adapter.module.imports[0]).toMatchObject({module: DatabaseModule});
    expect(adapter.module.exports).toEqual([ID_TYPES]);
  });

  it("should not open a connection of its own for an existing connection", () => {
    expect(MongoDataAdapter.forExistingConnection().module.imports).toBeUndefined();
  });

  it("should bind MongoDB id types when registered", async () => {
    const module = await Test.createTestingModule({
      imports: [DataModule.forRoot(MongoDataAdapter.forExistingConnection())]
    }).compile();

    expect(module.get(DATA_ENGINE)).toBe("mongodb");
    expect(module.get(ID_TYPES)).toBeInstanceOf(MongoIdTypes);
    expect(ids()).toBe(module.get(ID_TYPES));
  });
});
