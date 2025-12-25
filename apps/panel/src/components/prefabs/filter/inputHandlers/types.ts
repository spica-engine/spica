/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { Property } from '../../../../store/api/bucketApi';

export type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: any;
  logicalOperator?: "and" | "or";
};

export type FilterValueInputProps = {
  condition: FilterCondition;
  property?: Property;
  onValueChange: (conditionId: string, value: any) => void;
};
