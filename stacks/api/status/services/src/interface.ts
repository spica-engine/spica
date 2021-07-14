export interface StatusOptions {
  requestLimit: number;
}

export const STATUS_OPTIONS = Symbol.for("STATUS_OPTIONS");

export interface ApiStatus {
  request: {
    count: number;
    size: number;
  };

  response: {
    count: number;
    size: number;
  };
}
