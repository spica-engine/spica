import {Test} from "@nestjs/testing";
import {DatabaseService} from "@spica-server/database";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {DatabaseOutput} from "@spica-server/function/runtime/io";

describe("IO Database", () => {
  let db: DatabaseService;
  let dbOutput: DatabaseOutput;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()]
    }).compile();
    db = module.get(DatabaseService);
    dbOutput = new DatabaseOutput(db);
    jasmine.addCustomEqualityTester((first, second) => {
      if (first == "__skip" || second == "__skip") {
        return true;
      }
    });
  });

  it("should create writable stream and a capped collection", done => {
    const stream = dbOutput.create({eventId: "test", functionId: "fn1"});
    setTimeout(async () => {
      expect(stream.writable).toBe(true);
      expect(
        await Promise.all(
          (await db.collections()).map(async c => ({
            cn: c.collectionName,
            capped: await c.isCapped()
          }))
        )
      ).toEqual([
        {
          cn: "function_logs",
          capped: true
        }
      ]);
      done();
    }, 500);
  });

  it("should write to collection", done => {
    const stream = dbOutput.create({eventId: "event", functionId: "1"});
    stream.write(Buffer.from("this is my message"), async err => {
      expect(err).toBeUndefined();
      expect(await db.collection("function_logs").findOne({})).toEqual({
        _id: "__skip",
        content: "this is my message",
        event_id: "event",
        function: "1"
      });
      done();
    });
  });
});
