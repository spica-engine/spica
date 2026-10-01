import {ArgumentsHost, Catch, HttpException, Logger} from "@nestjs/common";
import {BaseExceptionFilter} from "@nestjs/core";

/**
 * Gives the driver contract's "this backend cannot do that" errors an HTTP answer.
 *
 * Without it both surfaced as **500**, which is loud but says the wrong thing: the server did not break, it
 * declined. A client — the panel included — could not tell a capability gap from a crash, so it could
 * neither explain the failure nor stop retrying.
 *
 * The split follows what the two error classes already mean:
 *
 * - `UNSUPPORTED_CAPABILITY` → **501**. The surface does not exist on this backend and there is nothing the
 *   caller can change. `GET /status/capabilities` declares these up front, so a well-behaved client never
 *   asks (the panel reads it); this is the answer for one that does.
 * - `UNSUPPORTED_EXPRESSION` → **400**. Something in the request was refused — an operator outside the
 *   measured closed set, a projection mixing inclusion and exclusion. The caller can fix it.
 *
 * **Matched by `code`, not `instanceof`.** The same reason `isId()` exists: a package can end up holding a
 * second module instance of the error class, and then `instanceof` quietly stops matching while the error
 * keeps flowing. `code` is part of the contract and survives that.
 */
const STATUS_BY_CODE: Record<string, number> = {
  UNSUPPORTED_CAPABILITY: 501,
  UNSUPPORTED_EXPRESSION: 400
};

const REASON: Record<number, string> = {501: "Not Implemented", 400: "Bad Request"};

/**
 * The HTTP status a driver-contract error deserves, or `undefined` when it is not one.
 *
 * Exported because the filter is not the only place that has to know: a handler that wraps errors itself
 * (`bucket-data.controller.ts`'s `errorHandler`) would otherwise flatten these to 500 before the filter ever
 * sees them. Keeping the table in one place is the point — two copies drift.
 */
export function driverErrorStatus(error: unknown): number | undefined {
  return STATUS_BY_CODE[(error as {code?: string})?.code ?? ""];
}

/**
 * Extends Nest's own filter rather than implementing `ExceptionFilter`: everything this one does not
 * recognize has to keep its previous behaviour, and `super.catch` is what provides it. A catch-all filter
 * that rethrows instead would turn every other error into an unhandled one.
 */
@Catch()
export class DriverCapabilityExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DriverCapabilityExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const status = driverErrorStatus(exception);

    // Only HTTP has a status code to send. A websocket handler reports its own refusals through the error
    // chunk, and rewriting the exception here would not reach the client.
    if (!status || host.getType() !== "http") {
      return super.catch(exception, host);
    }

    const message = (exception as Error).message;
    this.logger.warn(message);

    return super.catch(
      new HttpException({statusCode: status, message, error: REASON[status]}, status),
      host
    );
  }
}
