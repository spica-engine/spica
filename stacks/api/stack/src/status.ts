export interface Status {
  metadata?: StatusMetadata;
  status: "Success" | "Failure";
  message: string;
  reason: "BadRequest" | "Unauthorized" | "Forbidden" | "NotFound" | "AlreadyExists";
  details?: StatusDetails;
  code: number;
}

export interface StatusMetadata {
  [key: string]: unknown;
}

export interface StatusDetails {
  [key: string]: unknown;
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
    [Symbol.for('kind')]: "Status"
  };
}

export function isStatusKind(object: unknown): object is Status {
    return typeof object == "object" && Symbol.for("kind") in object && object[Symbol.for("kind")] == "Status";
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
