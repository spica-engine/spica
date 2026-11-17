import {Injectable} from "@nestjs/common";
import * as expression from "@spica-server/bucket-expression";
import {Bucket, BucketRuleValidator} from "@spica-server/interface-bucket";

@Injectable()
export class MongoBucketRuleValidator implements BucketRuleValidator {
  async validateReadRule(bucket: Bucket): Promise<void> {
    expression.extractPropertyMap(bucket.acl.read);
    expression.aggregate(
      bucket.acl.read,
      {
        auth: {
          identifier: "",
          policies: []
        },
        document: {}
      },
      "match"
    );
  }

  // MongoDB has never checked field level rules when a bucket is saved, and rules that saved before
  // must keep saving.
  async validateFieldRules(): Promise<void> {}
}
