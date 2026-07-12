import React, {useCallback, useMemo} from "react";
import {Icon, RelationInput} from "oziko-ui-kit";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import styles from "./RelationFieldInput.module.scss";

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
  /**
   * Navigate to a selected related document. Routing is the caller's concern —
   * this atom stays router-free (see .claude/instructions/atomic-design.md); when
   * omitted, the "open" chips are not rendered.
   */
  onNavigate?: (documentId: string) => void;
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
  onChange,
  onNavigate
}) => {
  const safeValue = useMemo(() => {
    if (Array.isArray(value)) return value;
    if (value == null || value === "") return [];
    return [value];
  }, [value]);

  // The selected related documents, normalized to { id, label } so each can be
  // rendered as a link into the target bucket's detail view.
  const linkedDocuments = useMemo(() => {
    return safeValue
      .map(item => {
        if (item && typeof item === "object") {
          const id = (item as RelationValue).value;
          return id ? {id, label: (item as RelationValue).label || id} : null;
        }
        if (typeof item === "string" && item) return {id: item, label: item};
        return null;
      })
      .filter((doc): doc is {id: string; label: string} => doc !== null);
  }, [safeValue]);

  const handleChange = useCallback(
    (next: any) => {
      onChange?.({key: fieldKey, value: next});
    },
    [onChange, fieldKey]
  );

  return (
    <div className={styles.wrapper}>
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
      {onNavigate && linkedDocuments.length > 0 && (
        <div className={styles.links}>
          {linkedDocuments.map(doc => {
            // The label falls back to the id until the async relation resolution
            // lands; while it still reads as the bare id, show a spinner so a cold
            // deep link doesn't look like a broken hash.
            const resolving = doc.label === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                className={styles.linkChip}
                title={resolving ? `Loading ${doc.id}…` : `Go to ${doc.label}`}
                onClick={() => onNavigate(doc.id)}
              >
                <span className={styles.linkLabel}>{doc.label}</span>
                {resolving ? (
                  <span className={styles.spinner} aria-label="Resolving relation" />
                ) : (
                  <Icon name="external" size={12} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RelationFieldInput;
