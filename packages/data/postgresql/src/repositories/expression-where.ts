import {BadRequestException} from "@nestjs/common";
import {and, Condition, Entity, Where} from "@spica-server/data-postgresql-orm";
import {compileFilterIn, RuleCompileError} from "../access/index.js";
import {EntityFieldResolver} from "../query/collection/resolver.js";

// The ORM only accepts a Condition under a property; the id is a placeholder and is never read.
export function expressionWhere(entity: Entity, filter: string | undefined): Where {
  if (!filter?.trim()) {
    return and();
  }
  return {
    [entity.idProperty]: new Condition((_column, _spec, values) => {
      try {
        const resolver = new EntityFieldResolver(entity, entity.table);
        const compiled = compileFilterIn(filter, resolver, values);
        return compiled.constant === undefined
          ? `(${compiled.sql})`
          : compiled.constant
            ? "TRUE"
            : "FALSE";
      } catch (error) {
        throw error instanceof RuleCompileError ? new BadRequestException(error.message) : error;
      }
    })
  };
}
