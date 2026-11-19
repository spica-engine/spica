import {LocalResource, ResourceModule} from "./types";

export const VALUE_ENV_PREFIX = "SPICA_VALUE_";

type Lookup = (key: string) => string | undefined;
type ValueHolder = {key: string; value?: string};
type MissingRule = (local: ValueHolder, remote?: ValueHolder) => boolean;

export abstract class ValueHandler {
  private next?: ValueHandler;

  setNext(next: ValueHandler): ValueHandler {
    this.next = next;
    return next;
  }

  resolve(key: string): string | undefined {
    return this.lookup(key) ?? this.next?.resolve(key);
  }

  protected abstract lookup(key: string): string | undefined;
}

class LookupHandler extends ValueHandler {
  constructor(private readonly find: Lookup) {
    super();
  }

  protected lookup(key: string): string | undefined {
    return this.find(key);
  }
}

function ownValue(values: Record<string, string | undefined>, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : undefined;
}

export function fromEnv(
  env: Record<string, string | undefined>,
  prefix = VALUE_ENV_PREFIX
): ValueHandler {
  return new LookupHandler(key => ownValue(env, `${prefix}${key}`));
}

export function fromMap(values: Record<string, string | undefined>): ValueHandler {
  return new LookupHandler(key => ownValue(values, key));
}

export function chain(...handlers: ValueHandler[]): ValueHandler {
  const [first = new LookupHandler(() => undefined), ...rest] = handlers;
  rest.reduce((previous, handler) => previous.setNext(handler), first);
  return first;
}

const MISSING_RULES: Record<string, MissingRule> = {
  "env-var": local => local.value === undefined,
  secret: (local, remote) => !remote && local.value === undefined
};

function injectValue<T extends ValueHolder>(
  local: LocalResource<T>,
  resolver: ValueHandler
): LocalResource<T> {
  const value = resolver.resolve(local.data.key);
  return value === undefined ? local : {...local, data: {...local.data, value}};
}

function withResolvedValues(
  mod: ResourceModule,
  resolver: ValueHandler,
  missingValue: MissingRule
): ResourceModule {
  return {
    ...mod,
    missingValue,
    async readLocal(rootDir, source) {
      const locals = await mod.readLocal(rootDir, source);
      return locals.map(local => injectValue(local, resolver));
    }
  };
}

export function withValues(modules: ResourceModule[], resolver: ValueHandler): ResourceModule[] {
  return modules.map(mod => {
    const rule = MISSING_RULES[mod.name];
    return rule ? withResolvedValues(mod, resolver, rule) : mod;
  });
}

export class MissingValuesError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Missing values for: ${missing.join(", ")}\n` +
        `Set them with "spica env <KEY>" / "spica secret <KEY>" or the ${VALUE_ENV_PREFIX}<KEY> environment variable.`
    );
  }
}
