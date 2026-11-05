import {BadRequestException} from "@nestjs/common";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketReadContext} from "@spica-server/interface-bucket-common";
import {
  BucketMetadata,
  describeBucket,
  resolveRelationTargets,
  SYSTEM_COLUMNS
} from "../../schema/index.js";
import {fieldKey, Row, RowSet} from "../../shape/index.js";
import {loadRowSets} from "./children.js";
import {BucketReads} from "./reads.js";

const MAX_RELATION_DEPTH = 5;

type Property = {type?: string; bucketId?: string; relationType?: string; properties?: object};

interface Described {
  bucket: Bucket;
  metadata: BucketMetadata;
}

export interface RelationNode extends Described {
  edges: Map<string, RelationEdge>;
}

interface RelationEdge {
  path: string[];
  many: boolean;
  target: RelationNode;
}

type Describe = (bucketId: string) => Promise<Described | undefined>;

export function describer(context: BucketReadContext): Describe {
  const described = new Map<string, Promise<Described | undefined>>();
  const find = async (id: string) => {
    try {
      return await context.resolveSchema(id);
    } catch {
      return undefined;
    }
  };
  return id => {
    if (!described.has(id)) {
      described.set(
        id,
        (async () => {
          const bucket = await find(id);
          return bucket
            ? {
                bucket,
                metadata: describeBucket(id, bucket, await resolveRelationTargets(bucket, find))
              }
            : undefined;
        })()
      );
    }
    return described.get(id);
  };
}

function propertyAt(bucket: Bucket, path: string[]): Property | undefined {
  let properties = bucket.properties as Record<string, Property> | undefined;
  let property: Property | undefined;
  for (const segment of path) {
    property = properties?.[segment];
    if (!property) {
      return undefined;
    }
    properties = property.type == "object" ? (property.properties as typeof properties) : undefined;
  }
  return property;
}

async function addPath(node: RelationNode, segments: string[], describe: Describe, depth: number) {
  let local: string[] = [];
  for (const [index, segment] of segments.entries()) {
    local = [...local, segment];
    const property = propertyAt(node.bucket, local);
    if (property?.type == "object") {
      continue;
    }
    if (property?.type != "relation") {
      return;
    }

    if (depth >= MAX_RELATION_DEPTH) {
      throw new BadRequestException(`Relations can be resolved ${MAX_RELATION_DEPTH} levels deep.`);
    }
    const key = fieldKey(local);
    let edge = node.edges.get(key);
    if (!edge) {
      const target = await describe(property.bucketId);
      if (!target) {
        return;
      }
      edge = {
        path: local,
        many: property.relationType == "onetomany",
        target: {...target, edges: new Map()}
      };
      node.edges.set(key, edge);
    }
    if (index < segments.length - 1) {
      await addPath(edge.target, segments.slice(index + 1), describe, depth + 1);
    }
    return;
  }
}

export async function buildRelationTree(
  bucket: Bucket,
  metadata: BucketMetadata,
  relationPaths: string[][],
  describe: Describe
): Promise<RelationNode> {
  const root: RelationNode = {bucket, metadata, edges: new Map()};
  for (const path of relationPaths) {
    await addPath(root, path, describe, 0);
  }
  return root;
}

function keysOf(rowSet: RowSet, node: RelationNode, edge: RelationEdge): unknown[] {
  if (edge.many) {
    return (rowSet.children?.[fieldKey(edge.path)] ?? [])
      .slice()
      .sort((a, b) => Number(a[SYSTEM_COLUMNS.position]) - Number(b[SYSTEM_COLUMNS.position]))
      .map(row => row[SYSTEM_COLUMNS.target]);
  }
  const column = node.metadata.columnOf(edge.path);
  const key = column && rowSet.main[column.name];
  return key === null || key === undefined ? [] : [key];
}

export async function resolveRelations(
  reads: Pick<BucketReads, "childRows" | "rowsWithKeys">,
  node: RelationNode,
  rowSets: RowSet[],
  skip: (rootProperty: string) => boolean
): Promise<void> {
  for (const edge of node.edges.values()) {
    if (skip(edge.path[0])) {
      continue;
    }
    const {metadata: target} = edge.target;
    const wanted = rowSets.map(rowSet => keysOf(rowSet, node, edge));
    const distinct = [...new Set(wanted.flat().map(String))];

    let found: RowSet[] = [];
    if (distinct.length) {
      const rows = await reads.rowsWithKeys(
        target.main.name,
        target.primaryKey.column,
        target.primaryKey.type,
        distinct
      );
      found = await loadRowSets(reads, target, rows, () => false);
      await resolveRelations(reads, edge.target, found, () => false);
    }

    const byKey = new Map(found.map(set => [String(set.main[target.primaryKey.column]), set]));
    rowSets.forEach((rowSet, index) => {
      const resolved = wanted[index].map(key => byKey.get(String(key))).filter(set => set);
      rowSet.joined = {
        ...rowSet.joined,
        [fieldKey(edge.path)]: edge.many ? resolved : (resolved[0] ?? null)
      };
    });
  }
}
