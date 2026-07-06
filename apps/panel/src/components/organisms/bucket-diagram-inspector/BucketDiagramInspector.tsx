import React, {useCallback, memo, useMemo} from "react";
import {Button, Icon, type IconName} from "oziko-ui-kit";
import styles from "./BucketDiagramInspector.module.scss";
import DeleteBucket from "../../prefabs/delete-bucket/DeleteBucket";
import EditBucket from "../../prefabs/edit-bucket/EditBucket";
import DeleteField from "../../prefabs/delete-field/DeleteField";
import BucketFieldPopup from "../../molecules/bucket-field-popup/BucketFieldPopup";
import BucketFieldConfigurationPopup from "../../molecules/bucket-field-popup/BucketFieldConfigurationPopup";
import {
  useCreateBucketFieldMutation,
  type BucketType,
  type Property
} from "../../../store/api/bucketApi";
import type {FieldFormState, FieldKind} from "../../../domain/fields/types";
import {FIELD_REGISTRY, isFieldKind} from "../../../domain/fields/registry";
import type {Field} from "../../../pages/diagram/hooks/useBucketConverter";

export type BucketDiagramInspectorProps = {
  bucket: BucketType;
  fields: Field[];
  onClose: () => void;
};

interface EditFieldButtonProps {
  field: Field;
  bucket: BucketType;
  onSave: (fieldPath: string, values: FieldFormState, kind: FieldKind) => Promise<BucketType>;
  convertPropertyToFieldFormState: (fieldName: string, property: Property) => FieldFormState | null;
}

const FIELD_GLYPHS: Record<string, IconName> = {
  string: "fieldText",
  textarea: "fieldTextarea",
  richtext: "fieldRichtext",
  number: "fieldNumber",
  boolean: "fieldBoolean",
  date: "fieldDate",
  relation: "fieldRelation",
  location: "fieldLocation",
  array: "fieldArray",
  object: "fieldObject",
  storage: "fieldFile",
  multiselect: "fieldSelect",
  color: "fieldColor",
  unique: "key"
};

const glyphForField = (field: Field): IconName => {
  if (field.isUnique) return "key";
  if (field.isRelation) return "fieldRelation";
  return FIELD_GLYPHS[field.type] ?? "fields";
};

const navigateToNextProperty = (current: Property, part: string): Property | null => {
  if (current.type === "object" && current.properties) {
    return current.properties[part];
  }

  if (current.type === "array" && current.items?.properties) {
    return current.items.properties[part];
  }

  return null;
};

const getPropertiesContainer = (parent: Property): Record<string, Property> | null => {
  if (parent.type === "object" && parent.properties) {
    return parent.properties;
  }

  if (parent.type === "array" && parent.items?.properties) {
    return (parent.items as Property).properties;
  }

  return null;
};

const getPropertyByPath = (bucket: BucketType, path: string): Property | null => {
  const parts = path.split(".");
  let currentProperty: any = bucket.properties;

  for (let i = 0; i < parts.length; i++) {
    if (!currentProperty) return null;

    currentProperty =
      i === 0 ? currentProperty[parts[i]] : navigateToNextProperty(currentProperty, parts[i]);
  }

  return (currentProperty as Property) || null;
};

const getPropertyRequiredContainer = (parent: Property): Property => {
  return parent.type === "object" ? parent : (parent.items as Property);
};

const getLastPathPart = (path: string): string => {
  const parts = path.split(".");
  return parts[parts.length - 1];
};

const getFieldNestingLevel = (path?: string): number => {
  if (!path) return 0;
  return path.split(".").length - 1;
};

const setPropertiesContainer = (
  parent: Property,
  updatedProperties: Record<string, Property>
): void => {
  if (parent.type === "object") {
    parent.properties = updatedProperties;
  } else if (parent.type === "array" && parent.items) {
    (parent.items as Property).properties = updatedProperties;
  }
};

