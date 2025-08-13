import {PipelineBuilder} from "@spica-server/database/pipeline";

export class StoragePipelineBuilder extends PipelineBuilder {
  static createResourceFilter(resourceFilter: {include?: string[]; exclude?: string[]}): object {
    if (!resourceFilter || (!resourceFilter.include?.length && !resourceFilter.exclude?.length)) {
      return {$match: {}};
    }

    const conditions: any[] = [];

    if (resourceFilter.include?.length) {
      const includeConditions = resourceFilter.include.map(pattern =>
        StoragePipelineBuilder.createPatternCondition(pattern, false)
      );
      const validConditions = includeConditions.filter(condition => condition !== null);
      if (validConditions.length > 0) {
        conditions.push(validConditions.length === 1 ? validConditions[0] : {$or: validConditions});
      }
    }

    if (resourceFilter.exclude?.length) {
      const excludeConditions = resourceFilter.exclude
        .map(pattern => StoragePipelineBuilder.createPatternCondition(pattern, true))
        .filter(condition => condition !== null);
      conditions.push(...excludeConditions);
    }

    return StoragePipelineBuilder.buildFinalQuery(conditions);
  }

  private static createPatternCondition(pattern: string, isExclude: boolean): object | null {
    const patternType = StoragePipelineBuilder.getPatternType(pattern);

    if (isExclude) {
      return this.buildPatternCondition(pattern, patternType, true);
    }
    return this.buildPatternCondition(pattern, patternType, false);
  }

  private static getPatternType(
    pattern: string
  ): "wildcard" | "all_files" | "single_level" | "all_levels" | "exact" {
    if (pattern === "*") return "wildcard";
    if (pattern === "**") return "all_files";
    if (pattern.endsWith("/**")) return "all_levels";
    if (pattern.endsWith("/*")) return "single_level";
    return "exact";
  }

  private static buildPatternCondition(
    pattern: string,
    patternType: string,
    isExclude: boolean
  ): object | null {
    const escape = StoragePipelineBuilder.escapeRegex;

    switch (patternType) {
      case "wildcard":
        return isExclude
          ? {
              $and: [{name: {$regex: "/"}}, {name: {$not: {$regex: "^[^/]+/$"}}}]
            }
          : {
              $or: [{name: {$not: {$regex: "/"}}}, {name: {$regex: "^[^/]+/$"}}]
            };

      case "all_files":
        return isExclude ? {name: {$exists: false}} : {};

      case "single_level": {
        const basePath = pattern.slice(0, -2);
        const regex = `^${escape(basePath)}/[^/]+/?$`;
        return isExclude ? {name: {$not: {$regex: regex}}} : {name: {$regex: regex}};
      }

      case "all_levels": {
        const basePath = pattern.slice(0, -3);
        return isExclude
          ? {
              $and: [
                {name: {$not: {$regex: `^${escape(basePath)}/`}}},
                {name: {$ne: `${basePath}/`}}
              ]
            }
          : {
              $or: [{name: {$regex: `^${escape(basePath)}/`}}, {name: {$eq: `${basePath}/`}}]
            };
      }

      case "exact": {
        const pathParts = pattern.split("/");
        const folderConds = [];

        for (let i = 1; i < pathParts.length; i++) {
          const folderPath = pathParts.slice(0, i).join("/") + "/";
          folderConds.push(isExclude ? {name: {$ne: folderPath}} : {name: {$eq: folderPath}});
        }

        return isExclude
          ? {$and: [{name: {$ne: pattern}}, ...folderConds]}
          : pathParts.length > 1
            ? {$or: [{name: pattern}, ...folderConds]}
            : {name: pattern};
      }

      default:
        return null;
    }
  }

  private static buildFinalQuery(conditions: any[]): object {
    if (!conditions || conditions.length === 0) {
      return {$match: {}};
    }
    if (conditions.length === 1) {
      return {$match: conditions[0]};
    }
    return {$match: {$and: conditions}};
  }

  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static createPathFilter(path: string): any {
    if (!path) {
      path = "";
    }

    path = path.startsWith("/") ? path.slice(1) : path;

    if (!path) {
      return {
        $or: [{name: {$not: {$regex: "/"}}}, {name: {$regex: "^[^/]+/$"}}]
      };
    }

    const escapedPath = StoragePipelineBuilder.escapeRegex(path);
    return {
      name: {
        $regex: `^${escapedPath}/[^/]+/?$`
      }
    };
  }
}
