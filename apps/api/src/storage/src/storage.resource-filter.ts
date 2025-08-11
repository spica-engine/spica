type PatternType = "wildcard" | "single_level" | "all_levels" | "exact";

export function createStorageResourceFilter(resourceFilter: {
  include?: string[];
  exclude?: string[];
}): object {
  if (!resourceFilter || (!resourceFilter.include?.length && !resourceFilter.exclude?.length)) {
    return {$match: {}};
  }

  const conditions: any[] = [];

  if (resourceFilter.include?.length) {
    const includeConditions = resourceFilter.include.map(pattern =>
      createPatternCondition(pattern, false)
    );

    const validConditions = includeConditions.filter(condition => condition !== null);
    if (validConditions.length > 0) {
      conditions.push(validConditions.length === 1 ? validConditions[0] : {$or: validConditions});
    }
  }

  if (resourceFilter.exclude?.length) {
    const excludeConditions = resourceFilter.exclude
      .map(pattern => createPatternCondition(pattern, true))
      .filter(condition => condition !== null);

    conditions.push(...excludeConditions);
  }

  return buildFinalQuery(conditions);
}

function createPatternCondition(pattern: string, isExclude: boolean): object | null {
  const patternType = getPatternType(pattern);
  const baseCondition = buildBaseCondition(pattern, patternType);

  if (!baseCondition) {
    return null;
  }

  return isExclude ? negateCondition(baseCondition, patternType) : baseCondition;
}

function getPatternType(pattern: string): PatternType {
  if (pattern === "*") return "wildcard";
  if (pattern.endsWith("/**")) return "all_levels";
  if (pattern.endsWith("/*")) return "single_level";
  return "exact";
}

function buildBaseCondition(pattern: string, patternType: PatternType): object | null {
  switch (patternType) {
    case "wildcard":
      return {}; // Match everything

    case "single_level":
      const singleLevelBasePath = pattern.slice(0, -2); // Remove "/*"
      // /* means files and folders only at first depth
      return {name: {$regex: `^${escapeRegex(singleLevelBasePath)}/[^/]+$`}};

    case "all_levels":
      const allLevelsBasePath = pattern.slice(0, -3); // Remove "/**"
      // /** means files and folders at any depth
      return {name: {$regex: `^${escapeRegex(allLevelsBasePath)}/`}};

    case "exact":
      return {name: pattern};

    default:
      return null;
  }
}

function negateCondition(condition: any, patternType: PatternType): object {
  if (patternType === "wildcard") {
    // Exclude everything - no matches possible
    return {name: {$exists: false}};
  }

  if (condition.name) {
    if (condition.name.$regex) {
      return {name: {$not: {$regex: condition.name.$regex}}};
    } else {
      return {name: {$ne: condition.name}};
    }
  }

  return condition;
}

function buildFinalQuery(conditions: any[]): object {
  if (conditions.length === 0) {
    return {$match: {}};
  } else if (conditions.length === 1) {
    return {$match: conditions[0]};
  } else {
    return {$match: {$and: conditions}};
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
