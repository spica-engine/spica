import {InputPlacerWithMetaPlacer} from "./input";

export class InputResolver {
  constructor(private placers: InputPlacerWithMetaPlacer[]) {}

  resolve(type: string): InputPlacerWithMetaPlacer {
    return this.placers.find(p => p.type === type);
  }

  entries(value_types_only?: boolean): string[] {
    if (value_types_only) {
      this.placers = this.placers.filter(p => {
        if (p.origin === "string" || p.origin === "number" || p.origin === "boolean") {
          return true;
        }
      });
    }
    return this.placers.map(p => p.type);
  }

  getOriginByType(type: string): string {
    const input = this.resolve(type);
    return input && input.origin;
  }

  coerce(type: string) {
    const input = this.resolve(type);
    if (input && typeof input.coerce == "function") {
      return input.coerce();
    }
    return undefined;
  }
}
