import {Bucket} from "./bucket.js";

export interface BucketRuleValidator {
  /**
   * Throws when the read rule cannot be applied to this bucket on the running engine.
   */
  validateReadRule(bucket: Bucket): Promise<void>;
}

export const BUCKET_RULE_VALIDATOR = Symbol.for("SPICA_BUCKET_RULE_VALIDATOR");
