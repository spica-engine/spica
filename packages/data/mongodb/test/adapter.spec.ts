import {Global, Module} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DATA_ENGINE, DataModule, ids, PassthroughResultShaper} from "@spica-server/data";
import {
  MongoCollectionQueryFacade,
  MongoDataAdapter,
  MongoDataHealth,
  MongoIdTypes
} from "@spica-server/data-mongodb";
import {DatabaseModule, DatabaseService} from "@spica-server/database";
import {
  CHANGE_FEED,
  COLLECTION_NAMES,
  COLLECTION_QUERY,
  DATA_HEALTH,
  ID_TYPES,
  REPOSITORY_CLASSES,
  RESULT_SHAPER
} from "@spica-server/interface-data";
import {BUCKET_QUERY, BUCKET_WRITE} from "@spica-server/interface-bucket-common";

@Global()
@Module({providers: [{provide: DatabaseService, useValue: {}}], exports: [DatabaseService]})
class ExistingConnectionModule {}

describe("MongoDataAdapter", () => {
  it("should connect through DatabaseModule", () => {
    const adapter = MongoDataAdapter.forRoot("mongodb://localhost:27017", {
      database: "spica",
      changeStreamAwaitTimeMS: 100
    });

    expect(adapter.engine).toBe("mongodb");
    expect(adapter.module.imports).toHaveLength(1);
    expect(adapter.module.imports[0]).toMatchObject({module: DatabaseModule});
    expect(adapter.module.exports).toEqual([
      ID_TYPES,
      RESULT_SHAPER,
      COLLECTION_QUERY,
      BUCKET_QUERY,
      BUCKET_WRITE,
      REPOSITORY_CLASSES,
      COLLECTION_NAMES,
      DATA_HEALTH,
      CHANGE_FEED
    ]);
  });

  it("should not open a connection of its own for an existing connection", () => {
    expect(MongoDataAdapter.forExistingConnection().module.imports).toBeUndefined();
  });

  it("should bind MongoDB id types when registered", async () => {
    const module = await Test.createTestingModule({
      imports: [
        ExistingConnectionModule,
        DataModule.forRoot(MongoDataAdapter.forExistingConnection())
      ]
    }).compile();

    expect(module.get(DATA_ENGINE)).toBe("mongodb");
    expect(module.get(ID_TYPES)).toBeInstanceOf(MongoIdTypes);
    expect(ids()).toBe(module.get(ID_TYPES));
  });

  it("should provide the query facade and a passthrough result shaper", async () => {
    const module = await Test.createTestingModule({
      imports: [
        ExistingConnectionModule,
        DataModule.forRoot(MongoDataAdapter.forExistingConnection())
      ]
    }).compile();

    expect(module.get(COLLECTION_QUERY)).toBeInstanceOf(MongoCollectionQueryFacade);
    expect(module.get(RESULT_SHAPER)).toBeInstanceOf(PassthroughResultShaper);
  });

  it("should ping the database to check its health", async () => {
    const db = {command: jest.fn().mockResolvedValue({ok: 1})};

    await new MongoDataHealth(db as any).ping();
    db.command.mockRejectedValueOnce(new Error("down"));

    expect(db.command).toHaveBeenCalledWith({ping: 1});
    await expect(new MongoDataHealth(db as any).ping()).rejects.toThrow("down");
  });
});
