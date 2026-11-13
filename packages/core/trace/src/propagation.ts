import diagnosticsChannel from "diagnostics_channel";
import {PARENT_HOP_ID_HEADER, REQUEST_ID_HEADER} from "./headers.js";
import {getCurrentTrace} from "./context.js";

let installed = false;

export function installTracePropagation() {
  if (installed) {
    return;
  }
  installed = true;

  propagateOn("undici:request:create", (request, name, value) => request.addHeader(name, value));
  propagateOn("http.client.request.created", (request, name, value) =>
    request.setHeader(name, value)
  );
}

function propagateOn(
  channel: string,
  setHeader: (request: any, name: string, value: string) => void
) {
  diagnosticsChannel.subscribe(channel, (message: any) => {
    const trace = getCurrentTrace();
    if (!trace) {
      return;
    }
    // An error thrown inside a diagnostics_channel subscriber is rethrown as an uncaught
    // exception, which would take the whole process down over a missing correlation header.
    try {
      setHeader(message.request, REQUEST_ID_HEADER, trace.requestId);
      setHeader(message.request, PARENT_HOP_ID_HEADER, trace.hopId);
    } catch {}
  });
}
