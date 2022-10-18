export interface Status {
  metadata?: StatusMetadata;
  status: StatusStatus;
  message: string;
  reason: StatusReason;
  details?: StatusDetails;
  code: number;
}

export type StatusReason =
  | "BadRequest"
  | "Unauthorized"
  | "Forbidden"
  | "NotFound"
  | "AlreadyExists"
  | "Conflict"
  | "Invalid"
  | "Timeout"
  | "ServerTimeout"
  | "MethodNotAllowed"
  | "InternalError";

export type StatusStatus = "Success" | "Failure";

export interface StatusMetadata {
  [key: string]: unknown;
}

export interface StatusDetails {
  [key: string]: any;
}

export function status({metadata, code, message, reason, status, details}: Status) {
  return {
    kind: "Status",
    apiVersion: "v1",
    metadata,
    status,
    message,
    reason,
    details,
    code,
    [Symbol.for("kind")]: "Status"
  };
}

export function isStatusKind(object: unknown): object is Status {
  return (
    typeof object == "object" &&
    Symbol.for("kind") in object &&
    object[Symbol.for("kind")] == "Status"
  );
}

export function alreadyExists({
  message,
  details
}: {
  message: string;
  details: {kind: string; name: string};
}) {
  return status({
    code: 409,
    reason: "AlreadyExists",
    status: "Failure",
    message,
    details
  });
}

export function notFound({
  message,
  details
}: {
  message: string;
  details?: {kind: string; name: string};
}) {
  return status({
    code: 409,
    reason: "NotFound",
    status: "Failure",
    message,
    details
  });
}

export function badRequest({
  reason,
  message,
  details
}: {
  reason: StatusReason;
  message: string;
  details: StatusDetails;
}) {
  return status({
    code: 400,
    reason,
    status: "Failure",
    message,
    details
  });
}