const EditFieldButton: React.FC<EditFieldButtonProps> = memo(
  ({field, bucket, onSave, convertPropertyToFieldFormState}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const fieldPath = field.path || field.name;
    const property = getPropertyByPath(bucket, fieldPath);

    if (!property) return null;

    const initialValues = convertPropertyToFieldFormState(field.name, property);
    if (!initialValues) return null;

    const fieldType = property.type as FieldKind;

    const getSiblingFieldNames = (): string[] => {
      const parts = fieldPath.split(".");

      if (parts.length === 1) {
        return Object.keys(bucket.properties || {}).filter(k => k !== field.name);
      }

      const parentPath = parts.slice(0, -1).join(".");
      const parentProperty = getPropertyByPath(bucket, parentPath);

      if (!parentProperty) return [];

      const properties = getPropertiesContainer(parentProperty);
      return properties ? Object.keys(properties).filter(k => k !== field.name) : [];
    };

    const forbiddenFieldNames = getSiblingFieldNames();

    const handleOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(true);
    };

    const handleClose = () => {
      setIsOpen(false);
    };

    const handleSaveAndClose = async (values: FieldFormState) => {
      await onSave(fieldPath, values, fieldType);
      handleClose();
    };

    return (
      <BucketFieldConfigurationPopup
        isOpen={isOpen}
        selectedType={fieldType}
        onClose={handleClose}
        onSaveAndClose={handleSaveAndClose}
        popupType="add-inner-field"
        forbiddenFieldNames={forbiddenFieldNames}
        initialValues={initialValues}
      >
        <Button variant="icon" className={styles.editButton} onClick={handleOpen}>
          <Icon name="pencil" />
        </Button>
      </BucketFieldConfigurationPopup>
    );
  }
);

EditFieldButton.displayName = "EditFieldButton";

