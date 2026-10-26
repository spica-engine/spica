import {Test} from "@nestjs/testing";
import {Logger} from "@nestjs/common";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {DatabaseTestingModule, stream} from "@spica-server/database-testing";
import {DatabaseOutput} from "@spica-server/function-runtime-io";
import {generateLog, getLoggerConsole} from "@spica-server/function-runtime-logger";
import {LogLevels} from "@spica-server/interface-function-runtime";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("IO Database", () => {
  let db: DatabaseService;
  let dbOutput: DatabaseOutput;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()]
    }).compile();
    db = module.get(DatabaseService);
    dbOutput = new DatabaseOutput(db);
  });

  afterEach(async () => {
    await db.collection("function_logs").drop();
  });

  describe("when the log cannot be persisted", () => {
    // The insert is fire-and-forget, so a rejection has no caller to surface it. Before this was
    // caught it became an unhandled rejection, which terminates the process under Node >= 15.
    let insertOne: jest.Mock;
    let loggedErrors: string[];

    beforeEach(async () => {
      // the outer afterEach drops this collection, and these tests never actually insert into it
      await db.createCollection("function_logs");

      loggedErrors = [];
      insertOne = jest
        .fn()
        .mockRejectedValue(new Error("Client must be connected before running operations"));
      // db.collection() hands back a new instance per call, so the failure has to be injected at
      // the seam DatabaseOutput reads from in its constructor.
      jest.spyOn(db, "collection").mockReturnValue({insertOne} as any);
      jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation((message: string) => loggedErrors.push(message));
      dbOutput = new DatabaseOutput(db);
    });

    afterEach(() => jest.restoreAllMocks());

    it("should not emit an unhandled rejection", async () => {
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on("unhandledRejection", onUnhandled);

      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      stdout.write(Buffer.from("this is my message"));
      await sleep(1000);

      process.off("unhandledRejection", onUnhandled);

      expect(insertOne).toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    });

    it("should report the failure instead of swallowing it", async () => {
      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      stdout.write(Buffer.from("this is my message"));
      await sleep(1000);

      expect(loggedErrors).toEqual([
        "Failed to persist stdout log of function 1: Client must be connected before running operations"
      ]);
    });

    it("should keep the stream flowing so the function is not blocked", async () => {
      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      const written = await new Promise<Error>(resolve =>
        stdout.write(Buffer.from("this is my message"), err => resolve(err))
      );

      expect(written).toEqual(null);
    });
  });

  it("should write stdout to collection", done => {
    const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
    stdout.write(Buffer.from("this is my message"), async err => {
      await sleep(5000);
      expect(err).toEqual(null);
      expect(
        db
          .collection("function_logs")
          .findOne({})
          .then(log => {
            expect(log.created_at).toEqual(expect.any(Date));
            expect(ObjectId.isValid(log._id)).toBe(true);
            delete log.created_at;
            delete log._id;
            return log;
          })
      ).resolves.toEqual({
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
      await sleep(5000);

      expect(err).toEqual(null);
      expect(
        await db
          .collection("function_logs")
          .findOne({})
          .then(log => {
            expect(log.created_at).toEqual(expect.any(Date));
            expect(ObjectId.isValid(log._id)).toBe(true);
            delete log.created_at;
            delete log._id;
            return log;
          })
      ).toEqual({
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

    it("should write debug message", done => {
      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      const debug = generateLog("This is a debug message", LogLevels.DEBUG);

      stdout.write(Buffer.from(debug), async err => {
        await sleep(5000);

        expect(err).toEqual(null);
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => {
                expect(log.created_at).toEqual(expect.any(Date));
                expect(ObjectId.isValid(log._id)).toBe(true);
              });
              logs.forEach(log => {
                delete log.created_at;
                delete log._id;
              });
              return logs;
            })
        ).toEqual([
          {
            content: "This is a debug message",
            channel: "stdout",
            event_id: "event",
            function: "1",
            level: 0
          }
        ]);
        done();
      });
    });

    it("should write log message", done => {
      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      const log = generateLog("This is a log message", LogLevels.LOG);

      stdout.write(Buffer.from(log), async err => {
        await sleep(5000);

        expect(err).toEqual(null);
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => {
                expect(log.created_at).toEqual(expect.any(Date));
                expect(ObjectId.isValid(log._id)).toBe(true);
              });
              logs.forEach(log => {
                delete log.created_at;
                delete log._id;
              });
              return logs;
            })
        ).toEqual([
          {
            content: "This is a log message",
            channel: "stdout",
            event_id: "event",
            function: "1",
            level: 1
          }
        ]);
        done();
      });
    });

    it("should write info message", done => {
      const [stdout] = dbOutput.create({eventId: "event", functionId: "1"});
      const info = generateLog("This is a info message", LogLevels.INFO);

      stdout.write(Buffer.from(info), async err => {
        await sleep(5000);

        expect(err).toEqual(null);
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => {
                expect(log.created_at).toEqual(expect.any(Date));
                expect(ObjectId.isValid(log._id)).toBe(true);
              });
              logs.forEach(log => {
                delete log.created_at;
                delete log._id;
              });
              return logs;
            })
        ).toEqual([
          {
            content: "This is a info message",
            channel: "stdout",
            event_id: "event",
            function: "1",
            level: 2
          }
        ]);
        done();
      });
    });

    it("should write warn message", done => {
      const [, stderr] = dbOutput.create({eventId: "event", functionId: "1"});
      const warning = generateLog("This is a warning message", LogLevels.WARN);

      stderr.write(Buffer.from(warning), async err => {
        await sleep(5000);

        expect(err).toEqual(null);
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => {
                expect(log.created_at).toEqual(expect.any(Date));
                expect(ObjectId.isValid(log._id)).toBe(true);
              });
              logs.forEach(log => {
                delete log.created_at;
                delete log._id;
              });
              return logs;
            })
        ).toEqual([
          {
            content: "This is a warning message",
            channel: "stderr",
            event_id: "event",
            function: "1",
            level: 3
          }
        ]);
        done();
      });
    });

    it("should write error message", done => {
      const [, stderr] = dbOutput.create({eventId: "event", functionId: "1"});
      const error = generateLog("This is an error message", LogLevels.ERROR);

      stderr.write(Buffer.from(error), async err => {
        await sleep(5000);

        expect(err).toEqual(null);
        expect(
          await db
            .collection("function_logs")
            .find()
            .toArray()
            .then(logs => {
              logs.forEach(log => {
                expect(log.created_at).toEqual(expect.any(Date));
                expect(ObjectId.isValid(log._id)).toBe(true);
              });
              logs.forEach(log => {
                delete log.created_at;
                delete log._id;
              });
              return logs;
            })
        ).toEqual([
          {
            content: "This is an error message",
            channel: "stderr",
            event_id: "event",
            function: "1",
            level: 4
          }
        ]);
        done();
      });
    });
  });
});
