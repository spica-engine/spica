import {useInputRepresenter, useAdaptivePosition, Popover} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/build/dist/custom-hooks/useInputRepresenter";
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect,
  type RefObject
} from "react";
import type {TypeProperties, TypeArrayItems} from "src/hooks/useInputRepresenter";
import type {Properties} from "src/services/bucketService";
import type {FieldType} from "./types";
import styles from "./Table.module.scss";

const DEFAULT_VALUES: Record<FieldType, any> = {
  string: "",
  number: 0,
  date: "",
  boolean: false,
  textarea: "",
  "multiple selection": [],
  multiselect: [],
  relation: null,
  location: {lat: 36.966667, lng: 30.666667},
  array: [],
  object: {},
  file: null,
  richtext: "",
  color: "#000000"
};

export function isValidDate(dateObject: any) {
  return dateObject instanceof Date && !isNaN(dateObject.getTime());
}

const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(
    key =>
      obj[key] === undefined ||
      obj[key] === null ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
  );
};

const findFirstErrorId = (errors: any, formattedProperties: any): string | null => {
  for (const [key, error] of Object.entries(errors)) {
    const property = formattedProperties[key];

    if (typeof error === "string" && property?.id) {
      return property.id;
    } else if (typeof error === "object" && property?.properties) {
      const nestedId = findFirstErrorId(error, property.properties);
      if (nestedId) return nestedId;
    }
  }
  return null;
};

type EditCellPopoverProps = {
  onCellSave: (value: any) => Promise<any>;
  onClose: () => void;
  cellRef: RefObject<HTMLElement | null>;
  type: FieldType;
  value: any;
  title: string;
  constraints?: {
    pattern?: string;
    minimum?: number;
    maximum?: number;
    minItems?: number;
    maxItems?: number;
    items?: TypeArrayItems;
    properties?: Properties;
  };
  updateCellDataError: string | null;
  setCellValue: (value: any) => void;
};

