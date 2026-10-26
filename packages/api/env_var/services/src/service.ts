import {Inject, Injectable} from "@nestjs/common";
import {EnvVar, ENV_VAR_REPOSITORY, EnvVarRepository} from "@spica-server/interface-env_var";
import {Id} from "@spica-server/interface-data";
import {CollectionChangeEvent} from "@spica-server/replication";
import {Observable} from "rxjs";
import {EnvVarChangeDispatcher} from "./change-dispatcher.js";

@Injectable()
export class EnvVarService {
  constructor(
    @Inject(ENV_VAR_REPOSITORY) private readonly envVars: EnvVarRepository,
    private readonly changeDispatcher: EnvVarChangeDispatcher
  ) {}

  findById(id: Id): Promise<EnvVar | null> {
    return this.envVars.findById(id);
  }

  async insert(envVar: EnvVar): Promise<EnvVar> {
    const result = await this.envVars.insert(envVar);
    this.changeDispatcher.dispatch({operationType: "insert", documentKey: {_id: result._id}});
    return result;
  }

  async replaceById(id: Id, envVar: EnvVar): Promise<EnvVar | null> {
    const result = await this.envVars.replaceById(id, envVar);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "replace", documentKey: {_id: result._id}});
    }
    return result;
  }

  async updateById(id: Id, fields: Partial<EnvVar>): Promise<EnvVar | null> {
    const result = await this.envVars.updateById(id, fields);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "update", documentKey: {_id: result._id}});
    }
    return result;
  }

  async deleteById(id: Id): Promise<EnvVar | null> {
    const result = await this.envVars.deleteById(id);
    if (result) {
      this.changeDispatcher.dispatch({operationType: "delete", documentKey: {_id: result._id}});
    }
    return result;
  }

  watchChanges(): Observable<CollectionChangeEvent> {
    return this.changeDispatcher.watch();
  }
}
