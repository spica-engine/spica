import {
  Button,
  FluidContainer,
  Icon,
  useInputRepresenter,
  Drawer
} from "oziko-ui-kit";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import styles from "./BucketEntryDrawer.module.scss";
import type {BucketType} from "src/services/bucketService";
import useLocalStorage from "../../../hooks/useLocalStorage";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {FIELD_REGISTRY} from "../../../domain/fields";
import {BucketEntryService, type IBucketApiClient} from "./services";
import {useBucketEntryForm, useBucketEntrySubmit, useValueProperties} from "./hooks";
import {BucketEntryForm} from "../../molecules/BucketEntryForm";
import {BucketEntryActions} from "../../molecules/BucketEntryActions";
import {useCreateBucketEntryMutation} from "../../../store/api/bucketApi";

export interface BucketEntryDrawerProps {
  bucket: BucketType;
  service?: BucketEntryService;
  onEntryCreated?: (entry: any) => void;
  triggerButton?: React.ReactNode;
}

const BucketEntryDrawer = ({
  bucket,
  service: injectedService,
  onEntryCreated,
  triggerButton
}: BucketEntryDrawerProps) => {
  const [authToken] = useLocalStorage("token", "");
  const [createBucketEntry, {isLoading: isCreating, error: createError}] = useCreateBucketEntryMutation();

  const [isOpen, setIsOpen] = useState(false);
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

  const formattedProperties = useValueProperties(bucket, authToken);

  const [formState, formActions] = useBucketEntryForm({
    properties: formattedProperties,
    requiredFields: bucket.required || [],
    service
  });

  const [submitState, submitActions] = useBucketEntrySubmit({
    service,
    onSuccess: () => {
      setIsOpen(false);
      formActions.reset();
      onEntryCreated?.(true);
    }
  });

  const apiErrorMessage = useMemo(() => {
    if (!createError) return null;
    if ('status' in createError) {
      return typeof createError.data === 'string' 
        ? createError.data 
        : (createError.data as any)?.message || 'Failed to create entry';
    }
    return createError.message || 'Failed to create entry';
  }, [createError]);

  useEffect(() => {
    if (!isOpen) {
      formActions.reset();
      submitActions.clearError();
    }
  }, [isOpen, formActions, submitActions]);

  const normalizedValue =
    Object.keys(formState.value).length === 0 && formState.value.constructor === Object
      ? ""
      : formState.value;

  const inputRepresentation = useInputRepresenter({
    properties: formattedProperties,
    onChange: formActions.setValue,
    value: normalizedValue,
    containerClassName: styles.inputFieldContainer,
    error: formState.errors as TypeInputRepresenterError
  });

  const handleSubmit = useCallback(async () => {
    const isValid = formActions.validate();

    if (!isValid) {
      formActions.scrollToFirstError();
      formContainerRef.current?.scrollTo({top: 0, behavior: "smooth"});
      return;
    }

    const success = await submitActions.submit(
      bucket._id,
      formState.value,
      formattedProperties,
      bucket.required || []
    );

  }, [
    formActions,
    submitActions,
    bucket._id,
    bucket.required,
    formState.value,
    formattedProperties
  ]);

  const handleOpenDrawer = useCallback(() => setIsOpen(true), []);
  const handleCloseDrawer = useCallback(() => setIsOpen(false), []);

  return (
    <>
      {triggerButton || (
        <Button onClick={handleOpenDrawer}>
          <FluidContainer
            prefix={{children: <Icon name="plus" />}}
            root={{children: "New Entry"}}
          />
        </Button>
      )}
      <Drawer
        placement="right"
        showCloseButton={false}
        isOpen={isOpen}
        onClose={handleCloseDrawer}
        size={600}
        className={styles.drawer}
      >
        <div className={styles.drawerContent}>
          <div className={styles.formContainer} ref={formContainerRef}>
            <BucketEntryForm
              inputRepresentation={inputRepresentation}
              errors={formState.errors}
              className={styles.formContent}
            />
            <BucketEntryActions
              onSubmit={handleSubmit}
              onCancel={handleCloseDrawer}
              isLoading={submitState.isLoading}
              error={submitState.error || apiErrorMessage}
            />
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default BucketEntryDrawer;

