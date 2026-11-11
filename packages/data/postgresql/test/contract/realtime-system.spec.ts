import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository, idOf} from "@spica-server/data";
import {clearStorage, contractSuite} from "@spica-server/database-testing";
import {ENV_VAR_REPOSITORY, EnvVarRepository} from "@spica-server/interface-env_var";
import {
  ChunkKind,
  REALTIME,
  Realtime,
  RealtimeOptions,
  StreamChunk
} from "@spica-server/interface-realtime";

const SETTLE_MS = 600;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 15_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

contractSuite("realtime of a system collection", engine => {
  const filterOf = (json: object, expression: string) =>
    engine.name == "postgresql" ? expression : json;
  let module: TestingModule;
  let realtime: Realtime;
  let envVars: EnvVarRepository;
  const subscriptions: {unsubscribe(): void}[] = [];

  const keyOf = (document: any) => String(document?._id);
  const kinds = (chunks: StreamChunk<any>[]) => chunks.map(chunk => ChunkKind[chunk.kind]);

  async function open(options: RealtimeOptions = {}) {
    const chunks: StreamChunk<any>[] = [];
    subscriptions.push(
      realtime.find("env_var", options).subscribe({
        next: chunk => chunks.push(chunk),
        error: error => chunks.push({kind: ChunkKind.Error, document: error})
      })
    );
    await until(() => chunks.some(chunk => chunk.kind == ChunkKind.EndOfInitial));
    await sleep(SETTLE_MS);
    const mark = chunks.length;
    return Object.assign(chunks, {live: () => chunks.slice(mark)});
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [provideRepository(ENV_VAR_REPOSITORY)]
    }).compile();
    await module.init();
    realtime = module.get(REALTIME);
    envVars = module.get(ENV_VAR_REPOSITORY);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(() => clearStorage(engine, module, {mongodb: ["env_var"], postgresql: ["env_vars"]}));

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  it("should send every document and mark the end", async () => {
    await envVars.insert({key: "A", value: "1"});
    await envVars.insert({key: "B", value: "2"});

    const chunks = await open();

    expect(kinds(chunks.slice(0, 3))).toEqual(["Initial", "Initial", "EndOfInitial"]);
    expect(
      chunks
        .slice(0, 2)
        .map(chunk => chunk.document.key)
        .sort()
    ).toEqual(["A", "B"]);
  });

  it("should send what is inserted, updated and deleted", async () => {
    const chunks = await open();

    const inserted = await envVars.insert({key: "A", value: "1"});
    await until(() => chunks.live().length > 0);
    await envVars.replaceById(idOf(inserted), {key: "A", value: "2"});
    await until(() => chunks.live().length > 1);
    await envVars.deleteById(idOf(inserted));
    await until(() => chunks.live().length > 2);

    const [insert, update, remove] = chunks.live();
    expect(insert.kind).toBe(ChunkKind.Insert);
    expect(insert.document.value).toBe("1");
    expect([ChunkKind.Update, ChunkKind.Replace]).toContain(update.kind);
    expect(update.document.value).toBe("2");
    expect(remove.kind).toBe(ChunkKind.Delete);
    expect(keyOf(remove.document)).toBe(String(idOf(inserted)));
  });

  it("should send only what matches the filter, and expunge what stops matching", async () => {
    const chunks = await open({filter: filterOf({key: "A"}, `document.key == "A"`)});

    const kept = await envVars.insert({key: "A", value: "1"});
    await envVars.insert({key: "B", value: "1"});
    await until(() => chunks.live().length > 0);
    await sleep(SETTLE_MS);
    await envVars.replaceById(idOf(kept), {key: "C", value: "1"});
    await until(() => chunks.live().length > 1);

    expect(kinds(chunks.live())).toEqual(["Insert", "Expunge"]);
    expect(chunks.live()[0].document.key).toBe("A");
  });

  it("should send only the documents the resource filter lets through", async () => {
    const allowed = await envVars.insert({key: "A", value: "1"});
    await envVars.insert({key: "B", value: "1"});
    const chunks = await open({resourceFilter: {include: [String(idOf(allowed))], exclude: []}});

    await envVars.insert({key: "C", value: "1"});
    await sleep(SETTLE_MS);

    expect(
      chunks.filter(chunk => chunk.kind == ChunkKind.Initial).map(chunk => chunk.document.key)
    ).toEqual(["A"]);
    expect(chunks.live()).toEqual([]);
  });

  it("should order, skip and limit", async () => {
    await envVars.insert({key: "C", value: "1"});
    await envVars.insert({key: "A", value: "1"});
    await envVars.insert({key: "B", value: "1"});

    const chunks = await open({sort: {key: 1}, skip: 1, limit: 1});

    expect(
      chunks.filter(chunk => chunk.kind == ChunkKind.Initial).map(chunk => chunk.document.key)
    ).toEqual(["B"]);
  });

  it("should send the next document in when one leaves a limited window", async () => {
    const first = await envVars.insert({key: "A", value: "1"});
    await envVars.insert({key: "B", value: "1"});
    await envVars.insert({key: "C", value: "1"});
    const chunks = await open({sort: {key: 1}, limit: 2});

    await envVars.deleteById(idOf(first));
    await until(() => chunks.live().some(chunk => chunk.kind == ChunkKind.Initial));

    expect(kinds(chunks.live())).toContain("Delete");
    expect(
      chunks
        .live()
        .filter(chunk => chunk.kind == ChunkKind.Initial)
        .map(chunk => chunk.document.key)
    ).toEqual(["C"]);
  });
});
