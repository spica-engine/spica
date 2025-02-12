import {getLineNumberAndColumnFromRange} from "./range";
import path from "path";

export interface Status<Details = StatusDetails> {
  metadata?: StatusMetadata;
  status: "Success" | "Failure";
  message: string;
  reason:
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
  details?: Details;
  code: number;
}

export interface StatusMetadata {
  [key: string]: unknown;
}

export interface StatusDetails {
  [key: string]: unknown;
}

export function isStatusKind(object: unknown): object is Status {
  return typeof object == "object" && "kind" in object && object["kind"] == "Status";
}

export function isFailureStatus(object: unknown): object is Status {
  return isStatusKind(object) && object.status == "Failure";
}

export function formatFailureStatus(status: Status) {
  return `Error from server (${status.reason}): ${status.message}`;
}

export function isValidationError(object: unknown): object is Status {
  return (
    isFailureStatus(object) && object.reason == "Invalid" && Array.isArray(object.details.errors)
  );
}

export function formatValidationErrors(
  status: Status,
  document: any,
  documentContent: string,
  documentName: string
) {
  if (
    !path.isAbsolute(documentName) &&
    !documentName.startsWith("./") &&
    !documentName.startsWith("../")
  ) {
    documentName = `./${documentName}`;
  }

  const errors = [];

  for (const error of status.details.errors as any[]) {
    const range = getRange(document, documentContent, error.path).join(":");

    errors.push(`${documentName}:${range} - ${error.path} ${error.message}`);
  }
  return `Error from server (${status.reason}): ${status.message}\n${errors.join("\n")}`;
}

function getRange(document, documentContent, path: string) {
  const tree = path.split(".");
  let current = document.contents;

  for (const key of tree.slice(1)) {
    const children = current.get(key, true);
    if (children) {
      current = children;
    }
  }

  return getLineNumberAndColumnFromRange(documentContent, current.range[0]);
}
