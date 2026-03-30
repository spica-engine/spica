import {RealtimeOptionsBuilder} from "@spica-server/realtime";
import * as expression from "@spica-server/bucket/expression";
import {aggregate} from "@spica-server/bucket/expression";
import {
  authIdToString,
  filterReviver,
  constructFilterValues
} from "@spica-server/bucket/common";
import {Bucket} from "@spica-server/interface/bucket";

export class BucketDataOptionsBuilder extends RealtimeOptionsBuilder {
  applyAclRule(schema: Bucket, req: any): this {
    this.ensureAndFilter();
    const ruleMatch = expression.aggregate(schema.acl.read, {auth: req.user}, "match");
    this.options.filter.$and.push(ruleMatch);
    return this;
  }

  async applyBucketFilter(
    rawFilter: string,
    schema: Bucket,
    bucketResolver: (id: string) => Promise<Bucket>
  ): Promise<this> {
    this.ensureAndFilter();

    let parsedFilter = parseFilter(
      (value: string) => JSON.parse(value, filterReviver),
      rawFilter
    );

    if (parsedFilter) {
      parsedFilter = await constructFilterValues(parsedFilter, schema, bucketResolver);
    } else {
      parsedFilter = parseFilter(aggregate, rawFilter, {}, "match");
    }

    if (!parsedFilter) {
      throw new BucketDataOptionsError(
        400,
        "Error occured while parsing the filter. Please ensure that filter is a valid JSON or expression."
      );
    }

    this.options.filter.$and.push(parsedFilter);
    return this;
  }

  private ensureAndFilter(): void {
    if (!this.options.filter) {
      this.options.filter = {};
    }
    if (!this.options.filter.$and) {
      this.options.filter.$and = [];
    }
  }

  static async fromBucketQuery(
    req: any,
    schema: Bucket,
    bucketResolver: (id: string) => Promise<Bucket>,
    shouldApplyAcl: boolean
  ): Promise<any> {
    const builder = new BucketDataOptionsBuilder();

    const normalizedReq = authIdToString(req);

    if (shouldApplyAcl) {
      builder.applyAclRule(schema, normalizedReq);
    }

    if (normalizedReq.query.has("filter")) {
      await builder.applyBucketFilter(
        normalizedReq.query.get("filter"),
        schema,
        bucketResolver
      );
    }

    if (normalizedReq.query.has("sort")) {
      builder.sort(normalizedReq.query.get("sort"));
    }

    if (normalizedReq.query.has("limit")) {
      builder.limit(normalizedReq.query.get("limit"));
    }

    if (normalizedReq.query.has("skip")) {
      builder.skip(normalizedReq.query.get("skip"));
    }

    return builder.result();
  }
}

export class BucketDataOptionsError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "BucketDataOptionsError";
  }
}

function parseFilter(method: (...params: any) => any, ...params: any) {
  try {
    return method(...params);
  } catch (e) {
    return false;
  }
}
