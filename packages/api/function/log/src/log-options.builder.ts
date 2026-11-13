import {FilterLanguage} from "@spica-server/interface-realtime";
import {RealtimeOptionsBuilder} from "@spica-server/realtime";

const FOREVER = new Date(8.64e15);

export class LogOptionsBuilder extends RealtimeOptionsBuilder {
  filterFunctions(functions: string[]): this {
    if (this.language == "expression") {
      this.where("function", {in: functions});
      return this;
    }
    this.ensureFilter();
    this.options.filter.function = {$in: functions};
    return this;
  }

  filterBeginDate(req: any): this {
    const begin = req.query.has("begin") ? new Date(req.query.get("begin")) : new Date();
    // 'new Date' adds current miliseconds if the given parameter missing miliseconds
    begin.setMilliseconds(0);
    // Apply this manipulation to the request object too for change stream matching on disconnect
    req.query.set("begin", begin);

    if (this.language == "expression") {
      this.options.createdBetween = {from: begin, to: FOREVER};
      return this;
    }
    this.ensureFilter();
    this.options.filter.created_at = {$gte: begin};
    return this;
  }

  filterContent(content: string): this {
    if (this.language == "expression") {
      this.where("content", {matches: content, caseInsensitive: true});
      return this;
    }
    this.ensureFilter();
    this.options.filter.content = {$regex: content, $options: "i"};
    return this;
  }

  private where(field: string, condition: object): void {
    this.options.where = {...this.options.where, [field]: condition};
  }

  private ensureFilter(): void {
    if (!this.options.filter) {
      this.options.filter = {};
    }
  }

  static fromLogQuery(req: any, language: FilterLanguage = "json"): any {
    const builder = new LogOptionsBuilder(language);

    if (req.query.has("functions")) {
      builder.filterFunctions(req.query.getAll("functions"));
    }

    builder.filterBeginDate(req);

    if (req.query.has("content")) {
      builder.filterContent(req.query.get("content"));
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
