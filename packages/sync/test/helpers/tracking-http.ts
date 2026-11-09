import {SyncHttpClient} from "@spica-server/sync";

export type Responder = (method: string, url: string) => unknown;

export interface TrackingHttp extends SyncHttpClient {
  readonly calls: Array<{method: string; url: string}>;
  readonly peak: number;
  readonly inFlight: number;
}

/**
 * Fake client that records how many requests overlap. Every request stays in flight for a
 * few milliseconds so overlapping callers actually pile up.
 */
export function createTrackingHttp(respond: Responder = () => ({}), latencyMs = 2): TrackingHttp {
  const calls: Array<{method: string; url: string}> = [];
  let inFlight = 0;
  let peak = 0;

  const request = (method: string) => async (url: string) => {
    calls.push({method, url});
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      await new Promise(resolve => setTimeout(resolve, latencyMs));
      return respond(method, url);
    } finally {
      inFlight--;
    }
  };

  return {
    get: request("get"),
    post: request("post"),
    put: request("put"),
    patch: request("patch"),
    delete: request("delete"),
    head: request("head"),
    calls,
    get peak() {
      return peak;
    },
    get inFlight() {
      return inFlight;
    }
  } as TrackingHttp;
}
