export function definedDefault<T>(value: T | "" | null | undefined): T | undefined {
  return value === "" || value === null || value === undefined ? undefined : value;
}

export function dateSaveReadyValue(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const date = new Date(value as string | number | Date);
  return isNaN(date.getTime()) ? undefined : date;
}
