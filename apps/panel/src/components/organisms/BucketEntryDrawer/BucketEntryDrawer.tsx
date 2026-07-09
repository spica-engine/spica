import {
  useInputRepresenter,
  Drawer
} from "oziko-ui-kit";
import {useCallback, useEffect, useMemo, useRef} from "react";
import styles from "./BucketEntryDrawer.module.scss";
import type {BucketType} from "src/store/api/bucketApi";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {FIELD_REGISTRY} from "../../../domain/fields";
import {BucketEntryService, type IBucketApiClient} from "./services";
import {useBucketEntryForm, useBucketEntrySubmit, useValueProperties} from "./hooks";
import {BucketEntryForm} from "../../molecules/BucketEntryForm";
import {BucketEntryActions} from "../../molecules/BucketEntryActions";
import {useCreateBucketEntryMutation, useUpdateBucketEntryMutation} from "../../../store/api/bucketApi";
import StorageFieldInput from "../../atoms/storage-field-input/StorageFieldInput";
import JsonFieldInput from "../../molecules/json-field-input/JsonFieldInput";
import RelationFieldInput from "../../atoms/relation-field-input/RelationFieldInput";
import ArrayFieldInput from "../../atoms/array-field-input/ArrayFieldInput";
import ObjectFieldInput from "../../atoms/object-field-input/ObjectFieldInput";
import ErrorBoundary from "../../atoms/error-boundary/ErrorBoundary";

// oziko <Drawer size> is a raw px number with no design token; 1.25× the previous 380px baseline.
const DRAWER_WIDTH_PX = 475;

export interface BucketEntryDrawerProps {
  bucket: BucketType;
  isOpen: boolean;
  onClose: () => void;
  service?: BucketEntryService;
  onEntryCreated?: (entry: any) => void;
  /** When provided, the drawer opens in edit mode with these values pre-filled */
  entry?: Record<string, any> | null;
  /** Present when the user arrived here by following a relation from another document. */
  onBack?: () => void;
}

