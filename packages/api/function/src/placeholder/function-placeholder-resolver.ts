import {Inject, Injectable} from "@nestjs/common";
import {COLLECTION_QUERY, CollectionQueryFacade} from "@spica-server/interface-data";
import {ChangeKind, Options, FUNCTION_OPTIONS, TargetChange} from "@spica-server/interface-function";
import {DEFAULT_EVENT_CONCURRENCY} from "@spica-server/interface-function-scheduler";
import {idOf} from "@spica-server/data";
import * as CRUD from "../crud.js";
import {NumericRule, parseNumber} from "./numeric-coercion.js";
import {PLACEHOLDER_SOURCES, PlaceholderSource, RuntimeFunction} from "./placeholder-source.js";
import {Placeholder, PlaceholderLookup, extractPlaceholders, substitute} from "./placeholder-text.js";
import {PlaceholderDiagnostics} from "./placeholder-diagnostics.js";

export interface RuntimeConfig {
  timeout: number;
  warmWorkers: number;
  concurrencyPerWorker: number;
}

const WARM_WORKERS_RULE: NumericRule = {min: 0, integer: true};
const CONCURRENCY_RULE: NumericRule = {min: 1, integer: true};
const TIMEOUT_RULE: NumericRule = {min: 0, integer: false};

@Injectable()
export class FunctionPlaceholderResolver {
  constructor(
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade,
    @Inject(PLACEHOLDER_SOURCES) private sources: PlaceholderSource[],
    @Inject(FUNCTION_OPTIONS) private options: Options,
    private diagnostics: PlaceholderDiagnostics
  ) {}

  async resolveRouting(routing: TargetChange[]): Promise<TargetChange[]> {
    const ids = routing.filter(isSubscribingWithPlaceholder).map(change => change.target.id);
    if (!ids.length) {
      return routing;
    }

    const functions = await this.findFunctions([...new Set(ids)]);
    if (!functions) {
      return routing;
    }

    return routing.map(change => {
      const fn = functions.get(change.target.id);
      if (!fn || !isSubscribingWithPlaceholder(change)) {
        return change;
      }
      const lookup = this.createLookup(fn, `trigger '${change.target.handler}' options`);
      return {...change, options: substitute(change.options, lookup)};
    });
  }

  resolveRuntimeConfig(fn: RuntimeFunction): RuntimeConfig {
    return {
      timeout: this.resolveNumber(fn, "timeout", TIMEOUT_RULE, this.options.timeout),
      warmWorkers: this.resolveNumber(fn, "warmWorkers", WARM_WORKERS_RULE, 0),
      concurrencyPerWorker: this.resolveNumber(
        fn,
        "concurrencyPerWorker",
        CONCURRENCY_RULE,
        DEFAULT_EVENT_CONCURRENCY
      )
    };
  }

  private resolveNumber(
    fn: RuntimeFunction,
    field: keyof RuntimeConfig,
    rule: NumericRule,
    fallback: number
  ): number {
    const raw = fn[field];
    if (raw === undefined || raw === null) {
      return fallback;
    }
    const resolved = substitute(raw, this.createLookup(fn, field));
    const parsed = parseNumber(resolved, rule);
    if (parsed !== undefined) {
      return parsed;
    }
    if (!isStillPlaceholder(resolved)) {
      this.diagnostics.warnInvalidNumber(fn, field, raw, fallback);
    }
    return fallback;
  }

  private createLookup(fn: RuntimeFunction, field: string): PlaceholderLookup {
    const values = new Map(this.sources.map(source => [source.prefix, source.load(fn)]));
    return (placeholder: Placeholder) => {
      const value = values.get(placeholder.prefix)?.get(placeholder.key);
      if (value === undefined) {
        this.diagnostics.warnUnresolved(fn, field, placeholder);
      }
      return value;
    };
  }

  private async findFunctions(ids: string[]): Promise<Map<string, RuntimeFunction> | null> {
    try {
      const fns = await CRUD.findManyForRuntime(this.queries, parseIds(ids));
      return new Map(fns.map(fn => [idOf(fn).toString(), fn]));
    } catch (error) {
      this.diagnostics.warnLookupFailure(error);
      return null;
    }
  }
}

function isStillPlaceholder(value: unknown) {
  return extractPlaceholders(value).length > 0;
}

function parseIds(ids: string[]) {
  const idType = CRUD.functionIds();
  return ids.filter(id => idType.isValid(id)).map(id => idType.parse(id));
}

function isSubscribingWithPlaceholder(change: TargetChange) {
  return change.kind != ChangeKind.Removed && extractPlaceholders(change.options).length > 0;
}