export const EditCellPopover = ({
  value,
  type,
  title,
  constraints = {},
  onCellSave,
  onClose,
  cellRef,
  updateCellDataError,
  setCellValue
}: EditCellPopoverProps) => {
  const createInitialObject = (currentValue: any, properties: Properties | undefined) => {
    const initialObject: Record<string, any> = {};

    Object.values(properties || {}).forEach(property => {
      if (property.type === "object") {
        // Pass the nested value to the recursive call
        const nestedValue = currentValue?.[property.title];
        initialObject[property.title] = createInitialObject(nestedValue, property.properties);
      } else {
        // Use the current value if it exists, otherwise fall back to defaults
        initialObject[property.title] =
          currentValue?.[property.title] ?? DEFAULT_VALUES[property.type as FieldType] ?? null;
      }
    });

    return initialObject;
  };

  const getValueForType = (fallbackToDefaults: boolean = true) => {
    const defaultValue = DEFAULT_VALUES[type];

    if (type === "object") {
      return fallbackToDefaults
        ? {value: createInitialObject(value, constraints.properties)}
        : {value};
    }

    if (type === "date") {
      const dateValue = isValidDate(new Date(value)) ? new Date(value) : null;
      return {
        value: dateValue || (fallbackToDefaults ? defaultValue : null)
      };
    }

    if (type === "color") {
      return {
        value: value || (fallbackToDefaults ? defaultValue : "")
      };
    }

    if (type === "location") {
      return {value: value || {lat: 0, lng: 0}};
    }

    return fallbackToDefaults ? {value: value ?? defaultValue} : (value ?? defaultValue);
  };

  const getInitialValue = () => getValueForType(true);

  const getEmptyValue = () => getValueForType(false);

  const [inputValue, setInputValue] = useState(getInitialValue);
  const [error, setError] = useState<TypeInputRepresenterError>();
  const [isOpen, setIsOpen] = useState(true);

  const handleInputChange = (newValue: any) => {
    setInputValue(newValue);

    let transformedValue;

    if (type === "date") {
      transformedValue = newValue?.value?.toString();
    } else if (type === "location" && newValue?.value?.lat && newValue?.value?.lng) {
      transformedValue = {
        type: "Point",
        coordinates: [newValue?.value?.lat, newValue?.value?.lng]
      };
    } else {
      transformedValue = newValue?.value;
    }

    setCellValue(transformedValue);
  };

  const properties = useMemo(
    () => ({
      value: {
        type,
        title,
        items: constraints?.items,
        properties: constraints.properties
      }
    }),
    [type, title, constraints]
  );

  useEffect(() => {
    if (!updateCellDataError) return;
    setError({value: updateCellDataError});
  }, [updateCellDataError]);

  const customStyles: Partial<Record<FieldType, string>> = {
    "multiple selection": styles.multipleSelectionInput,
    multiselect: styles.multipleSelectionInput,
    location: styles.locationInput,
    object: styles.objectInput
  };

  const input = useInputRepresenter({
    properties: properties as TypeProperties,
    value: inputValue,
    onChange: handleInputChange,
    error: error, //{value: {user: {email: "god damn"}}},
    errorClassName: styles.inputError,
    containerClassName: customStyles[type]
  });

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const discardChanges = () => {
    handleInputChange(getEmptyValue());
    handleClose();
  };

  const popoverContentRef = useRef<HTMLDivElement | null>(null);
  const popoverContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSave = async () => {
    const errors = validateInput(inputValue, constraints);
    if (!isObjectEffectivelyEmpty(errors)) {
      console.log("validation errors", errors);
      setError(errors);
      const firstErrorId = findFirstErrorId(errors, properties);
      if (firstErrorId) {
        console.log("firstErrorId", firstErrorId);
        const errorElement = document.getElementById(firstErrorId);
        if (errorElement) {
          errorElement.scrollIntoView({behavior: "smooth", block: "center"});
        }
      } else {
        console.log("no firstErrorId found");
        (popoverContentRef.current?.firstChild as HTMLElement | null)?.scrollTo?.({
          top: 0,
          behavior: "smooth"
        });
      }
      return;
    }

    const payload =
      type === "location"
        ? {type: "Point", coordinates: [inputValue?.value?.lat, inputValue?.value?.lng]}
        : inputValue?.value;

    const result = await onCellSave(payload);
    if (result) {
      handleClose();
    }
  };

  const validateInput = useCallback(
    (
      inputValue: {[key: string]: any},
      constraints: {
        pattern?: string;
        minimum?: number;
        maximum?: number;
        minItems?: number;
        maxItems?: number;
        items?: TypeArrayItems;
        properties?: Properties;
      }
    ): TypeInputRepresenterError => {
      if (!constraints) return {};
      // Get the actual value from the input structure
      const actualValue = inputValue?.value;
      // If we have properties constraint, validate the object structure
      if (constraints.properties && type === "object") {
        const errors = validateObjectProperties(actualValue, constraints.properties);
        return {value: errors};
      }

      // For non-object types, validate the direct value
      return validateSingleValue(actualValue, constraints, "value");
    },
    []
  );

  useEffect(() => {
    if (!error || isObjectEffectivelyEmpty(error)) return;
    const errors = validateInput(inputValue, constraints);
    if (isObjectEffectivelyEmpty(errors) && updateCellDataError === error.value) return;
    setError(errors);
  }, [JSON.stringify(inputValue), JSON.stringify(error), updateCellDataError]);

  const validateObjectProperties = (
    obj: any,
    properties: Properties
  ): TypeInputRepresenterError => {
    const errors: TypeInputRepresenterError = {};

    Object.entries(properties).forEach(([key, propertySchema]) => {
      const value = obj[key];
      const fieldErrors = validateSingleValue(value, propertySchema, key);
      errors[key] = fieldErrors[key] || fieldErrors;
      if (Object.keys(fieldErrors).length === 0) {
        delete errors[key];
      }
    });

    return errors;
  };

  // Helper function to validate a single value
  const validateSingleValue = (
    value: any,
    schema: any,
    fieldKey: string
  ): TypeInputRepresenterError => {
    const errors: TypeInputRepresenterError = {};

    if (!schema) return errors;

    const {type, pattern, minimum, maximum, minItems, maxItems, properties, items, required} =
      schema;

    // Check required fields
    if (
      required &&
      required.includes(fieldKey) &&
      (value === undefined || value === null || value === "")
    ) {
      errors[fieldKey] = `This field is required`;
      return errors;
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === "") {
      return errors;
    }

    // Type-specific validation
    switch (type) {
      case "string":
        if (pattern && typeof value === "string") {
          const isValid = new RegExp(pattern).test(value);
          if (!isValid) {
            errors[fieldKey] = `This field does not match the required pattern "${pattern}"`;
          }
        }
        break;

      case "number":
        if (minimum !== undefined && value < minimum) {
          errors[fieldKey] = `This field must be at least ${minimum}`;
        }
        if (maximum !== undefined && value > maximum) {
          errors[fieldKey] = `This field must be at most ${maximum}`;
        }
        break;

      case "array":
        if (minItems !== undefined && value.length < minItems) {
          errors[fieldKey] = `This field must have at least ${minItems} items`;
        }
        if (maxItems !== undefined && value.length > maxItems) {
          errors[fieldKey] = `This field must have at most ${maxItems} items`;
        }
        // Validate array items if items schema is provided
        if (items) {
          (value as never[]).forEach((item, index) => {
            const itemErrors = validateSingleValue(item, items, `${fieldKey}[${index}]`);
            Object.assign(errors, itemErrors);
          });
        }
        break;

      case "object":
        if (value && typeof value === "object" && properties) {
          const nestedErrors = validateObjectProperties(value, properties);
          Object.assign(errors, nestedErrors);
        }
        break;
    }

    return errors;
  };

  useEffect(() => {
    handleInputChange(getInitialValue());
  }, [value]);

  useEffect(() => {
    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      handleSave();
    };
    window.addEventListener("keydown", handleEnter);

    return () => {
      window.removeEventListener("keydown", handleEnter);
    };
  }, [inputValue]);

  const {targetPosition, calculatePosition} = useAdaptivePosition({
    containerRef: cellRef,
    targetRef: popoverContainerRef,
    initialPlacement: "bottomStart"
  });

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  return (
    <Popover
      containerProps={{ref: popoverContainerRef}}
      contentProps={{
        style: targetPosition ?? undefined,
        ref: popoverContentRef
        //? {...targetPosition, left: (targetPosition?.left ?? 0) - 300}
        //: undefined
      }}
      open={isOpen}
      onClose={discardChanges}
      content={input}
      portalClassName={styles.inputPopover}
    />
  );
};
