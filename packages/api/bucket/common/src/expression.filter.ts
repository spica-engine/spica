import {getSelectPath, getFieldSideAndValueSide} from "@spica-server/bucket/expression";
import {getPropertyByPath} from "./schema.js";
import {Replacer} from "@spica-server/interface/bucket/expression";
import {hash} from "@spica-server/core/encryption";
import {Bucket} from "@spica-server/interface/bucket";
import {RelationResolver} from "@spica-server/interface/bucket/common";
import * as Relation from "./relation.js";

function getPropertyType(properties: object, path: string): string | undefined {
  const property = getPropertyByPath(properties, path);
  if (!property) {
    return undefined;
  }
  if (property.type == "array" && property.items) {
    return property.items.type;
  }
  return property.type;
}

export function createDateReplacer(properties: object): Replacer {
  return {
    condition: node => {
      const sides = getFieldSideAndValueSide(node);
      if (!sides) {
        return false;
      }
      const type = getPropertyType(properties, sides.fieldPath);
      return type == "date" && !isNaN(Date.parse(sides.valueSide.value));
    },
    replace: node => {
      const sides = getFieldSideAndValueSide(node);
      sides.valueSide.value = new Date(sides.valueSide.value);
    }
  };
}

export function createHashReplacer(properties: object, hashSecret: string): Replacer {
  return {
    condition: node => {
      const sides = getFieldSideAndValueSide(node);
      if (!sides) {
        return false;
      }
      const type = getPropertyType(properties, sides.fieldPath);
      return type == "hash";
    },
    replace: node => {
      const sides = getFieldSideAndValueSide(node);
      sides.valueSide.value = hash(sides.valueSide.value, hashSecret);
    }
  };
}

export function createEncryptedReplacer(properties: object, hashSecret: string): Replacer {
  return {
    condition: node => {
      const sides = getFieldSideAndValueSide(node);
      if (!sides) {
        return false;
      }
      const type = getPropertyType(properties, sides.fieldPath);
      return type == "encrypted";
    },
    replace: node => {
      const sides = getFieldSideAndValueSide(node);
      sides.valueSide.value = hash(sides.valueSide.value, hashSecret);

      // Wrap the field node in a new select to append ".hash"
      const fieldSide = getSelectPath(node.left) ? "left" : "right";
      const fieldNode = node[fieldSide];
      const newSelect = {
        kind: "operator",
        type: "select",
        category: "binary",
        left: fieldNode,
        right: {kind: "identifier", name: "hash", parent: undefined as any},
        parent: node
      };
      newSelect.right.parent = newSelect;
      fieldNode.parent = newSelect;
      node[fieldSide] = newSelect;
    }
  };
}

export async function buildExpressionReplacers(
  bucket: Bucket,
  propertyMap: string[][],
  relationResolver: RelationResolver,
  hashSecret?: string
): Promise<Replacer[]> {
  const resolvedSchema = await Relation.getRelationResolvedBucketSchema(
    bucket,
    propertyMap,
    relationResolver
  );

  const replacers: Replacer[] = [createDateReplacer(resolvedSchema.properties)];

  if (hashSecret) {
    replacers.push(
      createHashReplacer(resolvedSchema.properties, hashSecret),
      createEncryptedReplacer(resolvedSchema.properties, hashSecret)
    );
  }

  return replacers;
}
