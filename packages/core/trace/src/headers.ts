export const REQUEST_ID_HEADER = "x-spica-request-id";
export const HOP_ID_HEADER = "x-spica-hop-id";
export const PARENT_HOP_ID_HEADER = "x-spica-parent-hop-id";

const VALID_TRACE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function isValidTraceId(value: unknown): value is string {
  return typeof value == "string" && VALID_TRACE_ID.test(value);
}
