import {useInputRepresenter, useAdaptivePosition, Popover} from "oziko-ui-kit";
import type {TypeInputRepresenterError} from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";
import {useState, useMemo, useEffect, useRef, useLayoutEffect} from "react";
import type {RefObject} from "react";
import type {TypeProperties} from "src/hooks/useInputRepresenter";
import type {Properties, Property} from "src/services/bucketService";
import type {Constraints} from "./types";
import styles from "./Table.module.scss";
import type {FieldKind} from "src/domain/fields/types";
import {FIELD_REGISTRY} from "../../../domain/fields";

const DEFAULT_VALUES: Record<FieldKind, any> = {
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
} as unknown as Record<FieldKind, any>;

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
  type: FieldKind;
  value: any;
  title: string;
  constraints?: Constraints;
  updateCellDataError: string | null;
  setCellValue: (value: any) => void;
  containerRef?: RefObject<HTMLElement | null>;
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
  setCellValue,
  containerRef
}: EditCellPopoverProps) => {
  const field = FIELD_REGISTRY[type];
  const createInitialObject = (currentValue: any, properties: Properties | undefined) => {
    const initialObject: Record<string, any> = {};

    Object.values(properties || {}).forEach(property => {
      if (property.type === "object") {
        const nestedValue = currentValue?.[property.title];
        initialObject[property.title] = createInitialObject(nestedValue, property.properties);
      } else {
        initialObject[property.title] =
          currentValue?.[property.title] ?? DEFAULT_VALUES[property.type] ?? null;
      }
    });

    return initialObject;
  };

  const getInitialValue = () => {
    const defaultValue = DEFAULT_VALUES[type];

    if (type === "object") {
      return {[title]: createInitialObject(value, constraints.properties)};
    }

    if (type === "date") {
      const dateValue = isValidDate(new Date(value)) ? new Date(value) : null;
      return {
        [title]: dateValue || defaultValue
      };
    }

    if (type === "color") {
      return {
        [title]: value || defaultValue
      };
    }

    if (type === "location") {
      return {[title]: value || {lat: 0, lng: 0}};
    }

    return {[title]: value ?? defaultValue};
  };

  const [inputValue, setInputValue] = useState(getInitialValue);
  const [error, setError] = useState<TypeInputRepresenterError>();
  const [isOpen, setIsOpen] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (newValue: any) => {
    setInputValue(newValue);

    let transformedValue;

    if (type === "date") {
      const dateObj = newValue[title];
      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
        transformedValue = dateObj.toISOString();
      } else {
        transformedValue = null;
      }
    } else if (type === "location" && newValue[title]?.lat && newValue[title]?.lng) {
      transformedValue = {
        type: "Point",
        coordinates: [newValue[title]?.lng, newValue[title]?.lat]
      };
    } else {
      transformedValue = newValue[title];
    }

    setCellValue(transformedValue);
  };

  const properties = useMemo(
    () => ({
      [title]: {
        type,
        title,
        items: constraints?.items,
        properties: constraints.properties,
        enum: constraints?.enum,
        className: constraints?.enum ? styles.enumInput : undefined
      }
    }),
    [type, title, constraints]
  );

  useEffect(() => {
    if (!updateCellDataError || !submitted) return;
    setError({[title]: updateCellDataError});
  }, [updateCellDataError, submitted]);

  const customStyles: Partial<Record<FieldKind, string>> = {
    "multiple selection": styles.multipleSelectionInput,
    multiselect: styles.multipleSelectionInput,
    location: styles.locationInput,
    object: styles.objectInput
  } as Partial<Record<FieldKind, string>>;

  const input = useInputRepresenter({
    properties: properties as TypeProperties,
    value: inputValue,
    onChange: handleInputChange,
    error: error,
    errorClassName: styles.inputError,
    containerClassName: customStyles[type]
  });

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const discardChanges = () => {
    handleInputChange(getInitialValue());
    handleClose();
  };

  const popoverContentRef = useRef<HTMLDivElement | null>(null);
  const popoverContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSave = async () => {
    const errors = field?.validateValue(inputValue, constraints as Property, constraints.required);
    if (!isObjectEffectivelyEmpty(errors)) {
      setError({[title]: errors} as TypeInputRepresenterError);
      const firstErrorId = findFirstErrorId(errors, properties);
      if (firstErrorId) {
        const errorElement = document.getElementById(firstErrorId);
        if (errorElement) {
          errorElement.scrollIntoView({behavior: "smooth", block: "center"});
        }
      } else {
        (popoverContentRef.current?.firstChild as HTMLElement | null)?.scrollTo?.({
          top: 0,
          behavior: "smooth"
        });
      }
      return;
    }

    const payload =
      type === "location"
        ? {type: "Point", coordinates: [inputValue?.[title]?.lng, inputValue?.[title]?.lat]}
        : inputValue[title];

    const error = field?.validateValue(payload, constraints as Property, constraints.required);

    if (error) {
      setError({[title]: error} as TypeInputRepresenterError);
      return;
    }
    const result = await onCellSave(payload);
    setSubmitted(true);
    if (result) {
      handleClose();
    }
  };

  useEffect(() => {
    if (!error || isObjectEffectivelyEmpty(error)) return;
    const payload = inputValue[title];
    const errors = field?.validateValue(payload, constraints as Property, constraints.required);
    if (isObjectEffectivelyEmpty(errors) && updateCellDataError === error[title]) return;
    setError({[title]: errors} as TypeInputRepresenterError);
  }, [JSON.stringify(inputValue), JSON.stringify(error), updateCellDataError]);

  useEffect(() => {
    handleInputChange(getInitialValue());
  }, [value]);

  const savingRef = useRef(false);
  useEffect(() => {
    const handleEnter = async (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (savingRef.current) return;

      savingRef.current = true;
      try {
        await handleSave();
      } finally {
        savingRef.current = false;
      }
    };

    window.addEventListener("keydown", handleEnter);

    return () => {
      window.removeEventListener("keydown", handleEnter);
    };
  }, [inputValue]);

  const {targetPosition, calculatePosition} = useAdaptivePosition({
    containerRef: cellRef,
    targetRef: popoverContainerRef
  });

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  const contentStyle = useMemo(() => {
    if (!targetPosition) return undefined;
    const baseLeft = targetPosition?.left ?? 0;

    if (!containerRef?.current || !cellRef?.current) return {...targetPosition, left: baseLeft};

    const cellElement = cellRef.current as HTMLElement;
    const containerElement = containerRef.current as HTMLElement;

    const maxPopoverWidth = 300;

    const cellOffsetLeft = cellElement.offsetLeft;
    const containerScrollLeft = containerElement.scrollLeft;

    const cellViewportLeft = cellOffsetLeft - containerScrollLeft;
    const containerViewportWidth = containerElement.clientWidth ?? 0;

    const overflowsOnRight = cellViewportLeft + maxPopoverWidth > containerViewportWidth;

    const left = baseLeft - (overflowsOnRight ? maxPopoverWidth : 0);
    return {...targetPosition, left};
  }, [targetPosition]);

  return (
    <Popover
      containerProps={{ref: popoverContainerRef}}
      contentProps={{
        style: contentStyle,
        ref: popoverContentRef
      }}
      open={isOpen}
      onClose={discardChanges}
      content={input}
      portalClassName={styles.inputPopover}
    />
  );
};
