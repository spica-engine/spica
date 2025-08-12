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
        return {
          $or: [
            {name: {$not: {$regex: "/"}}}, // Files without any slashes
            {name: {$regex: "^[^/]+/$"}} // Folders (something ending with / but no slashes before)
          ]
        };
      case "all_files":
        // "**" should match all files (including nested)
        return {}; // Match everything
      case "single_level": {
        const singleLevelBasePath = pattern.slice(0, -2); // Remove "/*"
        // Single level should match both files and folders in the specified path
        return {
          name: {$regex: `^${StoragePipelineBuilder.escapeRegex(singleLevelBasePath)}/[^/]+/?$`}
        };
      }
      case "all_levels": {
        const allLevelsBasePath = pattern.slice(0, -3); // Remove "/**"
        // Match files/folders starting with basePath/ OR the folder itself (basePath/)
        return {
          $or: [
            {name: {$regex: `^${StoragePipelineBuilder.escapeRegex(allLevelsBasePath)}/`}},
            {name: {$eq: `${allLevelsBasePath}/`}}
          ]
        };
      }
      case "exact":
        // For exact patterns, also include parent folders if they exist
        const pathParts = pattern.split("/");
        if (pathParts.length > 1) {
          // If it's a nested path, also match parent folders
          const parentFolders = [];
          for (let i = 1; i < pathParts.length; i++) {
            const parentPath = pathParts.slice(0, i).join("/") + "/";
            parentFolders.push({name: {$eq: parentPath}});
          }
          return {
            $or: [{name: pattern}, ...parentFolders]
          };
        }
        return {name: pattern};
      default:
        return null;
    }
  }

  private static negateCondition(condition: any, patternType: string): object {
    if (patternType === "wildcard") {
      // Negate wildcard: exclude root-level files and folders
      return {
        $and: [
          {name: {$regex: "/"}}, // Must contain slash
          {name: {$not: {$regex: "^[^/]+/$"}}} // But not root-level folders
        ]
      };
    }
    if (patternType === "all_files") {
      return {name: {$exists: false}};
    }
    if (condition.name) {
      if (condition.name.$regex) {
        return {name: {$not: {$regex: condition.name.$regex}}};
      } else if (condition.name.$not) {
        return {name: {$regex: "/"}};
      } else if (condition.$or) {
        // For complex $or conditions, negate the entire thing
        return {$nor: [condition]};
      } else {
        return {name: {$ne: condition.name}};
      }
    }
    if (condition.$or) {
      // For $or conditions (like all_levels pattern), use $nor to negate
      return {$nor: [condition]};
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

  static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  static sortCombinedResults(combined: any[], sort?: any): any[] {
    if (sort && sort.name) {
      combined.sort((a, b) => {
        const direction = sort.name === 1 ? 1 : -1;
        return a.name.localeCompare(b.name) * direction;
      });
    }
    return combined;
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
