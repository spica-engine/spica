/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { Button, Drawer, FlexElement, Icon, StringInput, TextAreaInput } from "oziko-ui-kit";
import { useEffect, useState } from "react";
import styles from "./Policy.module.scss";
import type { PolicyItem } from "./Policy";
import Resource from "./Resource";
import type { DisplayedStatement } from "./policyStatements";
import type { ModuleStatement } from "./hook/useStatement";
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

  useEffect(() => {
    if (!isOpen) return;

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
          modules={modules}
          moduleData={moduleData}
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
