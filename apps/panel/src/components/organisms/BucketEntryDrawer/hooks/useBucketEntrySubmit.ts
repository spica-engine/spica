import {useState, useCallback} from "react";
import type {Properties} from "src/services/bucketService";
import type {BucketEntryService} from "../services";

export interface BucketEntrySubmitState {
  isLoading: boolean;
  error: string | null;
}

export interface BucketEntrySubmitActions {
  submit: (
    bucketId: string,
    value: Record<string, any>,
    properties: Properties,
    requiredFields: string[]
  ) => Promise<boolean>;
  clearError: () => void;
}

export interface UseBucketEntrySubmitProps {
  service: BucketEntryService;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const useBucketEntrySubmit = ({
  service,
  onSuccess,
  onError
}: UseBucketEntrySubmitProps): [BucketEntrySubmitState, BucketEntrySubmitActions] => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (
      bucketId: string,
      value: Record<string, any>,
      properties: Properties,
      requiredFields: string[]
    ): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await service.submitEntry(bucketId, value, properties, requiredFields);

        if (result.success) {
          onSuccess?.();
          return true;
        } else {
          const errorMessage = result.error || "Failed to create entry";
          setError(errorMessage);
          onError?.(errorMessage);
          return false;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(errorMessage);
        onError?.(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [service, onSuccess, onError]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return [{isLoading, error}, {submit, clearError}];
};

