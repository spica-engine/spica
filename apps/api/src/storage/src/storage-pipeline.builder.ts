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
    const baseCondition = StoragePipelineBuilder.buildBaseCondition(pattern, patternType);
    if (!baseCondition) {
      return null;
    }
    return isExclude
      ? StoragePipelineBuilder.negateCondition(baseCondition, patternType)
      : baseCondition;
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

  private static buildBaseCondition(pattern: string, patternType: string): object | null {
    switch (patternType) {
      case "wildcard":
        // "*" should match only root-level files (no "/" in name)
        return {name: {$not: {$regex: "/"}}};
      case "all_files":
        // "**" should match all files (including nested)
        return {}; // Match everything
      case "single_level": {
        const singleLevelBasePath = pattern.slice(0, -2); // Remove "/*"
        return {
          name: {$regex: `^${StoragePipelineBuilder.escapeRegex(singleLevelBasePath)}/[^/]+$`}
        };
      }
      case "all_levels": {
        const allLevelsBasePath = pattern.slice(0, -3); // Remove "/**"
        return {name: {$regex: `^${StoragePipelineBuilder.escapeRegex(allLevelsBasePath)}/`}};
      }
      case "exact":
        return {name: pattern};
      default:
        return null;
    }
  }

  private static negateCondition(condition: any, patternType: string): object {
    if (patternType === "wildcard") {
      return {name: {$exists: false}};
    }
    if (patternType === "all_files") {
      return {name: {$exists: false}};
    }
    if (condition.name) {
      if (condition.name.$regex) {
        return {name: {$not: {$regex: condition.name.$regex}}};
      } else if (condition.name.$not) {
        return {name: {$regex: "/"}};
      } else {
        return {name: {$ne: condition.name}};
      }
    }
    return condition;
  }

  private static buildFinalQuery(conditions: any[]): object {
    if (conditions.length === 0) {
      return {$match: {}};
    } else if (conditions.length === 1) {
      return {$match: conditions[0]};
    } else {
      return {$match: {$and: conditions}};
    }
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static createPathFilter(path: string): any {
    if (!path) {
      path = "";
    }

    path = path.startsWith("/") ? path.slice(1) : path;

    if (!path) {
      return {
        name: {
          $not: {
            $regex: "/"
          }
        }
      };
    }

    const escapedPath = StoragePipelineBuilder.escapeRegex(path);
    return {
      name: {
        $regex: `^${escapedPath}/[^/]+$`
      }
    };
  }
}
