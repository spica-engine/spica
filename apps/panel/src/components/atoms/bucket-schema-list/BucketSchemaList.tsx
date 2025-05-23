import {FlexElement, type TypeFlexElement, type TypeInputType} from "oziko-ui-kit";
import React, {type FC, type JSX, memo} from "react";
import styles from "./BucketSchemaList.module.scss";
import BucketSchemaItem from "../bucket-schema-item/BucketSchemaItem";

type TypeSchema = {
  type: TypeInputType;
  title: string;
  properties?: Record<string, TypeSchema>;
  description?: string;
  minimum?: number;
  maximum?: number;
  items?: TypeSchema;
  default?: any;
  options?: Record<string, any>;
};

type TypeBucketSchemaList = {
  schema?: Record<string, TypeSchema>;
  itemDepth?: number;
} & TypeFlexElement;

const BucketSchemaList: FC<TypeBucketSchemaList> = ({schema, itemDepth = 0, ...props}) => {
  if (!schema) return null;

  const renderSchemaItems = (schema: Record<string, TypeSchema>, depth: number): JSX.Element[] => {
    return Object.entries(schema).map(([key, value]) => {
      const {type, title, properties, items, default: defaultValue, options} = value;
      const isObject = type === "object";
      const isArray = type === "array";
      const addIcon = isObject || isArray;

      return (
        <>
          <BucketSchemaItem
            key={key}
            label={title}
            type={type}
            itemDepth={depth}
            defaultValue={defaultValue}
            options={options}
            addIcon={addIcon}
          />

          {isObject && properties && renderSchemaItems(properties, depth + 1)}

          {isArray && items && renderSchemaItems({Item: items}, depth + 1)}
        </>
      );
    });
  };

  return (
    <FlexElement
      direction="vertical"
      gap={10}
      {...props}
      className={`${styles.container} ${props.className}`}
    >
      {renderSchemaItems(schema, itemDepth)}
    </FlexElement>
  );
};

export default memo(BucketSchemaList);
