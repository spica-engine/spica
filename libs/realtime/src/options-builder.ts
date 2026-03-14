export class RealtimeOptionsError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "RealtimeOptionsError";
  }
}

export class RealtimeOptionsBuilder {
  protected options: any = {};

  applyResourceFilter(resourceFilter: any): this {
    if (!this.options.filter) {
      this.options.filter = {$and: []};
    }

    const policyMatch = resourceFilter || {$match: {}};
    this.options.filter.$and.push(policyMatch.$match);

    return this;
  }

  filter(rawFilter: string): this {
    if (!this.options.filter) {
      this.options.filter = {$and: []};
    }

    try {
      const parsed = JSON.parse(rawFilter);
      if (this.options.filter.$and) {
        this.options.filter.$and.push(parsed);
      } else {
        this.options.filter = parsed;
      }
    } catch (e) {
      throw new RealtimeOptionsError(400, `Invalid filter: ${e.message}`);
    }

    return this;
  }

  sort(rawSort: string): this {
    try {
      this.options.sort = JSON.parse(rawSort);
    } catch (e) {
      throw new RealtimeOptionsError(400, `Invalid sort: ${e.message}`);
    }

    return this;
  }

  limit(rawLimit: string): this {
    const limit = Number(rawLimit);
    if (isNaN(limit) || limit < 0) {
      throw new RealtimeOptionsError(400, "Invalid limit parameter");
    }
    this.options.limit = limit;

    return this;
  }

  skip(rawSkip: string): this {
    const skip = Number(rawSkip);
    if (isNaN(skip) || skip < 0) {
      throw new RealtimeOptionsError(400, "Invalid skip parameter");
    }
    this.options.skip = skip;

    return this;
  }

  setFilter(filter: any): this {
    this.options.filter = filter;
    return this;
  }

  result(): any {
    return this.options;
  }

  static fromQuery(req: any, opts: {useResourceFilter?: boolean; useFilter?: boolean} = {}): any {
    const builder = new RealtimeOptionsBuilder();

    if (opts.useResourceFilter) {
      builder.applyResourceFilter(req.resourceFilter);
    }

    if (opts.useFilter && req.query.has("filter")) {
      builder.filter(req.query.get("filter"));
    }

    if (req.query.has("sort")) {
      builder.sort(req.query.get("sort"));
    }

    if (req.query.has("limit")) {
      builder.limit(req.query.get("limit"));
    }

    if (req.query.has("skip")) {
      builder.skip(req.query.get("skip"));
    }

    return builder.result();
  }
}
