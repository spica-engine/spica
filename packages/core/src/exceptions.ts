export function serializeError<T>(error: T) {
  return error instanceof Error ? JSON.parse(JSON.stringify(error)) : error;
}
