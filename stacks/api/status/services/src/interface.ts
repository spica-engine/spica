export interface StatusOptions {
  requestLimit: number;
  expireAfterSeconds: number;
}

export const STATUS_OPTIONS = Symbol.for("STATUS_OPTIONS");

export interface ApiStatus {
  request: {
    size: number;
  };
  response: {
    size: number;
  };
}
