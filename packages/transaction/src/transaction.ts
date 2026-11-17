export interface TransactionStep {
  execute: () => Promise<void>;
  rollback: () => Promise<void>;
  native?: boolean;
}

export type TransactionRunner = <R>(work: () => Promise<R>) => Promise<R>;

export const TRANSACTION_RUNNER = Symbol.for("SPICA_TRANSACTION_RUNNER");

export class TransactionError extends Error {
  readonly rollbackErrors: Error[];
  readonly originalError: Error;

  constructor(originalError: Error, rollbackErrors: Error[]) {
    super(originalError.message);
    this.name = "TransactionError";
    this.stack = originalError.stack;
    this.rollbackErrors = rollbackErrors;
    this.originalError = originalError;
  }
}

export class TransactionExecutor {
  private steps: TransactionStep[] = [];

  constructor(private readonly runner?: TransactionRunner) {}

  add(step: TransactionStep): TransactionExecutor {
    this.steps.push(step);
    return this;
  }

  async execute(): Promise<void> {
    const succeededSteps: TransactionStep[] = [];

    const run = async () => {
      for (const step of this.steps) {
        await step.execute();
        succeededSteps.push(step);
      }
    };

    try {
      await (this.runner ? this.runner(run) : run());
    } catch (error) {
      await this.failWith(error, succeededSteps);
    }
  }

  private async failWith(error: unknown, succeededSteps: TransactionStep[]): Promise<never> {
    const rollbackErrors = await this.rollback(
      this.runner ? succeededSteps.filter(step => !step.native) : succeededSteps
    );

    if (rollbackErrors.length > 0) {
      throw new TransactionError(
        error instanceof Error ? error : new Error(String(error)),
        rollbackErrors
      );
    }

    throw error;
  }

  private async rollback(succeededSteps: TransactionStep[]): Promise<Error[]> {
    const rollbackErrors: Error[] = [];

    for (let i = succeededSteps.length - 1; i >= 0; i--) {
      try {
        await succeededSteps[i].rollback();
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError))
        );
      }
    }

    return rollbackErrors;
  }
}
