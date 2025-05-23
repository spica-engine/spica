import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Text,
  type TypeFluidContainer,
  type TypeInputType
} from "oziko-ui-kit";
import React, {type FC, memo} from "react";
import styles from "./BucketSchemaItem.module.scss";

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
  ...props
}) => {
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
      prefix={{
        className: styles.prefixDiv,
        children: (
          <>
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
                <Button variant="icon" className={styles.buttons} onClick={addOnClick}>
                  <Icon name="plus"></Icon>
                </Button>
              ) : null
            }}
            root={{
              children: editIcon ? (
                <Button variant="icon" className={styles.buttons} onClick={editOnClick}>
                  <Icon name="pencil"></Icon>
                </Button>
              ) : null
            }}
            suffix={{
              children: deleteIcon ? (
                <Button
                  variant="icon"
                  color="danger"
                  className={styles.buttons}
                  onClick={deleteOnClick}
                >
                  <Icon name="delete"></Icon>
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
