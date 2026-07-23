import {BuildMeta, BuildStrategy, Description} from "@spica-server/interface-function-builder";

export abstract class Builder {
  protected abstract strategies: Map<string, BuildStrategy>;

  constructor(protected readonly language: string) {}

  get description(): Description {
    return this.strategy.description;
  }

  build(meta: BuildMeta): Promise<void> {
    return this.strategy.build(meta);
  }

  kill(): Promise<void> {
    return Promise.all(Array.from(this.strategies.values()).map(s => s.kill())).then(() => {});
  }

  private get strategy(): BuildStrategy {
    const strategy = this.strategies.get(this.language);
    if (!strategy) {
      throw new Error(
        `Language "${this.language}" is not supported by ${this.constructor.name}.`
      );
    }
    return strategy;
  }
}
