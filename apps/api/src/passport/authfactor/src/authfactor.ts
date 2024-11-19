import {Factor, FactorMeta, AuthFactorSchemaProvider} from "./interface";
import {Inject, Injectable, Optional} from "@nestjs/common";
import {ClassCommander, CommandType} from "@spica/api/src/replication";

@Injectable()
export class AuthFactor {
  private userFactor = new Map<string, {hasStarted: boolean; factor: Factor}>();

  constructor(
    @Inject("FACTORS_MAP")
    private factorsMap: Map<
      string,
      {instanceFactory: (meta) => Factor; schemaProvider: () => AuthFactorSchemaProvider}
    >,
    @Optional() private commander: ClassCommander
  ) {
    if (this.commander) {
      this.commander.register(this, [this.register, this.unregister, this.start], CommandType.SYNC);
    }
  }

  getSchemas() {
    return Promise.all(Array.from(this.factorsMap.values()).map(v => v.schemaProvider()));
  }

  // we may want to get these fields from each factor.
  getSecretPaths() {
    return ["secret"];
  }

  register(identity: string, meta: FactorMeta) {
    const factor = this.getFactor(meta);

    this.userFactor.set(identity, {hasStarted: false, factor});
  }

  unregister(identity: string) {
    return this.userFactor.delete(identity);
  }

  getFactor(meta: FactorMeta): Factor {
    const factor = this.factorsMap.get(meta.type);

    if (!factor) {
      throw Error(`Unknown factor named '${meta.type}'.`);
    }

    return factor.instanceFactory(meta);
  }

  start(identity: string) {
    const {factor} = this.userFactor.get(identity);

    this.userFactor.set(identity, {hasStarted: true, factor});

    return factor.start();
  }

  authenticate(identity: string, payload: any) {
    const {hasStarted, factor} = this.userFactor.get(identity);

    if (!hasStarted) {
      return Promise.reject("Factor should has been started before completed.");
    }

    return factor.authenticate(payload);
  }

  hasFactor(identity: string) {
    return this.userFactor.has(identity);
  }
}
