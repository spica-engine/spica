import type { FilterConditionRow, FilterField, FilterFieldType } from './types';

export const OPERATORS_BY_TYPE: Record<FilterFieldType, { label: string; value: string }[]> = {
  string: [
    { label: 'contains', value: 'contains' },
    { label: 'equals', value: 'equals' },
    { label: 'not equals', value: 'not equals' },
    { label: 'starts with', value: 'starts with' },
    { label: 'ends with', value: 'ends with' },
    { label: 'is empty', value: 'is empty' },
    { label: 'is not empty', value: 'is not empty' },
  ],
  number: [
    { label: 'equals', value: 'equals' },
    { label: 'not equals', value: 'not equals' },
    { label: 'greater than', value: 'greater than' },
    { label: 'greater than or equal', value: 'greater than or equal' },
    { label: 'less than', value: 'less than' },
    { label: 'less than or equal', value: 'less than or equal' },
  ],
  date: [
    { label: 'equals', value: 'equals' },
    { label: 'before', value: 'before' },
    { label: 'after', value: 'after' },
    { label: 'on or before', value: 'on or before' },
    { label: 'on or after', value: 'on or after' },
    { label: 'is empty', value: 'is empty' },
    { label: 'is not empty', value: 'is not empty' },
  ],
  boolean: [
    { label: 'is', value: 'is' },
  ],
  enum: [
    { label: 'equals', value: 'equals' },
    { label: 'not equals', value: 'not equals' },
  ],
  // ObjectId is matched by exact hex; regex/range operators would break backend coercion.
  id: [
    { label: 'equals', value: 'equals' },
    { label: 'not equals', value: 'not equals' },
  ],
  // Relations store the related entry id(s); match against the raw hex the
  // backend coerces to ObjectId. Selecting entries yields a set, so `in` covers
  // both single (equals) and multi selection.
  relation: [
    { label: 'is any of', value: 'in' },
    { label: 'is none of', value: 'not in' },
    { label: 'is empty', value: 'is empty' },
    { label: 'is not empty', value: 'is not empty' },
  ],
};

export const DEFAULT_OPERATOR: Record<FilterFieldType, string> = {
  string: 'contains',
  number: 'equals',
  date: 'equals',
  boolean: 'is',
  enum: 'equals',
  id: 'equals',
  relation: 'in',
};

const NO_VALUE_OPERATORS = new Set([
  'is empty',
  'is not empty',
]);

export function operatorNeedsValue(operator: string): boolean {
  return !NO_VALUE_OPERATORS.has(operator);
}

// A condition contributes to the applied filter (and gets a chip) only when it
// has a field and either a value or a no-value operator like "is empty".
export function isConditionActive(c: FilterConditionRow): boolean {
  if (!c.field) return false;
  if (!operatorNeedsValue(c.operator)) return true;
  return c.value.trim() !== '';
}