const BucketDiagramInspector: React.FC<BucketDiagramInspectorProps> = ({bucket, fields, onClose}) => {
  const [createBucketField] = useCreateBucketFieldMutation();

  const getFieldTypeDisplay = useCallback((field: Field) => {
    if (field.isUnique) return "unique";
    if (field.isRelation) return "relation";
    return field.type;
  }, []);

  const getFieldDisplayName = useCallback((field: Field) => {
    const path = field.path || field.name;
    return getLastPathPart(path);
  }, []);

  const updatePropertyPreservingOrder = useCallback(
    (
      properties: Record<string, any>,
      oldKey: string,
      newKey: string,
      newValue: any
    ): Record<string, any> => {
      const orderedProperties: Record<string, any> = {};

      for (const key of Object.keys(properties)) {
        if (key === oldKey) {
          orderedProperties[newKey] = newValue;
        } else {
          orderedProperties[key] = properties[key];
        }
      }

      return orderedProperties;
    },
    []
  );

  const buildFieldValues = useCallback((fieldName: string, property: Property) => {
    const baseValues = {
      title: fieldName,
      description: property.description || ""
    };

    const typeSpecificValues: Record<string, any> = {
      relation: {
        relationType: property.relationType,
        bucketId: property.bucketId
      },
      multiselect: {
        multipleSelectionType: property.enum ? "enum" : "bucketId"
      },
      array: property.items ? {arrayType: (property.items as Property).type} : {},
      number: {
        minimum: property.minimum,
        maximum: property.maximum
      }
    };

    return {
      ...baseValues,
      ...(typeSpecificValues[property.type] || {})
    };
  }, []);

  const buildPresetValues = useCallback((property: Property) => {
    const preset = property.enum ? "enumerated" : property.pattern ? "pattern" : "default";

    return {
      preset,
      makeEnumerated: !!property.enum,
      definePattern: !!property.pattern,
      ...(property.enum && {enum: property.enum}),
      ...(property.pattern && {pattern: property.pattern}),
      ...(property.minLength !== undefined && {minLength: property.minLength}),
      ...(property.maxLength !== undefined && {maxLength: property.maxLength})
    };
  }, []);

  const addMultiselectFields = useCallback((fieldFormState: FieldFormState, property: Property) => {
    const multipleSelectionType = property.enum ? "enum" : "bucketId";
    fieldFormState.multipleSelectionTab = {multipleSelectionType};

    if (property.enum) {
      fieldFormState.fieldValues.enum = property.enum;
    }

    if (property.bucketId) {
      fieldFormState.fieldValues.bucketId = property.bucketId;
    }
  }, []);

  const convertPropertiesToInnerFields = useCallback(
    (properties: Record<string, any>) => {
      return Object.entries(properties)
        .map(([key, prop]) => {
          const innerFormState = convertPropertyToFieldFormState(key, prop as Property);
          return innerFormState ? {...innerFormState, id: key} : null;
        })
        .filter(Boolean) as (FieldFormState & {id: string})[];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const addInnerFields = useCallback(
    (fieldFormState: FieldFormState, property: Property) => {
      const propertiesContainer = getPropertiesContainer(property);
      if (propertiesContainer) {
        fieldFormState.innerFields = convertPropertiesToInnerFields(propertiesContainer);
      }
    },
    [convertPropertiesToInnerFields]
  );

  const convertPropertyToFieldFormState = useCallback(
    (fieldName: string, property: Property): FieldFormState | null => {
      if (!property || !isFieldKind(property.type)) {
        return null;
      }

      const fieldKind = property.type as FieldKind;
      const fieldDefinition = FIELD_REGISTRY[fieldKind];

      if (!fieldDefinition) {
        return null;
      }

      const fieldFormState: FieldFormState = {
        type: fieldKind,
        fieldValues: buildFieldValues(fieldName, property),
        configurationValues: {
          requiredField: bucket.required?.includes(fieldName) || false,
          primaryField: bucket.primary === fieldName,
          index: property.options?.index || false,
          uniqueValues: property.options?.unique || false,
          translate: property.options?.translate || false
        },
        presetValues: buildPresetValues(property),
        defaultValue: property.default
      };

      if (property.type === "multiselect") {
        addMultiselectFields(fieldFormState, property);
      }

      addInnerFields(fieldFormState, property);

      return fieldFormState;
    },
    [bucket, buildFieldValues, buildPresetValues, addMultiselectFields, addInnerFields]
  );

  const updateRequiredArray = useCallback(
    (requiredArray: string[], oldName: string, newName: string, isRequired: boolean): string[] => {
      let updated = [...requiredArray];

      if (oldName !== newName) {
        updated = updated.filter(r => r !== oldName);
      }

      if (isRequired && !updated.includes(newName)) {
        updated.push(newName);
      } else if (!isRequired) {
        updated = updated.filter(r => r !== newName);
      }

      return updated;
    },
    []
  );

  const updateTopLevelField = useCallback(
    (
      oldFieldName: string,
      newTitle: string,
      fieldProperty: Property,
      requiredField: boolean,
      primaryField: boolean
    ) => {
      const updatedProperties = updatePropertyPreservingOrder(
        bucket.properties,
        oldFieldName,
        newTitle,
        fieldProperty
      );

      const newRequired = updateRequiredArray(
        bucket.required || [],
        oldFieldName,
        newTitle,
        requiredField
      );

      let newPrimary = bucket.primary;
      if (primaryField) {
        newPrimary = newTitle;
      } else if (bucket.primary === oldFieldName) {
        newPrimary = undefined;
      }

      return {
        ...bucket,
        properties: updatedProperties,
        required: newRequired.length > 0 ? newRequired : undefined,
        primary: newPrimary
      };
    },
    [bucket, updatePropertyPreservingOrder, updateRequiredArray]
  );

  const navigateToParentProperty = useCallback(
    (properties: Record<string, Property>, pathParts: string[]): Property => {
      let currentProperty: Record<string, Property> | Property = properties;

      for (let i = 0; i < pathParts.length - 1; i++) {
        currentProperty =
          i === 0
            ? (currentProperty as Record<string, Property>)[pathParts[i]]
            : navigateToNextProperty(currentProperty as Property, pathParts[i])!;
      }

      return currentProperty as Property;
    },
    []
  );

  const updateNestedPropertyRequired = useCallback(
    (container: any, oldFieldName: string, newTitle: string, requiredField: boolean) => {
      const currentRequired = container.required || [];
      const updated = updateRequiredArray(currentRequired, oldFieldName, newTitle, requiredField);

      if (updated.length === 0) {
        delete container.required;
      } else {
        container.required = updated;
      }
    },
    [updateRequiredArray]
  );

  const updateNestedField = useCallback(
    (
      properties: Record<string, Property>,
      pathParts: string[],
      oldFieldName: string,
      newTitle: string,
      fieldProperty: Property,
      requiredField: boolean
    ) => {
      const parentProperty = navigateToParentProperty(properties, pathParts);
      const propertiesContainer = getPropertiesContainer(parentProperty);

      if (propertiesContainer) {
        const updatedProperties = updatePropertyPreservingOrder(
          propertiesContainer,
          oldFieldName,
          newTitle,
          fieldProperty
        );

        setPropertiesContainer(parentProperty, updatedProperties);

        const requiredContainer = getPropertyRequiredContainer(parentProperty);
        updateNestedPropertyRequired(requiredContainer, oldFieldName, newTitle, requiredField);
      }

      return {...bucket, properties};
    },
    [bucket, navigateToParentProperty, updatePropertyPreservingOrder, updateNestedPropertyRequired]
  );

  const extractFieldData = useCallback((values: FieldFormState, kind: FieldKind) => {
    const fieldProperty = FIELD_REGISTRY[kind]?.buildCreationFormApiProperty(values);
    const {requiredField, primaryField} = values.configurationValues;
    const {title} = values.fieldValues;
    return {fieldProperty: fieldProperty as Property, requiredField, primaryField, title};
  }, []);

  const validateBucketExists = useCallback(() => {
    if (!bucket) {
      throw new Error("No bucket available");
    }
  }, [bucket]);

  const saveBucketField = useCallback(
    async (modifiedBucket: BucketType, errorMessage: string): Promise<BucketType> => {
      const result = await createBucketField(modifiedBucket);
      if (!result.data) {
        throw new Error(errorMessage);
      }
      return result.data;
    },
    [createBucketField]
  );

  const handleEditFieldSave = useCallback(
    async (fieldPath: string, values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      validateBucketExists();

      const {fieldProperty, requiredField, primaryField, title} = extractFieldData(values, kind);
      const pathParts = fieldPath.split(".");
      const oldFieldName = getLastPathPart(fieldPath);

      const modifiedBucket =
        pathParts.length === 1
          ? updateTopLevelField(oldFieldName, title, fieldProperty, requiredField, primaryField)
          : updateNestedField(
              JSON.parse(JSON.stringify(bucket!.properties)),
              pathParts,
              oldFieldName,
              title,
              fieldProperty,
              requiredField
            );

      return saveBucketField(modifiedBucket, "Failed to update bucket field");
    },
    [
      bucket,
      extractFieldData,
      validateBucketExists,
      saveBucketField,
      updateTopLevelField,
      updateNestedField
    ]
  );

  const handleSaveAndClose = useCallback(
    async (values: FieldFormState, kind: FieldKind): Promise<BucketType> => {
      validateBucketExists();

      const {fieldProperty, requiredField, primaryField, title} = extractFieldData(values, kind);

      const modifiedBucket = {
        ...bucket!,
        properties: {
          ...bucket!.properties,
          [title]: fieldProperty
        },
        required: requiredField ? [...(bucket!.required || []), title] : bucket!.required,
        primary: primaryField ? title : bucket!.primary
      };

      return saveBucketField(modifiedBucket, "Failed to create bucket field");
    },
    [bucket, extractFieldData, validateBucketExists, saveBucketField]
  );

  const forbiddenFieldNames = useMemo(() => {
    return Object.keys(bucket.properties || {});
  }, [bucket]);

  return (
    <aside className={styles.bucketDiagramInspector}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Icon name={(bucket.icon || "bucket") as IconName} size="sm" />
          {bucket.title}
        </span>
        <div className={styles.actions}>
          <EditBucket bucket={bucket}>
            {({onOpen}) => (
              <Button variant="icon" className={styles.settingsButton} onClick={onOpen}>
                <Icon name="cog" />
              </Button>
            )}
          </EditBucket>
          <DeleteBucket bucket={bucket}>
            {({onOpen}) => (
              <Button variant="icon" className={styles.deleteButton} onClick={onOpen}>
                <Icon name="delete" />
              </Button>
            )}
          </DeleteBucket>
          <Button variant="icon" className={styles.closeButton} onClick={onClose}>
            <Icon name="close" />
          </Button>
        </div>
      </div>

      <span className={styles.bucketId}>{bucket._id}</span>

      <div className={styles.body}>
        <div className={styles.fields}>
          {fields.map(field => (
            <div
              key={field.id}
              className={styles.fieldRow}
              style={{paddingLeft: `calc(${getFieldNestingLevel(field.path)} * var(--padding-md))`}}
            >
              <span className={styles.fieldGlyph}>
                <Icon name={glyphForField(field)} size="sm" />
              </span>
              <span className={styles.fieldName}>{getFieldDisplayName(field)}</span>
              <span className={styles.fieldType}>{getFieldTypeDisplay(field)}</span>

              {field.name !== "_id" && (
                <span className={styles.fieldControls}>
                  <EditFieldButton
                    field={field}
                    bucket={bucket}
                    onSave={handleEditFieldSave}
                    convertPropertyToFieldFormState={convertPropertyToFieldFormState}
                  />
                  {bucket.primary !== field.name && (
                    <DeleteField field={field} bucket={bucket}>
                      {({onOpen}) => (
                        <Button variant="icon" className={styles.deleteButton} onClick={onOpen}>
                          <Icon name="delete" />
                        </Button>
                      )}
                    </DeleteField>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        <BucketFieldPopup
          onSaveAndClose={handleSaveAndClose}
          forbiddenFieldNames={forbiddenFieldNames}
          containerClassName={styles.newFieldButtonContainer}
        >
          {({onOpen}) => (
            <Button variant="icon" onClick={onOpen} className={styles.newFieldButton}>
              <Icon name="plus" size="sm" />
              <span>Add New Field</span>
            </Button>
          )}
        </BucketFieldPopup>
      </div>
    </aside>
  );
};

export default memo(BucketDiagramInspector);
