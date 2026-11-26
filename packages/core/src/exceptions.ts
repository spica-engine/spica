// NestJS 11 replaces an Error instance used as a response body with the bare status text. Converting
// it first keeps the fields API clients receive. Only use it for errors that are safe to expose.
export function serializeError<T>(error: T) {
  return error instanceof Error ? JSON.parse(JSON.stringify(error)) : error;
}
