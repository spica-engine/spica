export type FilterFieldType = 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'id' | 'relation';

export interface FilterField {
  key: string;
  label: string;
  type: FilterFieldType;
  enumOptions?: { label: string; value: string | number }[];
  /** Related bucket id — required for `relation` fields to drive the picker. */
  relationBucketId?: string;
}

export interface FilterConditionRow {
  id: string;
  logicalOp: 'AND' | 'OR';
  field: string;
  operator: string;
  value: string;
}

export interface SortField {
  key: string;
  label: string;
}

export interface SortRow {
  id: string;
  field: string;
  direction: 'asc' | 'desc';
}
