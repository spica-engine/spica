export interface TransactionStep {
  execute: () => Promise<void>;
  rollback: () => Promise<void>;
}

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

  add(step: TransactionStep): TransactionExecutor {
    this.steps.push(step);
    return this;
  }

  async execute(): Promise<void> {
    const succeededSteps: TransactionStep[] = [];

    for (const step of this.steps) {
      try {
        await step.execute();
        succeededSteps.push(step);
      } catch (error) {
        const rollbackErrors = await this.rollback(succeededSteps);

        if (rollbackErrors.length > 0) {
          throw new TransactionError(
            error instanceof Error ? error : new Error(String(error)),
            rollbackErrors
          );
        }

        throw error;
      }
    }
  }

  private async rollback(succeededSteps: TransactionStep[]): Promise<Error[]> {
    const rollbackErrors: Error[] = [];

    // Best-effort rollback in reverse order
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
