import {Inject, Injectable, Logger} from "@nestjs/common";
import {idOf} from "@spica-server/data";
import {FUNCTION_LOG_SINK, LogSink} from "@spica-server/interface-function-log";
import {LogChannels, LogLevels} from "@spica-server/interface-function-runtime";
import {RuntimeFunction} from "./placeholder-source.js";
import {Placeholder} from "./placeholder-text.js";

export const WORKER_LOG_OUTPUT = Symbol("WORKER_LOG_OUTPUT");

@Injectable()
export class PlaceholderDiagnostics {
  private readonly logger = new Logger("FunctionPlaceholder");

  constructor(
    @Inject(FUNCTION_LOG_SINK) private logSink: LogSink,
    @Inject(WORKER_LOG_OUTPUT) private workerLogOutput: string[] | undefined
  ) {}

  warnUnresolved(fn: RuntimeFunction, field: string, placeholder: Placeholder) {
    this.warn(
      fn,
      `Failed to resolve \${${placeholder.prefix}.${placeholder.key}} in ${field}, falling back to defaults.`
    );
  }

  warnInvalidNumber(fn: RuntimeFunction, field: string, value: unknown, fallback: number) {
    this.warn(
      fn,
      `Resolved an invalid value ${JSON.stringify(value)} for ${field}, falling back to ${fallback}.`
    );
  }

  warnLookupFailure(error: unknown) {
    this.logger.error(
      `Failed to load placeholder values of function triggers. Reason: ${error instanceof Error ? error.message : error}`
    );
  }

  private warn(fn: RuntimeFunction, message: string) {
    this.logger.warn(`Function '${fn.name}': ${message}`);
    if (this.workerLogOutput?.includes("database")) {
      this.persist(idOf(fn).toString(), message);
    }
  }

  private persist(functionId: string, content: string) {
    this.logSink
      .insert({
        function: functionId,
        event_id: "",
        channel: LogChannels.ERROR,
        level: LogLevels.WARN,
        content,
        created_at: new Date()
      })
      .catch(error =>
        this.logger.error(`Failed to persist the log of function ${functionId}: ${error.message}`)
      );
  }
}
