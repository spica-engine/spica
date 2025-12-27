/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, FluidContainer, Icon, Popover, Text } from "oziko-ui-kit";
import RelationPicker from "./RelationPicker";
import type { RelationSelected } from "./types";
import { extractRelationId, isRelationSelected } from "./types";
import styles from "./RelationMinimized.module.scss";

export type RelationMinimizedProps = {
  bucketId: string;
  value?: RelationSelected | string | null;
  onChange: (next: RelationSelected | null) => void;
  onCancel?: () => void;
  resetKey?: string | number;
  placeholder?: string;
  className?: string;
  renderLabel?: (value: RelationSelected | string | null) => ReactNode;
  emptyLabel?: string;
  resolveLabel?: (id: string) => string | null;
};

const RelationMinimized: React.FC<RelationMinimizedProps> = ({
  bucketId,
  value,
  onChange,
  onCancel,
  resetKey,
  placeholder = "Select...",
  className,
  renderLabel,
  emptyLabel,
  resolveLabel,
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  useEffect(() => {
    setIsPopoverOpen(false);
  }, [resetKey]);

  const handleOpen = useCallback(() => {
    setIsPopoverOpen(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsPopoverOpen(false);
    onCancel?.();
  }, [onCancel]);

  const handleSelect = useCallback(
    (selection: any) => {
      let normalizedValue: RelationSelected;
      
      if (typeof selection === "string") {
        normalizedValue = {
          kind: "id",
          id: selection,
        };
      } else if (selection && typeof selection === "object" && selection.id) {
        normalizedValue = {
          kind: "id",
          id: selection.id,
          label: selection.label,
        };
      } else {
        return;
      }
      
      onChange(normalizedValue);
      setIsPopoverOpen(false);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  const displayLabel = (() => {
    if (renderLabel) {
      return renderLabel(value ?? null);
    }

    const id = extractRelationId(value);
    
    if (!id || id.trim() === "") {
      const label = emptyLabel || placeholder;
      return <Text size="medium" className={styles.placeholder}>{label}</Text>;
    }

    let label: string | null = null;

    if (isRelationSelected(value) && value.label) {
      label = value.label;
    } else if (resolveLabel) {
      label = resolveLabel(id);
    }

    const displayText = label || id;
    return <Text size="medium">{displayText}</Text>;
  })();

  const currentValueId = extractRelationId(value);

  return (
    <Popover
      content={
        <RelationPicker
          bucketId={bucketId}
          onSelect={handleSelect}
          onCancel={handleCancel}
          currentValue={currentValueId}
        />
      }

      open={isPopoverOpen}
      contentProps={{
        className: styles.popoverContent,
      }}
      childrenProps={{
        dimensionX: "fill",
      }}
      containerProps={{
        dimensionX: "fill",
      }}
      onClose={handleCancel}
    >
      <FluidContainer
        className={`${styles.trigger} ${className || ""}`}
        dimensionY={32}
        dimensionX="fill"
        mode="fill"
        prefix={{
          children: <Icon name="bucket" size={16} />,
        }}
        root={{
          children: displayLabel,
          alignment: "leftCenter",
          className: styles.rootLabel,
        }}
        suffix={
          value
            ? {
                children: (
                  <Button variant="icon" onClick={handleClear} className={styles.clearButton}>
                    <Icon name="close" size={14} />
                  </Button>
                ),
              }
            : undefined
        }
        onClick={handleOpen}
      />
    </Popover>
  );
};

export default RelationMinimized;

