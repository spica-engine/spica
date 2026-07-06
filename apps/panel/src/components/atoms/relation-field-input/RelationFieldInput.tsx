import React, {useCallback, useMemo} from "react";
import {RelationInput} from "oziko-ui-kit";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

type RelationValue = {value: string; label?: string};

interface RelationFieldInputProps {
  fieldKey: string;
  title: string;
  description?: string;
  className?: string;
  popupClassName?: string;
  relationType?: "onetoone" | "onetomany" | string;
  value?: RelationValue | RelationValue[] | string | null;
  getOptions: () => Promise<any[]>;
  loadMoreOptions: () => Promise<any[]>;
  searchOptions: (search: string) => Promise<any[]>;
  totalOptionsLength: number;
  onChange?: (event: TypeChangeEvent<any>) => void;
}

/**
 * oziko's RelationInput calls `.map` on the value it receives. Before the async
 * relation labels resolve (the first drawer open, and again during the outside-click
 * close transition) that value is still a non-array — a single related document for
 * onetoone, or a bare id/undefined — which throws "map is not a function" deep inside
 * oziko. Coercing it to an array here, at the exact point oziko consumes it,
 * guarantees the crash can never happen regardless of open/close timing.
 */
const RelationFieldInput: React.FC<RelationFieldInputProps> = ({
  fieldKey,
  title,
  description,
  className,
  popupClassName,
  relationType,
  value,
  getOptions,
  loadMoreOptions,
  searchOptions,
  totalOptionsLength,
  onChange
}) => {
  const safeValue = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];
    return [value];
  }, [value]);

  const handleChange = useCallback(
    (next: any) => {
      onChange?.({key: fieldKey, value: next});
    },
    [onChange, fieldKey]
  );

  return (
    <RelationInput
      value={safeValue as any}
      onChange={handleChange}
      label={title}
      description={description}
      getOptions={getOptions}
      loadMoreOptions={loadMoreOptions}
      searchOptions={searchOptions}
      totalOptionsLength={totalOptionsLength}
      multiple={relationType === "onetomany"}
      selectProps={{popupClassName: popupClassName || ""}}
      className={className}
    />
  );
};

export default RelationFieldInput;
