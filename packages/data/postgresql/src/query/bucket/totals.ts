import {CountPlan, Reads} from "../read.js";
import {ReadPlan, TABLE} from "./plan.js";

const ESTIMATE_FROM_ROWS = 10_000;

export const countPlanOf = (plan: ReadPlan): CountPlan => ({
  table: plan.metadata.main.name,
  alias: TABLE,
  conditions: plan.conditions,
  joins: plan.joins,
  values: plan.values,
  conditionValues: plan.conditionValues
});

export async function countTotal(
  reads: Pick<Reads, "plannerEstimate" | "countMatching">,
  plan: CountPlan,
  {exact = false}: {exact?: boolean} = {}
): Promise<number> {
  if (!plan.conditions.length && !exact) {
    const estimate = await reads.plannerEstimate(plan.table);
    if (estimate >= ESTIMATE_FROM_ROWS) {
      return estimate;
    }
  }
  return reads.countMatching(plan);
}
