import type {BucketType} from "../../store/api/bucketApi";

export type BucketHealthStatus = "healthy" | "attention" | "critical";

/**
 * A document count above this (with no custom indexes declared on the bucket)
 * is treated as a likely-slow-query risk. Chosen conservatively: below this a
 * default collection scan is cheap enough not to warrant a warning.
 */
export const LARGE_DOCUMENT_THRESHOLD = 50_000;

/** At/above this fraction of a configured countLimit the bucket is "nearing" its cap. */
export const COUNT_LIMIT_ATTENTION_RATIO = 0.8;

/**
 * Health heuristic — derived ONLY from data available without MongoDB profiling
 * (the bucket schema + a cheap document count). Priority: critical > attention > healthy.
 *
 *   1. countLimit set and count >= countLimit          -> "critical"  (at/over the configured cap)
 *   2. countLimit set and count >= 80% of countLimit   -> "attention" (nearing the cap)
 *   3. count > LARGE_DOCUMENT_THRESHOLD and the bucket  -> "attention" (large + unindexed:
 *      declares no custom `indexes`                        queries likely fall back to COLLSCAN)
 *   4. otherwise                                        -> "healthy"
 *
 * This is intentionally simple and honest — it never claims metrics it cannot compute.
 * The same wording is surfaced in the pill tooltip so the rule can be refined later.
 */
export function deriveBucketHealth(count: number, bucket: BucketType): BucketHealthStatus {
  const countLimit = bucket.documentSettings?.countLimit;
  const hasCustomIndexes = (bucket.indexes?.length ?? 0) > 0;

  if (typeof countLimit === "number" && countLimit > 0) {
    if (count >= countLimit) return "critical";
    if (count >= countLimit * COUNT_LIMIT_ATTENTION_RATIO) return "attention";
  }

  if (count > LARGE_DOCUMENT_THRESHOLD && !hasCustomIndexes) return "attention";

  return "healthy";
}

export function healthReason(count: number, bucket: BucketType): string {
  const status = deriveBucketHealth(count, bucket);
  const countLimit = bucket.documentSettings?.countLimit;
  const hasCustomIndexes = (bucket.indexes?.length ?? 0) > 0;

  if (status === "critical") {
    return `At or over the configured document limit (${count} / ${countLimit}).`;
  }
  if (status === "attention") {
    if (typeof countLimit === "number" && countLimit > 0 && count >= countLimit * COUNT_LIMIT_ATTENTION_RATIO) {
      return `Nearing the configured document limit (${count} / ${countLimit}).`;
    }
    return `Large collection (${count} documents) with no custom indexes — queries may fall back to a full scan.`;
  }
  return hasCustomIndexes
    ? "Within limits and has custom indexes."
    : "Within limits.";
}

export const HEALTH_LABELS: Record<BucketHealthStatus, string> = {
  healthy: "Healthy",
  attention: "Attention",
  critical: "Critical",
};
