import {Factor, FactorMeta, TwoFactorAuthSchemaProvider} from "./interface";
import {Injectable} from "@nestjs/common";

@Injectable()
export class TwoFactorAuth {
  private userFactor = new Map<string, {hasStarted: boolean; factor: Factor}>();

  constructor(private factors: Map<string, any>, private schemas: TwoFactorAuthSchemaProvider[]) {}

  getSchemas() {
    return Promise.all(this.schemas.map(fn => fn()));
  }

  register(identity: string, factorOrMeta: Factor | FactorMeta) {
    let factor;
    if (this.isFactor(factorOrMeta)) {
      factor = factorOrMeta;
    } else {
      factor = this.getFactor(factorOrMeta);
    }

    this.userFactor.set(identity, {hasStarted: false, factor});
  }

  unregister(identity: string) {
    return this.userFactor.delete(identity);
  }

  getFactor(factorMeta: FactorMeta) {
    const ctor = this.factors.get(factorMeta.type);

    if (!ctor) {
      throw Error(`Unknown factor named '${factorMeta.type}'.`);
    }

    return new ctor(factorMeta);
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

  // better type check would be better
  isFactor = (factorOrMeta: Factor | FactorMeta): factorOrMeta is Factor => {
    return (
      typeof factorOrMeta["start"] == "function" ||
      typeof factorOrMeta["authenticate"] == "function"
    );
  };
}
