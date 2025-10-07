import axios, { type AxiosRequestHeaders } from "axios";
import { useCallback, useMemo, useRef, useState } from "react";
import useLocalStorage from "./useLocalStorage";

type ApiRequestOptions = {
  endpoint: string;
  method?: "get" | "post" | "put" | "delete" | "patch";
  onSuccess?: () => void;
  onError?: () => void;
  deduplicateRequests?: boolean;
};

type AbortInfo = {
  controller: AbortController;
  isDeduplicationAbort: boolean;
};

function resolveEndpoint(endpoint: string) {
  if (endpoint.startsWith("http")) return endpoint;
  return `${import.meta.env.VITE_BASE_URL}${endpoint}`;
}

function useApi<T>({
  endpoint,
  method = "get",
  onSuccess,
  onError,
  deduplicateRequests = true
}: ApiRequestOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [token] = useLocalStorage("token", null);

  const abortInfoRef = useRef<AbortInfo | null>(null);

  const resolvedUrl = useMemo(() => resolveEndpoint(endpoint), [endpoint]);

  const request = useCallback(
    ({
      body,
      headers,
      endpoint
    }: { body?: any; headers?: AxiosRequestHeaders; endpoint?: string } = {}) => {
      if (deduplicateRequests && abortInfoRef.current) {
        abortInfoRef.current.isDeduplicationAbort = true; // mark deduplication abort
        abortInfoRef.current.controller.abort();
      }

      const controller = new AbortController();
      abortInfoRef.current = {
        controller,
        isDeduplicationAbort: false,
      };

      const makeRequest = async () => {
        console.log("token", token);
        try {
          const combinedHeaders =
            token || headers
              ? {
                  ...(token ? {Authorization: `IDENTITY ${token}`} : {}),
                  ...(headers ?? {})
                }
              : undefined;

          const response = await axios({
            method,
            url: endpoint ? resolveEndpoint(endpoint) : resolvedUrl,
            data: body,
            headers: combinedHeaders,
            signal: controller.signal
          });

          if (response.status >= 200 && response.status < 300) {
            setData(response.data);
            onSuccess?.();
            return response.status === 204 ? "Success" : response.data;
          } else {
            setError(response.statusText ?? "Something went wrong");
            onError?.();
          }
        } catch (err: any) {
          if (err.name === "CanceledError") {
            if (abortInfoRef.current?.isDeduplicationAbort) {
              return;
            } else {
              setError(err.message ?? "Request was cancelled unexpectedly");
              onError?.();
              return;
            }
          }
          setError(err.response?.data?.message ?? err.message ?? "Something went wrong");
          onError?.();
        } finally {
          setLoading(false);
          abortInfoRef.current = null;
        }
      };

      setError(null);
      setLoading(true);
      return makeRequest();
    },
    [resolvedUrl, method, token, onSuccess, onError, deduplicateRequests]
  );

  const result = useMemo(
    () => ({
      data,
      error,
      loading,
      request
    }),
    [data, error, loading, request]
  );
  return result
}

export default useApi;
