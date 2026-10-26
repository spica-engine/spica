import {
  Locale,
  RelationMap,
  RelationType,
  ResetNonOverlappingPathsOptions
} from "@spica-server/interface-bucket-common";

function assertRelationType(type: RelationType) {
  if (type != RelationType.One && type != RelationType.Many) {
    throw new Error(`unknown relation type ${type}`);
  }
}

export function getRelationPipeline(map: RelationMap[], locale: Locale): object[] {
  const pipeline = [];

  for (const relation of map) {
    let subPipeline;

    if (relation.children) {
      subPipeline = getRelationPipeline(relation.children, locale);
    }

    const stage = buildRelationAggregation(
      relation.path,
      relation.target,
      relation.type,
      locale,
      subPipeline
    );

    pipeline.push(...stage);
  }

  return pipeline;
}

export function resetNonOverlappingPathsInRelationMap(
  options: ResetNonOverlappingPathsOptions
): object {
  const visit = ({
    left,
    right,
    map,
    depth
  }: ResetNonOverlappingPathsOptions & {
    depth: number;
  }): {[path: string]: object | string} => {
    let paths: {[path: string]: object | string} = {};
    let hasKeys = false;
    for (const relation of map) {
      const leftMatch = left.filter(segments => segments[depth] == relation.path);
      const rightMatch = right.filter(segments => segments[depth] == relation.path);

      if (!leftMatch.length && rightMatch.length) {
        hasKeys = true;

        const path = rightMatch[0].slice(0, depth + 1).join(".");

        if (relation.type == "onetoone") {
          paths[path] = {$toString: `$${path}._id`};
        } else {
          paths[path] = {
            $map: {
              input: `$${path}`,
              as: "doc",
              in: `$$doc._id`
            }
          };
        }
      } else if (relation.children) {
        const subPaths = visit({
          left: leftMatch,
          right: rightMatch,
          depth: depth + 1,
          map: relation.children
        });
        if (subPaths) {
          hasKeys = true;
          paths = {...paths, ...subPaths};
        }
      }
    }

    return hasKeys ? paths : undefined;
  };

  const expressions = visit({left: options.left, right: options.right, map: options.map, depth: 0});
  return expressions ? {$set: expressions} : undefined;
}

export function buildRelationAggregation(
  property: string,
  bucketId: string,
  type: RelationType,
  locale: Locale,
  additionalPipeline?: object[]
): object[] {
  assertRelationType(type);
  const aggregations = [];
  const beforeLookup = [];
  const afterLookup = [];

  if (type == RelationType.One) {
    beforeLookup.push({
      $addFields: {
        [`${property}`]: {
          $toObjectId: `$${property}`
        }
      }
    });
    afterLookup.push({$unwind: {path: `$${property}`, preserveNullAndEmptyArrays: true}});
  } else if (type == RelationType.Many) {
    beforeLookup.push({
      $addFields: {
        [`${property}`]: {
          $ifNull: [
            {
              $map: {
                input: `$${property}`,
                in: {$toObjectId: "$$this"}
              }
            },
            []
          ]
        }
      }
    });
  }

  const lookup: any = {
    $lookup: {
      from: `bucket_${bucketId}`,
      localField: property,
      foreignField: "_id",
      as: property
    }
  };

  const lookupPipeline = [];

  if (additionalPipeline) {
    lookupPipeline.push(...additionalPipeline);
  }

  if (locale) {
    lookupPipeline.push({
      $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
    });
  }

  if (lookupPipeline.length) {
    lookup.$lookup.pipeline = lookupPipeline;
  }

  aggregations.push(...beforeLookup);
  aggregations.push(lookup);
  aggregations.push(...afterLookup);

  return aggregations;
}

export function buildI18nAggregation(property: any, locale: string, fallback: string) {
  return {
    $mergeObjects: [
      property,
      {
        $arrayToObject: {
          $map: {
            input: {
              $filter: {
                input: {
                  $objectToArray: property
                },
                as: "item",
                cond: {
                  $eq: [
                    {
                      $type: "$$item.v"
                    },
                    "object"
                  ]
                }
              }
            },
            as: "prop",
            in: {
              k: "$$prop.k",
              v: {
                $ifNull: [
                  `$$prop.v.${locale}`,
                  {
                    $ifNull: [`$$prop.v.${fallback}`, `$$prop.v`]
                  }
                ]
              }
            }
          }
        }
      }
    ]
  };
}
