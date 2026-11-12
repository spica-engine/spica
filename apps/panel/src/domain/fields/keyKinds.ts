const INPUT_KIND_ALIASES: Record<string, string> = {
  uuid: "string",
  bigint: "string",
  integer: "number"
};

export const KEY_PROPERTY_TYPES = ["uuid", "integer", "bigint"] as const;

export const inputKindOf = (type: string): string => INPUT_KIND_ALIASES[type] ?? type;

export const isHiddenKeyProperty = (
  key: string,
  property: {options?: {generated?: boolean}} | undefined,
  keyField: string | undefined,
  isEditMode: boolean
): boolean => key === keyField && (isEditMode || property?.options?.generated === true);
