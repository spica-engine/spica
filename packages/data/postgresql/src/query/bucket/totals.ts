import {ReadPlan} from "./plan.js";
import {BucketReads} from "./reads.js";

const ESTIMATE_FROM_ROWS = 10_000;

export async function countTotal(
  reads: Pick<BucketReads, "plannerEstimate" | "countMatching">,
  plan: ReadPlan
): Promise<number> {
  if (!plan.conditions.length) {
    const estimate = await reads.plannerEstimate(plan.metadata.main.name);
    if (estimate >= ESTIMATE_FROM_ROWS) {
      return estimate;
    }
  }
  return reads.countMatching(plan);
}
