import {authIdToString} from "@spica-server/bucket-common";
import {RealtimeOptions} from "@spica-server/interface-realtime";
import {RealtimeOptionsBuilder, RealtimeOptionsError} from "@spica-server/realtime";

export class ExpressionBucketDataOptionsBuilder extends RealtimeOptionsBuilder {
  applyAcl(user: unknown): this {
    this.options.applyAcl = true;
    this.options.user = user;
    return this;
  }

  applyExpression(rawFilter: string): this {
    if (!rawFilter.trim()) {
      throw new RealtimeOptionsError(400, "Invalid filter: the expression is empty.");
    }
    this.options.filter = rawFilter;
    return this;
  }

  withHashSecret(hashSecret: string | undefined): this {
    if (hashSecret) {
      this.options.hashSecret = hashSecret;
    }
    return this;
  }

  static async fromBucketQuery(
    req: any,
    shouldApplyAcl: boolean,
    hashSecret?: string
  ): Promise<RealtimeOptions> {
    const builder = new ExpressionBucketDataOptionsBuilder();
    const normalizedReq = authIdToString(req);

    if (shouldApplyAcl) {
      builder.applyAcl(normalizedReq.user);
    }
    builder.withHashSecret(hashSecret);

    if (normalizedReq.query.has("filter")) {
      builder.applyExpression(normalizedReq.query.get("filter"));
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
