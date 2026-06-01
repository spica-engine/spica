import {memo, useCallback, useEffect, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {Icon} from "oziko-ui-kit";
import type {IconName} from "oziko-ui-kit";
import styles from "./AddFieldModal.module.scss";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import BucketAddField from "../bucket-add-field/BucketAddField";
import {FieldKind} from "../../../domain/fields/types";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "src/store/api/bucketApi";

type AddFieldModalProps = {
  /** Render-prop trigger — used in "add" mode. Optional when `isOpen` is provided. */
  children?: (props: {onOpen: () => void; className?: string}) => ReactNode;
  onSaveAndClose: (values: FieldFormState, kind: FieldKind) => void | Promise<BucketType>;
  forbiddenFieldNames?: string[];
  containerClassName?: string;
  /** Controlled open state — used in "edit" mode where the trigger is external. */
  isOpen?: boolean;
  /** Called when the user closes the modal in controlled mode. */
  onClose?: () => void;
  /** Pre-select this field type when the modal opens (edit mode). */
  initialFieldKind?: FieldKind;
  /** Pre-fill the config form with these values (edit mode). */
  initialValues?: FieldFormState;
};

const AddFieldModal = ({
  children,
  onSaveAndClose,
  forbiddenFieldNames = [],
  containerClassName,
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  initialFieldKind,
  initialValues
}: AddFieldModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FieldKind | null>(null);

  const isControlled = controlledIsOpen !== undefined;
  const actualIsOpen = isControlled ? controlledIsOpen : internalOpen;

  // Sync selectedType when controlled modal opens with a pre-selected type
  useEffect(() => {
    if (actualIsOpen) {
      setSelectedType(initialFieldKind ?? FieldKind.String);
    }
  }, [actualIsOpen, initialFieldKind]);

  const handleOpen = useCallback(() => {
    setInternalOpen(true);
    setSelectedType(initialFieldKind ?? FieldKind.String);
  }, [initialFieldKind]);

  const handleClose = useCallback(() => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalOpen(false);
    }
    setSelectedType(null);
  }, [isControlled, controlledOnClose]);

  const handleTypeSelect = useCallback((kind: FieldKind) => {
    setSelectedType(kind);
  }, []);

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState) => {
      if (!selectedType) return;
      try {
        const result = await onSaveAndClose(values, selectedType);
        handleClose();
        return result;
      } catch {
        // keep modal open on error — BucketAddField shows errors internally
      }
    },
    [selectedType, onSaveAndClose, handleClose]
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  return (
    <>
      {children && (
        <div className={containerClassName}>
          {children({onOpen: handleOpen})}
        </div>
      )}
      {actualIsOpen &&
        createPortal(
          <div className={styles.overlay} onClick={handleOverlayClick}>
            <div className={styles.modalWrap}>
              {/* ═══ LEFT: Type Panel ═══ */}
              <div className={styles.typePanel}>
                <div className={styles.typePanelHead}>Field Type</div>
                <div className={styles.typeList}>
                  {Object.values(FIELD_REGISTRY).map(field => (
                    <div
                      key={field.kind}
                      className={`${styles.typeItem} ${selectedType === field.kind ? styles.active : ""}`}
                      onClick={() => handleTypeSelect(field.kind)}
                    >
                      <span className={styles.typeIcon}>
                        <Icon name={field.display.icon as IconName} size={14} />
                      </span>
                      {field.display.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* ═══ RIGHT: Config Panel ═══ */}
              <div className={styles.configPanel}>
                {selectedType ? (
                  <div className={styles.configPanelContent}>
                    <BucketAddField
                      onClose={handleClose}
                      onSaveAndClose={handleSaveAndClose}
                      fieldType={selectedType}
                      forbiddenFieldNames={forbiddenFieldNames}
                      popupType="add-field"
                      initialValues={selectedType === initialFieldKind ? initialValues : undefined}
                    />
                  </div>
                ) : (
                  <div className={styles.placeholder}>
                    <svg
                      width="40"
                      height="40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"
                      />
                    </svg>
                    <p>Select a field type from the left panel to configure it.</p>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default memo(AddFieldModal);
