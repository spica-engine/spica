import {VM2Executor} from "./executor";

describe("VM2Executor", () => {
  let executor: VM2Executor;

  beforeEach(() => {
    executor = new VM2Executor();
    // Remove jasmines unhandledRejection listener
    process.removeAllListeners("unhandledRejection");
  });

  it("should handle sync errors", async () => {
    const logger = jasmine.createSpyObj("console", ["error", "log"]);

    expect(
      await executor
        .execute({
          context: null,
          target: {
            handler: "default",
            id: "test"
          },
          cwd: "/tmp",
          logger: logger,
          memoryLimit: 100,
          timeout: 100,
          parameters: [],
          script: `
            export default function() {
                throw new Error("I'm the evil");
            }`
        })
        .catch(e => e.message)
    ).toBe("I'm the evil");
  });

  it("should handle async errors", async () => {
    const logger = jasmine.createSpyObj("console", ["error", "log"]);
    expect(
      await executor
        .execute({
          context: null,
          target: {
            handler: "default",
            id: "test"
          },
          cwd: "/tmp",
          logger: logger,
          memoryLimit: 100,
          timeout: 100,
          parameters: [],
          script: `
            export default function() {
                Promise.reject(new Error("I'm the evil"));
            }`
        })
        .catch(e => e.message)
    ).toBe("I'm the evil");
  });

  it("should return last expression", async () => {
    expect(
      await executor.execute({
        context: null,
        target: {
          handler: "default",
          id: "test"
        },
        cwd: "/tmp",
        logger: jasmine.createSpyObj("console", ["error"]),
        memoryLimit: 100,
        timeout: 100,
        parameters: [],
        script: `
            export default function() {
                return Promise.resolve({message: true});
            }`
      })
    ).toEqual({message: true});
  });
});
