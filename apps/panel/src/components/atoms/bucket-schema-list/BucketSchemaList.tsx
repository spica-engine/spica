import type {TypeInputType} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {FlexElement} from "oziko-ui-kit";
import React, {type FC, type JSX, memo, useState} from "react";
import styles from "./BucketSchemaList.module.scss";
import BucketSchemaItem from "../bucket-schema-item/BucketSchemaItem";
import type {TypeFlexElement} from "../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/flex-element/FlexElement";
import "oziko-ui-kit/dist/index.css";

export type TypeSchema = {
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
  const [items, setItems] = useState(Object.entries(schema || {}));
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => ({...prev, [key]: !prev[key]}));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("index", index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedIndex = Number(e.dataTransfer.getData("index"));

    if (draggedIndex === targetIndex) return;

    const newItems = [...items];
    const draggedItem = newItems.splice(draggedIndex, 1)[0];
    newItems.splice(targetIndex, 0, draggedItem);

    setItems(newItems);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const renderSchemaItems = (schema: Record<string, TypeSchema>, depth: number): JSX.Element[] => {
    return Object.entries(schema).map(([key, value], index) => {
      const {type, title, properties, items, default: defaultValue, options} = value;
      const isObject = type === "object";
      const isArray = type === "array";
      const addIcon = isObject || isArray;
      const hasChildren = isObject || isArray;
      const expanded = expandedKeys[key] ?? false;

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
            index={index}
            onDragStart={e => handleDragStart(e, index)}
            onDrop={e => handleDrop(e, index)}
            onDragOver={handleDragOver}
            onClick={hasChildren ? () => toggleExpand(key) : undefined}
          />

          {expanded && (
            <>
              {isObject && properties && renderSchemaItems(properties, depth + 1)}
              {isArray && items && renderSchemaItems({Item: items}, depth + 1)}
            </>
          )}
        </>
      );
    });
  };

  return (
    <FlexElement
      direction="vertical"
      gap={10}
      {...props}
      dimensionX={"fill"}
      className={`${styles.container} ${props.className}`}
    >
      {renderSchemaItems(Object.fromEntries(items), itemDepth)}
    </FlexElement>
  );
};

export default memo(BucketSchemaList);
