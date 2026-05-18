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

export interface BucketEntryDrawerProps {
  bucket: BucketType;
  isOpen: boolean;
  onClose: () => void;
  service?: BucketEntryService;
  onEntryCreated?: (entry: any) => void;
  /** When provided, the drawer opens in edit mode with these values pre-filled */
  entry?: Record<string, any> | null;
}

const BucketEntryDrawer = ({
  bucket,
  isOpen,
  onClose,
  service: injectedService,
  onEntryCreated,
  entry,
}: BucketEntryDrawerProps) => {
  const isEditMode = entry != null;

  const [createBucketEntry, {isLoading: isCreating, error: createError}] = useCreateBucketEntryMutation();
  const [updateBucketEntry, {isLoading: isUpdating, error: updateError}] = useUpdateBucketEntryMutation();

  const formContainerRef = useRef<HTMLDivElement>(null);

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

  const formattedProperties = useValueProperties(bucket);

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

  // Pre-fill form when opening in edit mode
  useEffect(() => {
    if (isOpen && isEditMode && entry) {
      const {_id, ...values} = entry;
      formActions.setValue(values);
    }
    if (!isOpen) {
      submitActions.clearError();
      if (!isEditMode) formActions.reset();
    }
  }, [isOpen]);

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
      await updateBucketEntry({
        bucketId: bucket._id,
        entryId: entry._id,
        data: formState.value
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
      size={380}
      scrollableContentClassName={styles.scrollableWrapper}
    >
      <div className={styles.drawerContent}>
        <div className={styles.drawerHeader}>
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
          <BucketEntryForm
            inputRepresentation={inputRepresentation}
            errors={formState.errors}
            className={styles.formContent}
          />
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
