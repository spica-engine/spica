import {Inject, Injectable, Module, Optional} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DataModule, provideRepository} from "@spica-server/data";
import {ID_TYPES, REPOSITORY_CLASSES} from "@spica-server/interface-data";

const BOOK_REPOSITORY = Symbol.for("BOOK_REPOSITORY");
const MISSING_REPOSITORY = Symbol.for("MISSING_REPOSITORY");
const BOOK_OPTIONS = Symbol.for("BOOK_OPTIONS");

const created: unknown[] = [];

@Injectable()
class EngineBookRepository {
  constructor(
    @Inject(BOOK_OPTIONS) readonly options: {limit: number},
    @Optional() @Inject("unknown") readonly missing?: unknown
  ) {
    created.push(this);
  }
}

@Module({
  providers: [{provide: BOOK_OPTIONS, useValue: {limit: 3}}, provideRepository(BOOK_REPOSITORY)],
  exports: [BOOK_REPOSITORY]
})
class BookModule {}

@Module({providers: [provideRepository(MISSING_REPOSITORY)]})
class MissingModule {}

const adapter = {
  engine: "fake",
  module: {
    module: class FakeAdapterModule {},
    providers: [
      {provide: ID_TYPES, useValue: {}},
      {provide: REPOSITORY_CLASSES, useValue: new Map([[BOOK_REPOSITORY, EngineBookRepository]])}
    ],
    exports: [ID_TYPES, REPOSITORY_CLASSES]
  }
};

describe("provideRepository", () => {
  beforeEach(() => (created.length = 0));

  it("should create the engine's repository with the calling module's providers", async () => {
    const module = await Test.createTestingModule({
      imports: [DataModule.forRoot(adapter), BookModule]
    }).compile();

    const repository = module.get<EngineBookRepository>(BOOK_REPOSITORY);
    expect(repository).toBeInstanceOf(EngineBookRepository);
    expect(repository.options).toEqual({limit: 3});
    expect(repository.missing).toBeUndefined();
    expect(created).toEqual([repository]);
  });

  it("should not create repositories of modules that are not loaded", async () => {
    await Test.createTestingModule({imports: [DataModule.forRoot(adapter)]}).compile();

    expect(created).toEqual([]);
  });

  it("should fail clearly when the adapter does not provide the repository", async () => {
    await expect(
      Test.createTestingModule({imports: [DataModule.forRoot(adapter), MissingModule]}).compile()
    ).rejects.toThrow("The data adapter does not provide MISSING_REPOSITORY.");
  });
});
