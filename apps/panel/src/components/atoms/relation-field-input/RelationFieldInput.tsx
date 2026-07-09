import React, {useCallback, useMemo} from "react";
import {Icon, RelationInput} from "oziko-ui-kit";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import type {TypeChangeEvent} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import type {RelationStackEntry} from "../../organisms/BucketEntryDrawer/relationNavigation";
import styles from "./RelationFieldInput.module.scss";

type RelationValue = {value: string; label?: string};

interface RelationFieldInputProps {
  fieldKey: string;
  title: string;
  description?: string;
  className?: string;
  popupClassName?: string;
  relationType?: "onetoone" | "onetomany" | string;
  /** Target bucket the relation points at — used to build the navigation link. */
  bucketId?: string;
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
  bucketId,
  value,
  getOptions,
  loadMoreOptions,
  searchOptions,
  totalOptionsLength,
  onChange
}) => {
  const navigate = useNavigate();
  const {bucketId: currentBucketId = "", entryId: currentEntryId = ""} = useParams<{
    bucketId: string;
    entryId: string;
  }>();
  const location = useLocation();

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

  const navigateToDocument = useCallback(
    (documentId: string) => {
      if (!bucketId || !documentId) return;
      // Push the document we're leaving onto the stack so the drawer can offer a
      // Back button. The whole trail lives in history state, so it survives
      // browser back/forward and is reconstructed on a shared deep link.
      const previousStack = (location.state as {relationStack?: RelationStackEntry[]})?.relationStack ?? [];
      const nextStack: RelationStackEntry[] = currentEntryId
        ? [...previousStack, {bucketId: currentBucketId, entryId: currentEntryId}]
        : previousStack;
      navigate(`/bucket/${bucketId}/${documentId}`, {state: {relationStack: nextStack}});
    },
    [navigate, bucketId, currentBucketId, currentEntryId, location.state]
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
      {bucketId && linkedDocuments.length > 0 && (
        <div className={styles.links}>
          {linkedDocuments.map(doc => (
            <button
              key={doc.id}
              type="button"
              className={styles.linkChip}
              title={`Go to ${doc.label}`}
              onClick={() => navigateToDocument(doc.id)}
            >
              <span className={styles.linkLabel}>{doc.label}</span>
              <Icon name="external" size={12} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RelationFieldInput;
