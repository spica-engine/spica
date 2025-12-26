/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { Property } from '../../../../store/api/bucketApi';
import type { ConditionValueType } from '../conditionValueType';


export type RelationValue = 
  | string
  | { kind: 'id'; id: string }
  | { _id: string }
  | { id: string };

type BaseCondition = {
  id: string;
  field: string;
  operator: string;
  logicalOperator?: "and" | "or";
  valueType: ConditionValueType;
};

export type FilterCondition =
  | (BaseCondition & { valueType: 'string'; value: string })
  | (BaseCondition & { valueType: 'number'; value: number | '' | null })
  | (BaseCondition & { valueType: 'boolean'; value: boolean })
  | (BaseCondition & { valueType: 'date'; value: Date | string })
  | (BaseCondition & { valueType: 'array'; value: unknown[] })
  | (BaseCondition & { valueType: 'object'; value: Record<string, unknown> })
  | (BaseCondition & { valueType: 'relation'; value: RelationValue })
  | (BaseCondition & { valueType: 'generic'; value: unknown })
  | (BaseCondition & { valueType: 'unknown'; value: unknown });

export type FilterValueInputProps = {
  condition: FilterCondition;
  property?: Property;
  onValueChange: (conditionId: string, value: any) => void;
};
