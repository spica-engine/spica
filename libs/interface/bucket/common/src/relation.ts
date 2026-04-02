import {Bucket} from "@spica-server/interface/bucket";

export type FilterReplacer = (
  filter: object,
  bucket: Bucket,
  relationResolver: RelationResolver
) => Promise<object>;

export const enum RelationType {
  One = "onetoone",
  Many = "onetomany"
}

export interface RelationMap {
  type: RelationType;
  target: string;
  path: string;
  children?: RelationMap[];
  schema: Bucket;
}

export interface RelationMapOptions {
  resolve: RelationResolver;
  paths: string[][];
  properties: object;
}

export interface ResetNonOverlappingPathsOptions {
  left: string[][];
  right: string[][];
  map: RelationMap[];
}

export type RelationDefinition = {
  type: "relation";
  bucketId: string;
  relationType: RelationType;
  dependent: boolean;
};

export type RelationResolver = (id: string) => Promise<Bucket>;
