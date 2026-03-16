import {useState, useEffect, useCallback, useRef} from "react";
import type {Properties} from "src/services/bucketService";
import type {BucketEntryService} from "../services";
import type {ValidationErrors} from "../services";

export interface BucketEntryFormState {
  value: Record<string, any>;
  errors: ValidationErrors;
  isValidating: boolean;
}

export interface BucketEntryFormActions {
  setValue: (value: Record<string, any>) => void;
  setErrors: (errors: ValidationErrors) => void;
  validate: () => boolean;
  reset: () => void;
  scrollToFirstError: () => void;
}

export interface UseBucketEntryFormProps {
  properties: Properties;
  requiredFields: string[];
  service: BucketEntryService;
}

export const useBucketEntryForm = ({
  properties,
  requiredFields,
  service
}: UseBucketEntryFormProps): [BucketEntryFormState, BucketEntryFormActions] => {
  const [value, setValue] = useState<Record<string, any>>(() =>
    service.generateInitialValues(properties)
  );
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isValidating, setIsValidating] = useState(false);
  const isInitialMount = useRef(true);
  const previousPropertiesRef = useRef(properties);

  const errorRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {

    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPropertiesRef.current = properties;
      return;
    }

    const prevKeys = Object.keys(previousPropertiesRef.current || {}).sort().join(',');
    const currentKeys = Object.keys(properties || {}).sort().join(',');
    
    if (prevKeys !== currentKeys) {
      setValue(service.generateInitialValues(properties));
      setErrors({});
      previousPropertiesRef.current = properties;
    }
  }, [properties]);

  useEffect(() => {
    if (!errors || Object.keys(errors).length === 0) return;

    const validationResult = service.validate(value, properties, requiredFields);
    setErrors(validationResult.errors);
  }, [value]);

  const validate = useCallback((): boolean => {
    setIsValidating(true);
    const validationResult = service.validate(value, properties, requiredFields);
    setErrors(validationResult.errors);
    setIsValidating(false);
    return validationResult.isValid;
  }, [value]);

  const reset = useCallback(() => {
    setValue(service.generateInitialValues(properties));
    setErrors({});
  }, []);

  const scrollToFirstError = useCallback(() => {
    const firstErrorId = service.findFirstErrorId(errors, properties);
    
    if (firstErrorId) {
      const errorElement = errorRefs.current.get(firstErrorId) || document.getElementById(firstErrorId);
      errorElement?.scrollIntoView({behavior: "smooth", block: "center"});
    }
  }, [errors]);

  const registerErrorRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      errorRefs.current.set(id, element);
    } else {
      errorRefs.current.delete(id);
    }
  }, []);

  return [
    {value, errors, isValidating},
    {setValue, setErrors, validate, reset, scrollToFirstError}
  ];
};

