import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Bucket, BucketRuleValidator} from "@spica-server/interface-bucket";
import {ORM} from "../orm.js";
import {StoredBuckets} from "../repositories/bucket/stored-buckets.js";
import {BucketSchemaError, describeBucket, resolveRelationTargets} from "../schema/index.js";
import {fieldRulesOf} from "./field-rules.js";
import {compileRule, loadRelatedBuckets} from "./rule/index.js";

const UNSAVED_BUCKET_ID = "00000000-0000-0000-0000-000000000000";

@Injectable()
export class PostgresBucketRuleValidator implements BucketRuleValidator {
  private readonly stored: StoredBuckets;

  constructor(@Inject(ORM) orm: Orm) {
    this.stored = new StoredBuckets(orm);
  }

  async validateReadRule(bucket: Bucket): Promise<void> {
    await this.validate(bucket, bucket.acl?.read ? [bucket.acl.read] : []);
  }

  async validateFieldRules(bucket: Bucket): Promise<void> {
    await this.validate(
      bucket,
      fieldRulesOf(bucket).map(([, rule]) => rule)
    );
  }

  private async validate(bucket: Bucket, rules: string[]): Promise<void> {
    if (!rules.length) {
      return;
    }

    const bucketId = bucket._id ? String(bucket._id) : UNSAVED_BUCKET_ID;
    let metadata;
    try {
      const targets = await resolveRelationTargets(bucket, id => this.stored.find(id));
      metadata = describeBucket(bucketId, bucket, targets);
    } catch (error) {
      // The schema manager rejects a bucket that has no table layout, with a better message.
      if (error instanceof BucketSchemaError) {
        return;
      }
      throw error;
    }

    const related = await loadRelatedBuckets({bucket, metadata, bucketId}, rules, id =>
      this.stored.find(id)
    );
    for (const rule of rules) {
      compileRule(rule, {bucket, metadata, auth: {}, related}, []);
    }
  }
}
