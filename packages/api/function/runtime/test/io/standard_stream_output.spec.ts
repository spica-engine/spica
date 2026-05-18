import {StandardStreamOutput} from "@spica-server/function-runtime-io";
import {Writable} from "stream";

describe("StandardStreamOutput", () => {
  let io: StandardStreamOutput;

  beforeEach(() => {
    io = new StandardStreamOutput();
  });

  it("should create writable streams", () => {
    const [stdout, stderr] = io.create({eventId: "event1", functionId: "fn1"});
    expect(stdout.writable).toBe(true);
    expect(stderr.writable).toBe(true);
  });

  it("should write stdout to process.stdout", done => {
    const [stdout] = io.create({eventId: "event1", functionId: "fn1"});

    const written: Buffer[] = [];
    jest.spyOn(process.stdout, "write").mockImplementation((chunk: any, encodingOrCb?: any, cb?: any) => {
      written.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const callback = typeof encodingOrCb === "function" ? encodingOrCb : typeof cb === "function" ? cb : null;
      if (callback) callback();
      return true;
    });

    stdout.write(Buffer.from("hello stdout"), err => {
      expect(err).toBeFalsy();
      expect(Buffer.concat(written).toString()).toBe("hello stdout");
      (process.stdout.write as jest.Mock).mockRestore();
      done();
    });
  });

  it("should write stderr to process.stderr", done => {
    const [, stderr] = io.create({eventId: "event1", functionId: "fn1"});

    const written: Buffer[] = [];
    jest.spyOn(process.stderr, "write").mockImplementation((chunk: any, encodingOrCb?: any, cb?: any) => {
      written.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const callback = typeof encodingOrCb === "function" ? encodingOrCb : typeof cb === "function" ? cb : null;
      if (callback) callback();
      return true;
    });

    stderr.write(Buffer.from("hello stderr"), err => {
      expect(err).toBeFalsy();
      expect(Buffer.concat(written).toString()).toBe("hello stderr");
      (process.stderr.write as jest.Mock).mockRestore();
      done();
    });
  });

  it("should not close process.stdout when stdout stream ends", done => {
    const [stdout] = io.create({eventId: "event1", functionId: "fn1"});

    const writableSpy = jest.spyOn(process.stdout, "end");

    stdout.end(() => {
      expect(writableSpy).not.toHaveBeenCalled();
      writableSpy.mockRestore();
      done();
    });
  });

  it("should not close process.stderr when stderr stream ends", done => {
    const [, stderr] = io.create({eventId: "event1", functionId: "fn1"});

    const writableSpy = jest.spyOn(process.stderr, "end");

    stderr.end(() => {
      expect(writableSpy).not.toHaveBeenCalled();
      writableSpy.mockRestore();
      done();
    });
  });

  it("should create independent stream pairs per call", () => {
    const [stdout1, stderr1] = io.create({eventId: "event1", functionId: "fn1"});
    const [stdout2, stderr2] = io.create({eventId: "event2", functionId: "fn2"});

    expect(stdout1).not.toBe(stdout2);
    expect(stderr1).not.toBe(stderr2);
  });
});
