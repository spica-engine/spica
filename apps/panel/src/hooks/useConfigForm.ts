import {useCallback, useEffect, useMemo, useState} from "react";
import isEqual from "lodash/isEqual";
import type {ConfigSchemaProperty} from "../store/api/configApi";
import {useUpdateConfigMutation} from "../store/api/configApi";
import {prepareOptions, sanitizeForSave, setNestedValue} from "../pages/config/configHelpers";

type UseConfigFormParams = {
  module: string | undefined;
  initialOptions: Record<string, unknown> | undefined;
  moduleSchema: ConfigSchemaProperty | undefined;
  is404?: boolean;
  onSaveSuccess?: () => void;
};

export function useConfigForm({module, initialOptions, moduleSchema, is404, onSaveSuccess}: UseConfigFormParams) {
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [baseline, setBaseline] = useState<Record<string, unknown>>({});
  const [updateConfig, {isLoading: isSaving}] = useUpdateConfigMutation();

  useEffect(() => {
    if (initialOptions) {
      const prepared = prepareOptions(initialOptions, moduleSchema);
      setOptions(prepared);
      setBaseline(prepared);
    } else if (is404) {
      setOptions({});
      setBaseline({});
    }
  }, [initialOptions, moduleSchema, is404]);

  const hasChanges = useMemo(() => !isEqual(options, baseline), [options, baseline]);

  const handleUpdate = useCallback((path: string, value: unknown) => {
    setOptions(prev => setNestedValue(prev, path, value));
  }, []);

  const handleSave = useCallback(async () => {
    if (!module || !hasChanges) return;
    const sanitized = sanitizeForSave(options, moduleSchema);
    try {
      await updateConfig({module, options: sanitized}).unwrap();
      const refreshed = prepareOptions(sanitized, moduleSchema);
      setBaseline(refreshed);
      setOptions(refreshed);
      onSaveSuccess?.();
    } catch {
      // Error handled by RTK Query
    }
  }, [module, options, hasChanges, updateConfig, moduleSchema, onSaveSuccess]);

  const handleBatchUpdate = useCallback((updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
    setOptions(updater);
  }, []);

  const handleReset = useCallback((resetOptions?: Record<string, unknown>) => {
    const initial = resetOptions
      ? prepareOptions(resetOptions, moduleSchema)
      : {};
    setOptions(initial);
  }, [moduleSchema]);

  return {options, setOptions, hasChanges, isSaving, handleUpdate, handleBatchUpdate, handleSave, handleReset};
}
