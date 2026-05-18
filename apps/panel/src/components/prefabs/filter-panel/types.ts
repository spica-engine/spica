export type FilterFieldType = 'string' | 'number' | 'date' | 'boolean' | 'enum';

export interface FilterField {
  key: string;
  label: string;
  type: FilterFieldType;
  enumOptions?: { label: string; value: string | number }[];
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
