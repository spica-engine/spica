import {
  TransactionExecutor,
  TransactionRunner,
  TransactionStep,
  TransactionError
} from "../src/transaction";

describe("TransactionExecutor", () => {
  it("should execute all steps in order when nothing fails", async () => {
    const order: number[] = [];

    const executor = new TransactionExecutor();
    executor
      .add({
        execute: async () => {
          order.push(1);
        },
        rollback: async () => {}
      })
      .add({
        execute: async () => {
          order.push(2);
        },
        rollback: async () => {}
      })
      .add({
        execute: async () => {
          order.push(3);
        },
        rollback: async () => {}
      });

    await executor.execute();

    expect(order).toEqual([1, 2, 3]);
  });

  it("should roll back succeeded steps in reverse order when a middle step fails", async () => {
    const order: string[] = [];

    const executor = new TransactionExecutor();
    executor
      .add({
        execute: async () => {
          order.push("exec-1");
        },
        rollback: async () => {
          order.push("rollback-1");
        }
      })
      .add({
        execute: async () => {
          order.push("exec-2");
        },
        rollback: async () => {
          order.push("rollback-2");
        }
      })
      .add({
        execute: async () => {
          throw new Error("step 3 failed");
        },
        rollback: async () => {
          order.push("rollback-3");
        }
      })
      .add({
        execute: async () => {
          order.push("exec-4");
        },
        rollback: async () => {
          order.push("rollback-4");
        }
      });

    await expect(executor.execute()).rejects.toThrow("step 3 failed");

    expect(order).toEqual(["exec-1", "exec-2", "rollback-2", "rollback-1"]);
  });

  it("should throw the original error from the failed step", async () => {
    const originalError = new Error("original failure");

    const executor = new TransactionExecutor();
    executor.add({
      execute: async () => {},
      rollback: async () => {}
    });
    executor.add({
      execute: async () => {
        throw originalError;
      },
      rollback: async () => {}
    });

    await expect(executor.execute()).rejects.toBe(originalError);
  });

  it("should not call rollback on the step that failed", async () => {
    const failedRollback = jest.fn();

    const executor = new TransactionExecutor();
    executor
      .add({
        execute: async () => {},
        rollback: async () => {}
      })
      .add({
        execute: async () => {
          throw new Error("fail");
        },
        rollback: failedRollback
      });

    await expect(executor.execute()).rejects.toThrow("fail");
    expect(failedRollback).not.toHaveBeenCalled();
  });

  it("should handle rollback errors gracefully and continue rolling back", async () => {
    const rollbackOrder: number[] = [];

    const executor = new TransactionExecutor();
    executor
      .add({
        execute: async () => {},
        rollback: async () => {
          rollbackOrder.push(1);
        }
      })
      .add({
        execute: async () => {},
        rollback: async () => {
          rollbackOrder.push(2);
          throw new Error("rollback-2 failed");
        }
      })
      .add({
        execute: async () => {},
        rollback: async () => {
          rollbackOrder.push(3);
        }
      })
      .add({
        execute: async () => {
          throw new Error("step 4 failed");
        },
        rollback: async () => {}
      });

    try {
      await executor.execute();
      fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionError);
      const txError = error as TransactionError;
      expect(txError.message).toBe("step 4 failed");
      expect(txError.rollbackErrors).toHaveLength(1);
      expect(txError.rollbackErrors[0].message).toBe("rollback-2 failed");
    }

    // All three succeeded steps attempted rollback (reverse order: 3, 2, 1)
    expect(rollbackOrder).toEqual([3, 2, 1]);
  });

  it("should work with a single step that succeeds", async () => {
    const executed = jest.fn();

    const executor = new TransactionExecutor();
    executor.add({
      execute: async () => {
        executed();
      },
      rollback: async () => {}
    });

    await executor.execute();
    expect(executed).toHaveBeenCalledTimes(1);
  });

  it("should work with a single step that fails without needing rollback", async () => {
    const rollback = jest.fn();

    const executor = new TransactionExecutor();
    executor.add({
      execute: async () => {
        throw new Error("only step failed");
      },
      rollback
    });

    await expect(executor.execute()).rejects.toThrow("only step failed");
    expect(rollback).not.toHaveBeenCalled();
  });

  it("should complete as no-op with an empty step list", async () => {
    const executor = new TransactionExecutor();
    await expect(executor.execute()).resolves.toBeUndefined();
  });

  it("should support chaining via add()", () => {
    const executor = new TransactionExecutor();
    const step: TransactionStep = {
      execute: async () => {},
      rollback: async () => {}
    };

    const result = executor.add(step);
    expect(result).toBe(executor);

    const result2 = result.add(step);
    expect(result2).toBe(executor);
  });

  it("should wrap TransactionError with originalError pointing to the cause", async () => {
    const executor = new TransactionExecutor();
    executor
      .add({
        execute: async () => {},
        rollback: async () => {
          throw new Error("rollback broke");
        }
      })
      .add({
        execute: async () => {
          throw new Error("exec failed");
        },
        rollback: async () => {}
      });

    try {
      await executor.execute();
      fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionError);
      const txError = error as TransactionError;
      expect(txError.originalError).toBeInstanceOf(Error);
      expect(txError.originalError.message).toBe("exec failed");
      expect(txError.rollbackErrors[0].message).toBe("rollback broke");
    }
  });

  it("should handle non-Error thrown values in execute", async () => {
    const executor = new TransactionExecutor();
    executor
      .add({
        execute: async () => {},
        rollback: async () => {
          throw "string rollback error";
        }
      })
      .add({
        execute: async () => {
          throw "string error";
        },
        rollback: async () => {}
      });

    try {
      await executor.execute();
      fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TransactionError);
      const txError = error as TransactionError;
      expect(txError.message).toBe("string error");
      expect(txError.rollbackErrors[0].message).toBe("string rollback error");
    }
  });

  describe("with a runner", () => {
    const events: string[] = [];

    const runner: TransactionRunner = async work => {
      events.push("begin");
      try {
        const result = await work();
        events.push("commit");
        return result;
      } catch (error) {
        events.push("abort");
        throw error;
      }
    };

    const step = (name: string, options: Partial<TransactionStep> = {}): TransactionStep => ({
      execute: async () => {
        events.push(`exec-${name}`);
      },
      rollback: async () => {
        events.push(`rollback-${name}`);
      },
      ...options
    });

    beforeEach(() => {
      events.length = 0;
    });

    it("should run every step inside the runner and commit when nothing fails", async () => {
      await new TransactionExecutor(runner)
        .add(step("db", {native: true}))
        .add(step("file"))
        .execute();

      expect(events).toEqual(["begin", "exec-db", "exec-file", "commit"]);
    });

    it("should leave the native steps to the runner and roll back the others in reverse", async () => {
      const executor = new TransactionExecutor(runner)
        .add(step("db", {native: true}))
        .add(step("file-1"))
        .add(step("file-2"))
        .add(step("broken", {execute: async () => Promise.reject(new Error("failed"))}));

      await expect(executor.execute()).rejects.toThrow("failed");

      expect(events).toEqual([
        "begin",
        "exec-db",
        "exec-file-1",
        "exec-file-2",
        "abort",
        "rollback-file-2",
        "rollback-file-1"
      ]);
    });

    it("should roll back a step that is not native even when it comes first", async () => {
      const executor = new TransactionExecutor(runner)
        .add(step("file"))
        .add(step("db", {native: true}))
        .add(step("broken", {execute: async () => Promise.reject(new Error("failed"))}));

      await expect(executor.execute()).rejects.toThrow("failed");

      expect(events).toEqual(["begin", "exec-file", "exec-db", "abort", "rollback-file"]);
    });

    it("should roll back by hand only after the runner has ended its transaction", async () => {
      let transactionOpen = false;
      const seenOpen: boolean[] = [];
      const tracking: TransactionRunner = async work => {
        transactionOpen = true;
        try {
          return await work();
        } finally {
          transactionOpen = false;
        }
      };
      const executor = new TransactionExecutor(tracking)
        .add(step("file", {rollback: async () => void seenOpen.push(transactionOpen)}))
        .add(step("broken", {execute: async () => Promise.reject(new Error("failed"))}));

      await expect(executor.execute()).rejects.toThrow("failed");

      expect(seenOpen).toEqual([false]);
    });

    it("should roll back the steps that are not native when the commit fails", async () => {
      const failingCommit: TransactionRunner = async work => {
        await work();
        events.push("commit-failed");
        throw new Error("commit failed");
      };
      const executor = new TransactionExecutor(failingCommit)
        .add(step("db", {native: true}))
        .add(step("file"));

      await expect(executor.execute()).rejects.toThrow("commit failed");

      expect(events).toEqual(["exec-db", "exec-file", "commit-failed", "rollback-file"]);
    });

    it("should report the errors of the rollbacks that failed", async () => {
      const executor = new TransactionExecutor(runner)
        .add(step("file", {rollback: async () => Promise.reject(new Error("stuck"))}))
        .add(step("broken", {execute: async () => Promise.reject(new Error("failed"))}));

      const error = await executor.execute().catch(thrown => thrown);

      expect(error).toBeInstanceOf(TransactionError);
      expect(error.message).toBe("failed");
      expect(error.rollbackErrors.map((e: Error) => e.message)).toEqual(["stuck"]);
    });

    it("should roll back every step when there is no runner, native or not", async () => {
      const executor = new TransactionExecutor()
        .add(step("db", {native: true}))
        .add(step("broken", {execute: async () => Promise.reject(new Error("failed"))}));

      await expect(executor.execute()).rejects.toThrow("failed");

      expect(events).toEqual(["exec-db", "rollback-db"]);
    });
  });
});
