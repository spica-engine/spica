/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { Button, Drawer, FlexElement, Icon, StringInput, TextAreaInput } from "oziko-ui-kit";
import { useEffect, useMemo, useState } from "react";
import styles from "./Policy.module.scss";
import type { PolicyItem } from "./Policy";
import Resource from "./Resource";
import type { DisplayedStatement } from "./policyStatements";
import type { PolicyCatalog } from "./policyCatalog";
import { groupStatements, flattenStatements, validateStatements } from "./policyStatements";

export type PolicyUpsertInput = {
  name: string;
  description: string;
  statement?: PolicyItem["statement"];
  system?: boolean;
};

type PolicyDrawerProps = {
  isOpen: boolean;
  selectedPolicy: PolicyItem | null;
  catalog: PolicyCatalog;
  onSave: (input: PolicyUpsertInput) => void;
  onCancel: () => void;
};

const PolicyDrawer = ({
  isOpen,
  selectedPolicy,
  catalog,
  onSave,
  onCancel,
}: PolicyDrawerProps) => {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [displayedStatements, setDisplayedStatements] = useState<DisplayedStatement[]>([]);

  const mode = useMemo(() => (selectedPolicy ? "edit" : "create"), [selectedPolicy]);

  useEffect(() => {
    if (!isOpen) return;

    if (selectedPolicy) {
      setName(selectedPolicy.name ?? "");
      setDescription(selectedPolicy.description ?? "");
      
      // Convert flat statements to grouped UI format
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

  // Validation
  const isNameValid = name.trim().length > 0;
  const areStatementsValid = validateStatements(displayedStatements, catalog);
  const isValid = isNameValid && areStatementsValid;

  const handleSave = () => {
    if (!isValid) return;

    // Flatten statements back to API format
    const flatStatements = flattenStatements(displayedStatements);

    onSave({
      name: name.trim(),
      description,
      statement: flatStatements,
    });
  };

  return (
    <Drawer
      placement="right"
      size={600}
      isOpen={isOpen}
      onClose={onCancel}
      contentClassName={styles.drawerContainer}
      showCloseButton={false}
    >
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        gap={10}
        className={styles.drawerContent}
      >
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
          catalog={catalog}
        />

        <FlexElement
          dimensionX="fill"
          alignment="rightCenter"
          direction="horizontal"
          gap={10}
        >
          <Button
            variant="solid"
            color="default"
            disabled={!isValid}
            onClick={handleSave}
          >
            <Icon name="plus" />
            Save
          </Button>

          <Button variant="solid" color="danger" onClick={onCancel}>
            <Icon name="close" />
            Cancel
          </Button>
        </FlexElement>
      </FlexElement>
    </Drawer>
  );
};

export default PolicyDrawer;
