import {Injectable} from "@nestjs/common";
import {
  BaseCollection,
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  ReturnDocument,
  UpdateFilter,
  UpdateOptions,
  WithId
} from "@spica-server/database";
import {BaseConfig} from "@spica-server/interface-config";
import {Observable} from "rxjs";
import {ConfigChangeDispatcher} from "./config.change-dispatcher.js";

@Injectable()
export class ConfigService extends BaseCollection<BaseConfig>("config") {
  constructor(
    db: DatabaseService,
    private readonly changeDispatcher: ConfigChangeDispatcher
  ) {
    super(db);
  }

  async updateOne(
    filter: Filter<BaseConfig>,
    update: UpdateFilter<BaseConfig> | BaseConfig,
    options?: UpdateOptions
  ): Promise<number> {
    const result = await super.updateOne(filter, update, options);
    await this.dispatchChange(filter);
    return result;
  }

  async findOneAndReplace(
    filter: Filter<BaseConfig>,
    doc: BaseConfig,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<BaseConfig>> {
    const result = await super.findOneAndReplace(filter, doc, options);
    // When the caller asks for the post-write document (the controller does), dispatch it
    // directly; otherwise re-read. Avoids an extra round-trip on the common update path.
    if (result && options?.returnDocument === ReturnDocument.AFTER) {
      this.changeDispatcher.dispatch({module: result.module, options: result.options});
    } else {
      await this.dispatchChange(filter);
    }
    return result;
  }

  protected watchModule(module: string): Observable<BaseConfig> {
    return this.changeDispatcher.watch(module);
  }

  // Read-after-write so the dispatched snapshot reflects the persisted document. A concurrent
  // write to the same module could be reflected instead, but config writes are rare admin
  // actions where that race is acceptable, and reconstructing the payload from update operators
  // would be far more fragile.
  private async dispatchChange(filter: Filter<BaseConfig>): Promise<void> {
    const config = await this.findOne(filter);
    if (config) {
      this.changeDispatcher.dispatch({module: config.module, options: config.options});
    }
  }
}
