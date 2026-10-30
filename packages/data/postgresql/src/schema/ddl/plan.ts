export interface UpdatePlan {
  dropForeignKeys: string[];
  apply: string[];
  finish: string[];
}

export type PlanStep =
  | "dropForeignKeys"
  | "dropIndexes"
  | "dropChecks"
  | "dropOldKey"
  | "dropTables"
  | "createTables"
  | "addColumns"
  | "prepareNewKey"
  | "dropColumns"
  | "reshapeKey"
  | "alterTypes"
  | "alterNullability"
  | "promoteKey"
  | "addChecks"
  | "addForeignKeys"
  | "createIndexes"
  | "cleanupKey";

const APPLY_ORDER: PlanStep[] = [
  "dropIndexes",
  "dropChecks",
  "dropOldKey",
  "dropTables",
  "createTables",
  "addColumns",
  "prepareNewKey",
  "dropColumns",
  "reshapeKey",
  "alterTypes",
  "alterNullability",
  "promoteKey",
  "addChecks"
];

const FINISH_ORDER: PlanStep[] = ["addForeignKeys", "createIndexes", "cleanupKey"];

export class PlanBuilder {
  private readonly steps = new Map<PlanStep, string[]>();

  add(step: PlanStep, ...statements: string[]) {
    this.steps.set(step, [...(this.steps.get(step) ?? []), ...statements]);
  }

  build(): UpdatePlan {
    const statementsOf = (order: PlanStep[]) => order.flatMap(step => this.steps.get(step) ?? []);
    return {
      dropForeignKeys: this.steps.get("dropForeignKeys") ?? [],
      apply: statementsOf(APPLY_ORDER),
      finish: statementsOf(FINISH_ORDER)
    };
  }
}

export const statementsOf = (plan: UpdatePlan) => [
  ...plan.dropForeignKeys,
  ...plan.apply,
  ...plan.finish
];

export const mergePlans = (plans: UpdatePlan[]): UpdatePlan => ({
  dropForeignKeys: plans.flatMap(plan => plan.dropForeignKeys),
  apply: plans.flatMap(plan => plan.apply),
  finish: plans.flatMap(plan => plan.finish)
});
