import {Test} from "@nestjs/testing";
import {DatabaseService} from "@spica-server/database";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {DatabaseOutput} from "@spica-server/function/runtime/io";
import {generateLog, getLoggerConsole, LogLevels} from "@spica-server/function/runtime/logger";

xdescribe("IO Database", () => {
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
      await stream.wait();

      expect(err).toBeUndefined();
      expect(
        await db
          .collection("function_logs")
          .findOne({})
          .then(log => {
            expect(log.created_at).toEqual(expect.any(Date));
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
      await stream.wait();

      expect(err).toBeUndefined();
      expect(
        await db
          .collection("function_logs")
          .findOne({})
          .then(log => {
            expect(log.created_at).toEqual(expect.any(Date));
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

  describe("with logger", () => {
    let logger: Console;

    beforeEach(() => {
      logger = getLoggerConsole();
    });

    it("should write successfull logs to the database with log level", done => {
      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      const debug = generateLog("This is a debug message", LogLevels.DEBUG);
      const log = generateLog("This is a log message", LogLevels.LOG);
      const info = generateLog("This is an info message", LogLevels.INFO);

      stdout.write(Buffer.from(`${debug}\n${log}\n${info}`), async err => {
        await stream.wait();

        expect(err).toBeUndefined();
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => expect(log.created_at).toEqual(expect.any(Date)));
              logs.forEach(log => delete log.created_at);
              return logs;
            })
        ).toEqual([
          {
            _id: "__skip",
            content: "This is a debug message",
            channel: "stdout",
            event_id: "event",
            function: "1",
            level: 0
          },
          {
            _id: "__skip",
            content: "This is a log message",
            channel: "stdout",
            event_id: "event",
            function: "1",

            level: 1
          },
          {
            _id: "__skip",
            content: "This is an info message",
            channel: "stdout",
            event_id: "event",
            function: "1",
            level: 2
          }
        ]);
        done();
      });
    }, 10000);

    it("should write error logs to the database with log level", done => {
      const [, stderr] = dbOutput.create({eventId: "event", functionId: "1"});
      const warning = generateLog("This is a warning message", LogLevels.WARN);
      const error = generateLog("This is an error message", LogLevels.ERROR);

      stderr.write(Buffer.from(`${warning}\n${error}`), async err => {
        await stream.wait();

        expect(err).toBeUndefined();
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => expect(log.created_at).toEqual(expect.any(Date)));
              logs.forEach(log => delete log.created_at);
              return logs;
            })
        ).toEqual([
          {
            _id: "__skip",
            content: "This is a warning message",
            channel: "stderr",
            event_id: "event",
            function: "1",
            level: 3
          },
          {
            _id: "__skip",
            content: "This is an error message",
            channel: "stderr",
            event_id: "event",
            function: "1",

            level: 4
          }
        ]);
        done();
      });
    }, 10000);
  });
});
