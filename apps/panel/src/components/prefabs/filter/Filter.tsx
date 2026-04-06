/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { FlexElement, Select, Button, Icon } from 'oziko-ui-kit';
import type { Property } from '../../../store/api/bucketApi';
import styles from './Filter.module.scss';
import FilterValueInput from './FilterValueInput';
import { convertConditionsToFilter } from './filterUtils';
import type { FilterCondition } from './inputHandlers/types';
import { getCompleteConditions, canAddCondition } from './validation';
import { mapPropertyTypeToValueType, getEmptyValueForType } from './conditionValueType';
import { getDefaultOperator, getOperatorOptions } from './operatorRegistry';

export type { FilterCondition } from './inputHandlers/types';

type FilterProps = {
  bucketProperties: Record<string, Property>;
  onChange?: (filter: Record<string, any> | null, conditions: FilterCondition[]) => void;
  resetKey?: string | number;
  className?: string;
};

const logicalOperatorOptions = [
  { label: "and", value: "and" },
  { label: "or", value: "or" }
];

const createEmptyCondition = (): FilterCondition => ({
  id: crypto.randomUUID(),
  field: "",
  operator: "Equal",
  value: "",
  valueType: "unknown",
  logicalOperator: "and"
});

const Filter: React.FC<FilterProps> = ({ bucketProperties, onChange, resetKey, className }) => { 
  const [conditions, setConditions] = useState<FilterCondition[]>(() => [createEmptyCondition()]);
  const conditionsContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setConditions([createEmptyCondition()]);
  }, [resetKey]);

  const completeConditions = useMemo(
    () => getCompleteConditions(conditions),
    [conditions]
  );

  const canAdd = useMemo(
    () => canAddCondition(conditions),
    [conditions]
  );

  useEffect(() => {
    if (onChange) {
      if (completeConditions.length === 0) {
        onChange(null, []);
      } else {
        const filter = convertConditionsToFilter(completeConditions);
        onChange(filter, completeConditions);
      }
    }
  }, [completeConditions, onChange]);

  const fieldOptions = useMemo(() => {
    return Object.entries(bucketProperties).map(([key, property]) => ({
      label: property.title || key,
      value: key
    }));
  }, [bucketProperties]);

  const getFieldProperty = useCallback((fieldKey: string): Property | undefined => {
    return bucketProperties[fieldKey];
  }, [bucketProperties]);

  const handleFieldChange = useCallback((conditionId: string, fieldKey: string) => {
    setConditions(prev => prev.map(condition => {
      if (condition.id !== conditionId) {
        return condition;
      }
      
      const property = bucketProperties[fieldKey];
      const valueType = mapPropertyTypeToValueType(property);
      const value = getEmptyValueForType(valueType);
      const operator = getDefaultOperator(valueType);
      
      return {
        ...condition,
        field: fieldKey,
        valueType,
        value,
        operator
      };
    }));
  }, [bucketProperties]);

  const handleValueChange = useCallback((conditionId: string, value: any) => {
    setConditions(prev => prev.map(condition => 
      condition.id === conditionId 
        ? { ...condition, value }
        : condition
    ));
  }, []);

  const handleOperatorChange = useCallback((conditionId: string, operator: string) => {
    setConditions(prev => prev.map(condition => 
      condition.id === conditionId 
        ? { ...condition, operator }
        : condition
    ));
  }, []);

  const handleLogicalOperatorChange = useCallback((conditionId: string, operator: "and" | "or") => {
    setConditions(prev => prev.map(condition => 
      condition.id === conditionId 
        ? { ...condition, logicalOperator: operator }
        : condition
    ));
  }, []);

  const handleDeleteCondition = useCallback((conditionId: string) => {
    setConditions(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter(condition => condition.id !== conditionId);
    });
  }, []);

  const handleAddCondition = useCallback(() => {
    if (!canAdd) return;

    const newCondition: FilterCondition = {
      id: crypto.randomUUID(),
      field: "",
      operator: "Equal",
      value: "",
      valueType: "unknown",
      logicalOperator: "and"
    };
    setConditions(prev => [...prev, newCondition]);
  }, [canAdd]);

  useEffect(() => {
    if (conditionsContainerRef.current) {
      conditionsContainerRef.current.scrollTop = conditionsContainerRef.current.scrollHeight;
    }
  }, [conditions.length]);

  return (
    <FlexElement direction="vertical" className={`${styles.container} ${className}`} gap={10}>
      <div ref={conditionsContainerRef} className={styles.conditionsContainer}>
        <FlexElement 
          dimensionX="fill" 
          direction="vertical" 
          alignment="leftCenter" 
          gap={10}
        >
          {conditions.map((condition, index) => (
            <FlexElement key={condition.id} gap={10}>
          {index === 0 ? (
            <FlexElement dimensionX={70} alignment="leftCenter">Where</FlexElement>
          ) : (
            <Select
              options={logicalOperatorOptions}
              value={condition.logicalOperator || "and"}
              onChange={(value) => handleLogicalOperatorChange(condition.id, value as "and" | "or")}
              className={styles.logicalOperator}
              dimensionY={25}
              dimensionX={70}
            />
          )}

          <FlexElement dimensionY={25}>
            <ul className={styles.options}>
              <li>
                <Select
                  options={fieldOptions}
                  value={condition.field}
                  onChange={(value) => handleFieldChange(condition.id, value as string)}
                  className={styles.select}
                  dimensionY="fill"
                  dimensionX={150}
                />
              </li>
              <li className={styles.condition}>
                {(() => {
                  const operatorOptions = getOperatorOptions(condition.valueType);
                  return operatorOptions ? (
                    <Select
                      options={operatorOptions}
                      value={condition.operator}
                      onChange={(value) => handleOperatorChange(condition.id, value as string)}
                      dimensionY="fill"
                      dimensionX={120}
                    />
                  ) : (
                    <span>{condition.operator}</span>
                  );
                })()}
              </li>
              <li className={styles.filterInput}>
                <FlexElement dimensionY="fill" dimensionX={200}>
                <FilterValueInput
                  condition={condition}
                  property={getFieldProperty(condition.field)}
                  onValueChange={handleValueChange}
                  onOperatorChange={handleOperatorChange}
                />

                </FlexElement>
             
              </li>
              <li>
                <Button 
                  variant="icon" 
                  onClick={() => handleDeleteCondition(condition.id)}
                  disabled={conditions.length <= 1}
                >
                  <Icon name="delete" className={styles.deleteIcon} />
                </Button>
              </li>
            </ul>
          </FlexElement>
            </FlexElement>
          ))}
        </FlexElement>
      </div>

      <Button 
        onClick={handleAddCondition}
        className={styles.addConditionButton}
        variant="outlined"
        color="default"
        fullWidth
        disabled={!canAdd}
      >
        <Icon name="plus" />
        Add New Condition
      </Button>
    </FlexElement>
  );
};

export default Filter;
