export interface Status {
    metadata?: StatusMetadata;
    status: "Success" | "Failure";
    message: string;
    reason: "BadRequest" | "Unauthorized" | "Forbidden" | "NotFound" | "AlreadyExists" | "Conflict" | "Invalid" | "Timeout" | "ServerTimeout" | "MethodNotAllowed" | "InternalError";
    details?: StatusDetails;
    code: number;
  }
  
  export interface StatusMetadata {
    [key: string]: unknown;
  }
  
  export interface StatusDetails {
    [key: string]: unknown;
  }
  
  
export function isStatusKind(object: unknown): object is Status {
    return typeof object == "object" && 'kind' in object && object['kind'] == "Status";
}

export function isFailureStatus(object: unknown): object is Status {
    return isStatusKind(object) && object.status == "Failure";
}

export function formatFailureStatus(status: Status) {
    return `Error from server (${status.reason}): ${status.message}`
}