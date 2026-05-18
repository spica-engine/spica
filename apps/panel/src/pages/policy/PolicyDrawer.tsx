/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { Button, Drawer, FlexElement, FluidContainer, Icon, StringInput, Text, TextAreaInput } from "oziko-ui-kit";
import { useEffect, useState } from "react";
import styles from "./Policy.module.scss";
import type { PolicyItem } from "./Policy";
import Resource from "./Resource";
import type { DisplayedStatement } from "./policyStatements";
import { flattenStatements, groupStatements, validateStatements } from "./policyStatements";
import { usePolicyImportExport } from "./hook/usePolicyImportExport";
import type { ModuleStatement } from "./hook/useStatement";

export type PolicyUpsertInput = {
  name: string;
  description: string;
  statement?: PolicyItem["statement"];
  system?: boolean;
};

type PolicyDrawerProps = {
  isOpen: boolean;
  selectedPolicy: PolicyItem | null;
  modules: ModuleStatement[];
  moduleData?: Record<string, unknown>;
  onSave: (input: PolicyUpsertInput) => void;
  onCancel: () => void;
};

const PolicyDrawer = ({
  isOpen,
  selectedPolicy,
  modules,
  moduleData,
  onSave,
  onCancel,
}: PolicyDrawerProps) => {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [displayedStatements, setDisplayedStatements] = useState<DisplayedStatement[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isEditMode = selectedPolicy !== null && selectedPolicy._id !== "";

  useEffect(() => {
    if (!isOpen) return;
    setSaveError(null);

    if (selectedPolicy) {
      setName(selectedPolicy.name ?? "");
      setDescription(selectedPolicy.description ?? "");

      if (selectedPolicy.statement && selectedPolicy.statement.length > 0) {
        setDisplayedStatements(groupStatements(selectedPolicy.statement));
      } else {
        setDisplayedStatements([]);
      }
    } else {
      setName("");
      setDescription("");
      setDisplayedStatements([]);
    }
  }, [isOpen, selectedPolicy]);

  const isNameValid = name.trim().length > 0;
  const areStatementsValid = validateStatements(displayedStatements, modules);
  const isValid = isNameValid && areStatementsValid;

  const handleSave = () => {
    if (!isValid) return;
    setSaveError(null);

    const flatStatements = flattenStatements(displayedStatements);

    onSave({
      name: name.trim(),
      description,
      statement: flatStatements,
    });
  };

  const { fileInputRef, handleExport, handleImport, handleFileChange } = usePolicyImportExport({
    name,
    description,
    displayedStatements,
    selectedPolicy,
    onImport: ({ name: importedName, description: importedDescription, statements }) => {
      if (typeof importedName === "string") {
        setName(importedName);
      }
      if (typeof importedDescription === "string") {
        setDescription(importedDescription);
      }
      setDisplayedStatements(statements);
    },
  });

  return (
    <Drawer
      placement="right"
      size={600}
      isOpen={isOpen}
      onClose={onCancel}
      showCloseButton={false}
      scrollableContentClassName={styles.policyDrawerScrollable}
    >
      <div className={styles.policyDrawerContent}>
        {/* Header */}
        <div className={styles.policyDrawerHeader}>
          <div className={styles.policyDrawerHeaderInfo}>
            <div className={styles.policyDrawerTitle}>
              {isEditMode ? "Edit Policy" : "New Policy"}
            </div>
            <div className={styles.policyDrawerSubtitle}>
              {isEditMode ? `${selectedPolicy?.name} · edit policy` : "Create a new policy"}
            </div>
          </div>
          <button className={styles.policyDrawerClose} onClick={onCancel}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className={styles.policyDrawerBody}>
          <StringInput label="Name" value={name} onChange={setName} />

          <TextAreaInput
            title="Description"
            icon="notes"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <Resource
            value={displayedStatements}
            onChange={setDisplayedStatements}
            modules={modules}
            moduleData={moduleData}
            onExport={handleExport}
            onImport={handleImport}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>

        {/* Footer */}
        <FlexElement className={styles.policyDrawerFooter}>
          {saveError && (
            <Text className={styles.policyDrawerErrorText} variant="danger">
              {saveError}
            </Text>
          )}
          <FlexElement gap={8} className={styles.policyDrawerButtons}>
            <Button onClick={onCancel} variant="outlined" color="default">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              <FluidContainer
                prefix={{ children: <Icon name="save" /> }}
                root={{ children: isEditMode ? "Save changes" : "Save and close" }}
              />
            </Button>
          </FlexElement>
        </FlexElement>
      </div>
    </Drawer>
  );
};

export default PolicyDrawer;
