import {Factor, FactorMeta, AuthFactorSchemaProvider} from "./interface";
import {Injectable} from "@nestjs/common";
import {ClassCommander} from "@spica-server/replication";

@Injectable()
export class AuthFactor {
  private userFactor = new Map<string, {hasStarted: boolean; factor: Factor}>();

  constructor(
    private factors: Map<string, any>,
    private schemas: AuthFactorSchemaProvider[],
    private commander: ClassCommander
  ) {
    this.commander.register(this, [this.register, this.unregister, this.start]);
  }

  getSchemas() {
    return Promise.all(this.schemas.map(fn => fn()));
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
    const ctor = this.factors.get(meta.type);

    if (!ctor) {
      throw Error(`Unknown factor named '${meta.type}'.`);
    }

    return new ctor(meta);
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
