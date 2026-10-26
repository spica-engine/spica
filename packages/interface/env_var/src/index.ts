import {Id} from "@spica-server/interface-data";
export interface EnvVar {
  _id?: Id;
  key: string;
  value: string;
  updated_at?: Date;
}

export interface EnvVarRepository {
  findById(id: Id): Promise<EnvVar | null>;
  insert(envVar: EnvVar): Promise<EnvVar>;
  /**
   * Resolves to the replaced environment variable, or null when there is none with the id.
   */
  replaceById(id: Id, envVar: EnvVar): Promise<EnvVar | null>;
  /**
   * Resolves to the updated environment variable, or null when there is none with the id.
   */
  updateById(id: Id, fields: Partial<EnvVar>): Promise<EnvVar | null>;
  deleteById(id: Id): Promise<EnvVar | null>;
}

export const ENV_VAR_REPOSITORY = Symbol.for("ENV_VAR_REPOSITORY");
