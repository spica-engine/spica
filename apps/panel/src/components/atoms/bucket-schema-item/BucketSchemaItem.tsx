import type {TypeInputType} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {Button, FlexElement, FluidContainer, Icon, Text} from "oziko-ui-kit";
import React, {type FC, memo, useState} from "react";
import styles from "./BucketSchemaItem.module.scss";
import type {TypeFluidContainer} from "../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/fluid-container/FluidContainer";
import "oziko-ui-kit/dist/index.css";

type TypeBucketSchemaItem = {
  label?: string;
  type?: TypeInputType | "id";
  addIcon?: boolean;
  addOnClick?: () => void;
  editIcon?: boolean;
  editOnClick?: () => void;
  deleteIcon?: boolean;
  deleteOnClick?: () => void;
  itemDepth?: number;
  options?: Record<string, any>;
  index: number;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, targetIndex: number) => void;
  onDragOver: (e: React.DragEvent) => void;
} & TypeFluidContainer;

const BucketSchemaItem: FC<TypeBucketSchemaItem> = ({
  label,
  type,
  addIcon = false,
  addOnClick,
  editIcon = true,
  editOnClick,
  deleteIcon = true,
  deleteOnClick,
  itemDepth,
  index,
  onDragStart,
  onDrop,
  onDragOver,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleButtonClick = (e: React.MouseEvent, action: "add" | "edit" | "delete") => {
    e.stopPropagation();
    switch (action) {
      case "add":
        addOnClick?.();
        break;
      case "edit":
        editOnClick?.();
        break;
      case "delete":
        deleteOnClick?.();
        break;
    }
  };
  const renderPrefixIcon = () => {
    if (!itemDepth) return null;

    const showEllipsis = itemDepth > 2;

    return (
      <>
        {showEllipsis && <Text style={{marginLeft: "2px"}}>...</Text>}
        {Array(showEllipsis ? 1 : itemDepth)
          .fill("")
          .map((_, index) => (
            <Icon key={`chevron-${index}`} name="chevronRight" />
          ))}
      </>
    );
  };

  return (
    <FluidContainer
      mode="fill"
      dimensionX={"fill"}
      gap={20}
      draggable
      onDragStart={e => onDragStart(e, index)}
      onDrop={e => onDrop(e, index)}
      onDragOver={onDragOver}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      prefix={{
        className: styles.prefixDiv,
        children: (
          <>
            {itemDepth === 0 && isHovered && (
              <Button
                variant="icon"
                color="default"
                className={`${styles.buttons} ${styles.dragDropButton}`}
              >
                <Icon name="dragHorizontalVariant" />
              </Button>
            )}

            <FlexElement className={styles.prefixIconDiv}>{renderPrefixIcon()}</FlexElement>
            <Text className={styles.label}>{label}</Text>
          </>
        )
      }}
      root={{
        alignment: "leftCenter",
        children: <Text>{type}</Text>
      }}
      suffix={{
        children: (
          <FluidContainer
            className={styles.suffixIcons}
            gap={10}
            prefix={{
              children: addIcon ? (
                <Button
                  variant="icon"
                  className={styles.buttons}
                  onClick={e => handleButtonClick(e, "add")}
                >
                  <Icon name="plus" />
                </Button>
              ) : null
            }}
            root={{
              children: editIcon ? (
                <Button
                  variant="icon"
                  className={styles.buttons}
                  onClick={e => handleButtonClick(e, "edit")}
                >
                  <Icon name="pencil" />
                </Button>
              ) : null
            }}
            suffix={{
              children: deleteIcon ? (
                <Button
                  variant="icon"
                  color="danger"
                  className={styles.buttons}
                  onClick={e => handleButtonClick(e, "delete")}
                >
                  <Icon name="delete" />
                </Button>
              ) : null
            }}
          />
        )
      }}
      {...props}
      className={`${styles.bucketSchemaItem} ${props.className}`}
    />
  );
};

export default memo(BucketSchemaItem);