// Human-readable value for a condition chip/tag; resolves enum/boolean labels.
export function formatConditionValue(c: FilterConditionRow, field?: FilterField): string {
  if (!operatorNeedsValue(c.operator)) return '';
  if (field?.type === 'enum') {
    return field.enumOptions?.find(o => String(o.value) === c.value)?.label ?? c.value;
  }
  if (field?.type === 'boolean') {
    return c.value === 'true' ? 'True' : 'False';
  }
  if (field?.type === 'relation') {
    const count = parseRelationIds(c.value).length;
    return count === 1 ? '1 entry' : `${count} entries`;
  }
  return c.value;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Relation conditions serialize their selected entry ids as a comma-separated
// string in `condition.value`, so chips and repopulation stay plain strings.
export const parseRelationIds = (value: string): string[] =>
  value
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

function buildMongoCondition(
  condition: FilterConditionRow,
  field: FilterField
): Record<string, any> | null {
  const { field: fieldKey, operator, value } = condition;

  switch (operator) {
    case 'contains':
      return { [fieldKey]: { $regex: escapeRegex(value), $options: 'i' } };

    case 'equals': {
      if (field.type === 'number') {
        const n = Number(value);
        if (isNaN(n)) return null;
        return { [fieldKey]: { $eq: n } };
      }
      if (field.type === 'enum') {
        const opt = field.enumOptions?.find(o => String(o.value) === value);
        const coerced = opt != null && typeof opt.value === 'number' ? Number(value) : value;
        return { [fieldKey]: { $eq: coerced } };
      }
      return { [fieldKey]: { $eq: value } };
    }

    case 'not equals': {
      if (field.type === 'number') {
        const n = Number(value);
        if (isNaN(n)) return null;
        return { [fieldKey]: { $ne: n } };
      }
      if (field.type === 'enum') {
        const opt = field.enumOptions?.find(o => String(o.value) === value);
        const coerced = opt != null && typeof opt.value === 'number' ? Number(value) : value;
        return { [fieldKey]: { $ne: coerced } };
      }
      return { [fieldKey]: { $ne: value } };
    }

    case 'starts with':
      return { [fieldKey]: { $regex: `^${escapeRegex(value)}`, $options: 'i' } };

    case 'ends with':
      return { [fieldKey]: { $regex: `${escapeRegex(value)}$`, $options: 'i' } };

    case 'is empty':
      return { [fieldKey]: { $in: [null, ''] } };

    case 'is not empty':
      return { [fieldKey]: { $nin: [null, ''] } };

    case 'greater than': {
      const n = Number(value);
      if (isNaN(n)) return null;
      return { [fieldKey]: { $gt: n } };
    }

    case 'greater than or equal': {
      const n = Number(value);
      if (isNaN(n)) return null;
      return { [fieldKey]: { $gte: n } };
    }

    case 'less than': {
      const n = Number(value);
      if (isNaN(n)) return null;
      return { [fieldKey]: { $lt: n } };
    }

    case 'less than or equal': {
      const n = Number(value);
      if (isNaN(n)) return null;
      return { [fieldKey]: { $lte: n } };
    }

    case 'before':
      return { [fieldKey]: { $lt: value } };

    case 'after':
      return { [fieldKey]: { $gt: value } };

    case 'on or before':
      return { [fieldKey]: { $lte: value } };

    case 'on or after':
      return { [fieldKey]: { $gte: value } };

    case 'is':
      return { [fieldKey]: { $eq: value === 'true' } };

    case 'in': {
      const ids = parseRelationIds(value);
      if (!ids.length) return null;
      return { [fieldKey]: { $in: ids } };
    }

    case 'not in': {
      const ids = parseRelationIds(value);
      if (!ids.length) return null;
      return { [fieldKey]: { $nin: ids } };
    }

    default:
      return null;
  }
}

export function conditionsToMongoFilter(
  conditions: FilterConditionRow[],
  fields: FilterField[]
): Record<string, any> | null {
  if (!conditions.length) return null;

  const fieldMap = new Map(fields.map(f => [f.key, f]));

  const validConditions = conditions.filter(c => {
    if (!c.field) return false;
    if (!operatorNeedsValue(c.operator)) return true;
    return c.value.trim() !== '';
  });

  const builtConditions = validConditions
    .map(c => {
      const field = fieldMap.get(c.field);
      if (!field) return null;
      return buildMongoCondition(c, field);
    })
    .filter((obj): obj is Record<string, any> => obj !== null);

  if (!builtConditions.length) return null;
  if (builtConditions.length === 1) return builtConditions[0];

  const ops = validConditions.slice(1).map(c => c.logicalOp);
  const allAnd = ops.every(op => op === 'AND');
  const allOr = ops.every(op => op === 'OR');

  if (allAnd) return { $and: builtConditions };
  if (allOr) return { $or: builtConditions };

  const andParts: Record<string, any>[] = [builtConditions[0]];
  const orParts: Record<string, any>[] = [];

  ops.forEach((op, i) => {
    if (op === 'AND') andParts.push(builtConditions[i + 1]);
    else orParts.push(builtConditions[i + 1]);
  });

  const parts: Record<string, any>[] = [];
  if (andParts.length > 1) parts.push({ $and: andParts });
  else parts.push(andParts[0]);
  if (orParts.length > 1) parts.push({ $or: orParts });
  else if (orParts.length === 1) parts.push(orParts[0]);

  return parts.length === 1 ? parts[0] : { $and: parts };
}

// ── URL serialization ──────────────────────────────────────────────────────
// Filter state lives in the `?filter=` query param so it is shareable and
// deep-linkable. Only the semantic fields are serialized (not the transient row
// `id`, which is regenerated on parse purely as a React key).

type SerializedCondition = Pick<FilterConditionRow, 'field' | 'operator' | 'value' | 'logicalOp'>;

export function encodeFilterConditions(conditions: FilterConditionRow[]): string {
  const minimal: SerializedCondition[] = conditions
    .filter(isConditionActive)
    .map(({field, operator, value, logicalOp}) => ({field, operator, value, logicalOp}));
  return JSON.stringify(minimal);
}

export function decodeFilterConditions(param: string | null): FilterConditionRow[] {
  if (!param) return [];
  try {
    const parsed = JSON.parse(param);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(c => c && typeof c.field === 'string' && c.field)
      .map(c => ({
        id: crypto.randomUUID(),
        logicalOp: c.logicalOp === 'OR' ? 'OR' : 'AND',
        field: String(c.field),
        operator: typeof c.operator === 'string' ? c.operator : 'contains',
        value: typeof c.value === 'string' ? c.value : ''
      })) as FilterConditionRow[];
  } catch {
    return [];
  }
}

// The param value that pins a bucket's list to a single document by id — the
// target of a relation click, expressed as an ordinary `_id equals` condition so
// it renders as a removable filter chip like any other.
export function encodeIdFilterConditions(documentId: string): string {
  return JSON.stringify([
    {field: '_id', operator: 'equals', value: documentId, logicalOp: 'AND'} as SerializedCondition
  ]);
}
