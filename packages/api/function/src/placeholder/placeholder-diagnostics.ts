import {Logger} from "@nestjs/common";
import {Placeholder} from "./placeholder-text.js";

const logger = new Logger("FunctionPlaceholder");

export function warnUnresolved(functionName: string, field: string, placeholder: Placeholder) {
  logger.warn(
    `Function '${functionName}' failed to resolve \${${placeholder.prefix}.${placeholder.key}} in ${field}, falling back to defaults.`
  );
}

export function warnInvalidNumber(
  functionName: string,
  field: string,
  value: unknown,
  fallback: number
) {
  logger.warn(
    `Function '${functionName}' resolved an invalid value ${JSON.stringify(value)} for ${field}, falling back to ${fallback}.`
  );
}

export function warnLookupFailure(error: unknown) {
  logger.error(
    `Failed to load placeholder values of function triggers. Reason: ${error instanceof Error ? error.message : error}`
  );
}
