import {
  DeletableById,
  ReplaceableById,
  Repository,
  UpdatableById
} from "@spica-server/interface-data";
export interface EnvVar {
  key: string;
  value: string;
  updated_at?: Date;
}

export interface EnvVarRepository
  extends
    Repository<EnvVar>,
    ReplaceableById<EnvVar>,
    UpdatableById<EnvVar>,
    DeletableById<EnvVar | null> {}

export const ENV_VAR_REPOSITORY = Symbol.for("ENV_VAR_REPOSITORY");
