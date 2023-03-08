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

  it("should write stdout to collection", done => {
    const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
    stdout.write(Buffer.from("this is my message"), async err => {
      expect(err).toBeUndefined();
      expect(
        await db
          .collection("function_logs")
          .findOne({})
          .then(log => {
            expect(log.created_at).toEqual(jasmine.any(Date));
            delete log.created_at;
            return log;
          })
      ).toEqual({
        _id: "__skip",
        content: "this is my message",
        channel: "stdout",
        event_id: "event",
        function: "1",
        level: 1
      });
      done();
    });
  });

  it("should write stderr to collection", done => {
    const [, stderr] = dbOutput.create({eventId: "event", functionId: "1"});
    stderr.write(Buffer.from("this is my message"), async err => {
      expect(err).toBeUndefined();
      expect(
        await db
          .collection("function_logs")
          .findOne({})
          .then(log => {
            expect(log.created_at).toEqual(jasmine.any(Date));
            delete log.created_at;
            return log;
          })
      ).toEqual({
        _id: "__skip",
        content: "this is my message",
        channel: "stderr",
        event_id: "event",
        function: "1",
        level: 4
      });
      done();
    });
  });
});
