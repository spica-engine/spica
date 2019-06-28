import {InputSchema} from "@spica-client/common/input";

export interface RelationSchema extends InputSchema {
  bucket: string;
  relationType: RelationType;
}

export enum RelationType {
  ManyToMany = "manytomany",
  OneToMany = "onetomany",
  OneToOne = "onetoone"
}