const BucketEntryDrawer = ({
  bucket,
  isOpen,
  onClose,
  service: injectedService,
  onEntryCreated,
  entry,
  onBack,
}: BucketEntryDrawerProps) => {
  const isEditMode = entry != null;

  const [createBucketEntry, {isLoading: isCreating, error: createError}] = useCreateBucketEntryMutation();
  const [updateBucketEntry, {isLoading: isUpdating, error: updateError}] = useUpdateBucketEntryMutation();

  const formContainerRef = useRef<HTMLDivElement>(null);
  // Guards a single re-apply of entry values after async relation labels load
  const labelReadyReappliedRef = useRef(false);

  const apiClient: IBucketApiClient = useMemo(
    () => ({
      createEntry: async (bucketId: string, data: Record<string, any>) => {
        const result = await createBucketEntry({bucketId, data}).unwrap();
        return result;
      }
    }),
    [createBucketEntry]
  );

  const service = useMemo(
    () => injectedService || new BucketEntryService(FIELD_REGISTRY, apiClient),
    [injectedService, apiClient]
  );

  const formattedProperties = useValueProperties(bucket, isEditMode ? entry : null);

  const [formState, formActions] = useBucketEntryForm({
    properties: formattedProperties,
    requiredFields: bucket.required || [],
    service
  });

  const [submitState, submitActions] = useBucketEntrySubmit({
    service,
    onSuccess: () => {
      if (!isEditMode) {
        onClose();
        formActions.reset();
        onEntryCreated?.(true);
      }
    }
  });

  const apiError = isEditMode ? updateError : createError;
  const apiErrorMessage = useMemo(() => {
    if (!apiError) return null;
    if ('status' in apiError) {
      return typeof apiError.data === 'string'
        ? apiError.data
        : (apiError.data as any)?.message || 'Failed to save entry';
    }
    return (apiError as any).message || 'Failed to save entry';
  }, [apiError]);

  // Pre-fill form when opening in edit mode. Keyed on the document id as well as
  // isOpen so following a relation to another document (the drawer stays mounted
  // and open) re-fills the form with the new document's values instead of the old.
  useEffect(() => {
    if (isOpen && isEditMode && entry) {
      labelReadyReappliedRef.current = false; // reset guard for new edit session
      const {_id, ...values} = entry;
      formActions.setValue(values);
    }
    if (!isOpen) {
      submitActions.clearError();
      if (!isEditMode) formActions.reset();
    }
  }, [isOpen, entry?._id]);

  // useInputRepresenter only re-calls getDisplayValue when `value` changes, not when
  // `properties` change.  Once all relation states have finished loading their labels
  // (primaryKey + initialFormattedValues), re-apply the same entry values so the hook
  // re-processes them and the relation tags show the correct human-readable label.
  useEffect(() => {
    if (labelReadyReappliedRef.current || !isOpen || !isEditMode || !entry) return;

    const relationEntries = Object.entries(formattedProperties).filter(
      ([, p]) => (p as any)?.type === "relation"
    );
    if (relationEntries.length === 0) return;

    const allReady = relationEntries.every(([, p]) => (p as any)?.relationState?.stateInitialized === true);
    if (!allReady) return;

    labelReadyReappliedRef.current = true;
    const {_id, ...values} = entry;

    // Replace raw relation values (full documents or plain IDs) with the formatted
    // { label, value } objects stored in initialFormattedValues so that RelationInput
    // can display human-readable labels instead of showing "undefined".
    const overrides: Record<string, any> = {};
    for (const [key, p] of relationEntries) {
      const formatted = (p as any).relationState?.initialFormattedValues;
      if (formatted === undefined) continue;

      // onetomany feeds oziko a `.map`-ed value, so it must always be an array;
      // onetoone stays a single { value, label } object.
      const isOneToMany = (p as any)?.relationType === "onetomany";
      overrides[key] = isOneToMany
        ? Array.isArray(formatted)
          ? formatted
          : [formatted]
        : Array.isArray(formatted)
          ? formatted[0]
          : formatted;
    }

    formActions.setValue({...values, ...overrides});
  }, [formattedProperties, isOpen, isEditMode, entry]);

  const normalizedValue =
    Object.keys(formState.value).length === 0 && formState.value.constructor === Object
      ? ""
      : formState.value;

  const inputRepresentation = useInputRepresenter({
    properties: formattedProperties,
    onChange: formActions.setValue,
    value: normalizedValue,
    containerClassName: styles.inputFieldContainer,
    error: formState.errors as TypeInputRepresenterError,
    typeOverrides: {
      storage: (props) => <StorageFieldInput {...props} fieldKey={props.key} />,
      json: (props) => <JsonFieldInput {...props} fieldKey={props.key} />,
      // oziko's default relation/array renderers `.map` the raw value; our wrappers
      // coerce it to an array first so the outside-click close on the first open,
      // when the value is still a non-array, can't throw "map is not a function".
      // useInputRepresenter forwards only a fixed prop whitelist (no bucketId), so
      // the related bucket is passed in explicitly from the formatted property to
      // let RelationFieldInput link each selected value to its target document.
      relation: (props) => (
        <RelationFieldInput
          {...props}
          fieldKey={props.key}
          bucketId={(formattedProperties as any)[props.key]?.bucketId}
        />
      ),
      array: (props) => <ArrayFieldInput {...props} fieldKey={props.key} />,
      // oziko's built-in object renderer only descends one level and prints an object
      // leaf as `String(value)` → the literal "[object Object]". ObjectFieldInput recurses
      // through useInputRepresenter so every depth resolves to a real editor, and routes
      // free-form (schema-less) objects to a JSON editor instead of a dead leaf.
      object: (props) => <ObjectFieldInput {...props} fieldKey={props.key} />,
    },
  });

  const handleSubmit = useCallback(async () => {
    const isValid = formActions.validate();
    if (!isValid) {
      formActions.scrollToFirstError();
      formContainerRef.current?.scrollTo({top: 0, behavior: "smooth"});
      return;
    }

    if (isEditMode && entry?._id) {
      const prepared = service.prepareData(formState.value, formattedProperties, bucket.required || []);
      await updateBucketEntry({
        bucketId: bucket._id,
        entryId: entry._id,
        data: prepared
      }).unwrap().then(() => {
        onEntryCreated?.(true);
        onClose();
      }).catch(() => {});
    } else {
      await submitActions.submit(
        bucket._id,
        formState.value,
        formattedProperties,
        bucket.required || []
      );
    }
  }, [
    formActions,
    submitActions,
    bucket._id,
    bucket.required,
    formState.value,
    formattedProperties,
    isEditMode,
    entry,
    updateBucketEntry,
    onEntryCreated,
    onClose,
  ]);

  return (
    <Drawer
      placement="right"
      showCloseButton={false}
      isOpen={isOpen}
      onClose={onClose}
      size={DRAWER_WIDTH_PX}
      scrollableContentClassName={styles.scrollableWrapper}
    >
      <div className={styles.drawerContent}>
        <div className={styles.drawerHeader}>
          {onBack && (
            <button className={styles.drawerBack} onClick={onBack} title="Back to previous document">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
          <div className={styles.drawerHeaderInfo}>
            <div className={styles.drawerTitle}>{isEditMode ? "Edit Entry" : "New Entry"}</div>
            <div className={styles.drawerSubtitle}>
              {bucket.title}&nbsp;·&nbsp;{isEditMode ? "edit document" : "new document"}
            </div>
          </div>
          <button className={styles.drawerClose} onClick={onClose}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.drawerBody} ref={formContainerRef}>
          <ErrorBoundary onError={onClose} resetKeys={[isOpen, entry?._id]}>
            <BucketEntryForm
              inputRepresentation={inputRepresentation}
              errors={formState.errors}
              className={styles.formContent}
            />
          </ErrorBoundary>
        </div>

        <BucketEntryActions
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={isEditMode ? isUpdating : submitState.isLoading}
          error={submitState.error || apiErrorMessage}
          submitButtonText={isEditMode ? "Save changes" : "Save and close"}
        />
      </div>
    </Drawer>
  );
};

export default BucketEntryDrawer;
