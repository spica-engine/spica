import {DeletableById, Id, Repository} from "@spica-server/interface-data";
export interface EnvVar {
  key: string;
  value: string;
  updated_at?: Date;
}

export interface EnvVarRepository extends Repository<EnvVar>, DeletableById<EnvVar | null> {
  /**
   * Resolves to the env var as it was before the replacement, or null when there is none with the id.
   */
  replaceById(id: Id, envVar: EnvVar): Promise<EnvVar | null>;
  /**
   * Resolves to the env var as it was before the update, or null when there is none with the id.
   */
  updateById(id: Id, fields: Partial<EnvVar>): Promise<EnvVar | null>;
}

export const ENV_VAR_REPOSITORY = Symbol.for("ENV_VAR_REPOSITORY");
