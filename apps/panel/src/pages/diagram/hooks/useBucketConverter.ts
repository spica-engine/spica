import { useMemo } from "react";
import type { Property, BucketType } from "../../../store/api/bucketApi";

export interface Field {
  id: string;
  name: string;
  type: string;
  isUnique?: boolean;
  isRelation?: boolean;
  relationTo?: string;
  path?: string;
  relationType?: "onetoone" | "onetomany";
}

export interface Node {
  id: string;
  name: string;
  position: { x: number; y: number };
  fields: Field[];
}

export interface Relation {
  from: string;
  to: string;
  fromField: string;
  toField: string;
  type: "1:1" | "1:*" | "*:*";
  fromPath?: string;
}

export const useBucketConverter = (buckets: BucketType[] | null) => {
  const convertPropertyToField = useMemo(() => {
    return (
      key: string, 
      property: Property, 
      path: string = key
    ): Field[] => {
      const fields: Field[] = [];
      
      const field: Field = {
        id: path,
        name: key,
        type: property.type,
        path: path
      };

      if (property.type === "relation") {
        field.isRelation = true;
        field.relationTo = property.bucketId;
        field.relationType = property.relationType;
      }

      if (key === "_id" || key === "id") {
        field.isUnique = true;
      }
      
      fields.push(field);

      if (property.type === "object" && property.properties) {
        Object.entries(property.properties).forEach(([nestedKey, nestedProperty]) => {
          const nestedPath = `${path}.${nestedKey}`;
          const nestedFields = convertPropertyToField(nestedKey, nestedProperty, nestedPath);
          fields.push(...nestedFields);
        });
      }

      if (property.type === "array" && property.items && typeof property.items === "object" && "properties" in property.items) {
        Object.entries((property.items as any).properties || {}).forEach(([nestedKey, nestedProperty]) => {
          const nestedPath = `${path}.${nestedKey}`;
          const nestedFields = convertPropertyToField(nestedKey, nestedProperty as Property, nestedPath);
          fields.push(...nestedFields);
        });
      }

      return fields;
    };
  }, []);

  const extractRelations = useMemo(() => {
    return (buckets: BucketType[]): Relation[] => {
      const relations: Relation[] = [];

      const processProperty = (
        bucketId: string,
        key: string,
        property: any,
        path: string = key
      ) => {
        if (property.type === "relation") {
          let relationType: "1:1" | "1:*" | "*:*";
          
          switch (property.relationType) {
            case "onetoone":
              relationType = "1:1";
              break;
            case "onetomany":
              relationType = "1:*";
              break;
            case "manytomany":
              relationType = "*:*";
              break;
            default:
              relationType = "1:*";
          }

          relations.push({
            from: bucketId,
            to: property.bucketId,
            fromField: key,
            toField: "_id",
            type: relationType,
            fromPath: path
          });
        } else if (property.type === "object" && property.properties) {
          Object.entries(property.properties).forEach(([nestedKey, nestedProperty]) => {
            const nestedPath = `${path}.${nestedKey}`;
            processProperty(bucketId, nestedKey, nestedProperty, nestedPath);
          });
        }
      };

      buckets.forEach(bucket => {
        Object.entries(bucket.properties || {}).forEach(([key, property]) => {
          processProperty(bucket._id, key, property);
        });
      });

      return relations;
    };
  }, []);

  const convertBucketsToNodes = useMemo(() => {
    return (buckets: BucketType[], extractedRelations: Relation[]): Node[] => {
      const nodeWidth = 350;
      const nodeHeight = 300;

      const bucketRelations = new Map<string, { incoming: Set<string>, outgoing: Set<string> }>();
      
      buckets.forEach(bucket => {
        bucketRelations.set(bucket._id, { incoming: new Set(), outgoing: new Set() });
      });

      extractedRelations.forEach(relation => {
        const fromBucket = bucketRelations.get(relation.from);
        const toBucket = bucketRelations.get(relation.to);
        
        if (fromBucket) {
          fromBucket.outgoing.add(relation.to);
        }
        if (toBucket) {
          toBucket.incoming.add(relation.from);
        }
      });

      const highConnectionBuckets: BucketType[] = [];
      const regularConnectedBuckets: BucketType[] = [];
      const isolatedBuckets: BucketType[] = [];

      buckets.forEach(bucket => {
        const relations = bucketRelations.get(bucket._id);
        if (relations && relations.incoming.size === 0 && relations.outgoing.size === 0) {
          isolatedBuckets.push(bucket);
        } else if (relations && (relations.incoming.size + relations.outgoing.size) > 8) {
          highConnectionBuckets.push(bucket);
        } else {
          regularConnectedBuckets.push(bucket);
        }
      });

      const centerX = 800;
      const centerY = 600;
      const innerRadius = highConnectionBuckets.length > 1 ? 120 : 0;
      const outerRadius = Math.max(400, regularConnectedBuckets.length * 80);
      
      const squareStartX = centerX + outerRadius + 500;
      const squareStartY = centerY - 300;
      const squareSpacing = nodeWidth + 100;
      const squareColumns = Math.ceil(Math.sqrt(isolatedBuckets.length));
      
      return buckets.map((bucket, bucketIndex) => {
        const fields: Field[] = [];

        fields.push({
          id: "_id",
          name: "_id",
          type: "unique",
          isUnique: true,
          path: "_id"
        });

        Object.entries(bucket.properties || {}).forEach(([key, property]) => {
          const propertyFields = convertPropertyToField(key, property);
          fields.push(...propertyFields);
        });

        let x: number, y: number;

        const relations = bucketRelations.get(bucket._id);
        const totalConnections = relations ? relations.incoming.size + relations.outgoing.size : 0;
        const isIsolated = relations && relations.incoming.size === 0 && relations.outgoing.size === 0;
        const isHighConnection = totalConnections > 8;

        if (isIsolated) {
          const isolatedIndex = isolatedBuckets.findIndex((b: BucketType) => b._id === bucket._id);
          const row = Math.floor(isolatedIndex / squareColumns);
          const col = isolatedIndex % squareColumns;
          
          x = squareStartX + col * squareSpacing;
          y = squareStartY + row * squareSpacing;
        } else if (isHighConnection) {
          if (highConnectionBuckets.length === 1) {
            x = centerX;
            y = centerY;
          } else {
            const highConnectionIndex = highConnectionBuckets.findIndex((b: BucketType) => b._id === bucket._id);
            const angle = (highConnectionIndex / highConnectionBuckets.length) * 2 * Math.PI;
            
            x = centerX + innerRadius * Math.cos(angle);
            y = centerY + innerRadius * Math.sin(angle);
          }
        } else {
          const regularIndex = regularConnectedBuckets.findIndex((b: BucketType) => b._id === bucket._id);
          const angle = (regularIndex / regularConnectedBuckets.length) * 2 * Math.PI;
          
          x = centerX + outerRadius * Math.cos(angle);
          y = centerY + outerRadius * Math.sin(angle);
        }

        return {
          id: bucket._id,
          name: bucket.title,
          position: { x, y },
          fields
        };
      });
    };
  }, [convertPropertyToField]);

  const relations = useMemo(() => {
    if (!buckets) return [];
    return extractRelations(buckets);
  }, [buckets, extractRelations]);

  const nodes = useMemo(() => {
    if (!buckets) return [];
    return convertBucketsToNodes(buckets, relations);
  }, [buckets, relations, convertBucketsToNodes]);

  return {
    nodes,
    relations,
    convertPropertyToField,
    extractRelations,
    convertBucketsToNodes
  };
};