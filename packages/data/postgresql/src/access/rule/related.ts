import {parser} from "@spica-server/bucket-expression/src/parser";
import {Bucket} from "@spica-server/interface-bucket";
import {describeBucket} from "../../schema/metadata/describe-bucket.js";
import {BucketSchemaError} from "../../schema/naming.js";
import {resolveRelationTargets} from "../../schema/relation-targets.js";
import {Related, RelatedBuckets} from "./fields.js";

type Node = any;

const CHILDREN = ["left", "right", "member", "test", "consequent", "alternative", "arguments"];

function collectPaths(node: Node, paths: string[][]) {
  if (Array.isArray(node)) {
    node.forEach(child => collectPaths(child, paths));
    return;
  }
  if (!node || typeof node != "object") {
    return;
  }
  if (node.kind == "operator" && node.type == "select") {
    const path: string[] = [];
    let current = node;
    while (current.kind == "operator" && current.type == "select") {
      if (current.right.kind == "identifier") {
        path.unshift(current.right.name);
      }
      current = current.left;
    }
    if (current.kind == "identifier" && current.name != "auth") {
      paths.push(current.name == "document" ? path : [current.name, ...path]);
    }
    return;
  }
  CHILDREN.forEach(key => collectPaths(node[key], paths));
}

function documentPaths(rule: string): string[][] {
  const paths: string[][] = [];
  try {
    collectPaths(parser.parse(rule), paths);
  } catch {
    // Compiling the rule reports the syntax error.
  }
  return paths;
}

/**
 * Loads the buckets a rule reaches through relations, so compiling it needs no database access.
 */
export async function loadRelatedBuckets(
  own: Related & {bucketId: string},
  rules: string | string[],
  find: (bucketId: string) => Promise<Bucket | null | undefined>,
  extraPaths: string[][] = []
): Promise<RelatedBuckets> {
  const loaded = new Map<string, Related | null>([[own.bucketId, own]]);

  const load = async (id: string) => {
    if (!loaded.has(id)) {
      loaded.set(id, null);
      const definition = await find(id);
      if (definition) {
        try {
          const targets = await resolveRelationTargets(definition, find);
          loaded.set(id, {bucket: definition, metadata: describeBucket(id, definition, targets)});
        } catch (error) {
          if (!(error instanceof BucketSchemaError)) {
            throw error;
          }
        }
      }
    }
    return loaded.get(id) ?? undefined;
  };

  const walk = async (bucket: Bucket, path: string[]) => {
    let properties = bucket.properties as Record<string, any> | undefined;
    for (const [index, segment] of path.entries()) {
      const property = properties?.[segment];
      if (!property) {
        return;
      }
      if (property.type == "relation" && index < path.length - 1) {
        const related = await load(property.bucketId);
        if (related) {
          await walk(related.bucket, path.slice(index + 1));
        }
        return;
      }
      properties = property.type == "object" ? property.properties : undefined;
    }
  };

  for (const path of [...[rules].flat().flatMap(documentPaths), ...extraPaths]) {
    await walk(own.bucket, path);
  }
  return id => loaded.get(id) ?? undefined;
}
