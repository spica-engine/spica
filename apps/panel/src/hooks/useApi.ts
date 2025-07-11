import axios, {type AxiosRequestHeaders} from "axios";
import {useCallback, useMemo, useState} from "react";
import useLocalStorage from "./useLocalStorage";

type ApiRequestOptions = {
  endpoint: string;
  method?: "get" | "post" | "put" | "delete" | "patch";
  onSuccess?: () => void;
  onError?: () => void;
};

function resolveEndpoint(endpoint: string) {
  if (endpoint.startsWith("http")) return endpoint;
  return `${import.meta.env.VITE_BASE_URL}${endpoint}`;
}

function useApi<T>({endpoint, method = "get", onSuccess, onError}: ApiRequestOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [token] = useLocalStorage("token", null);

  const resolvedUrl = useMemo(() => resolveEndpoint(endpoint), [])

  const request = useCallback(
    ({
      body,
      headers,
      endpoint
    }: {body?: any; headers?: AxiosRequestHeaders; endpoint?: string} = {}) => {
      const makeRequest = async () => {
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
            headers: combinedHeaders
          });

          if (response.status >= 200 && response.status < 300) {
            setData(response.data);
            onSuccess?.();
            return response.data;
          } else {
            setError(response.statusText ?? "Something went wrong");
            onError?.();
          }
        } catch (err: any) {
          setError(err.message ?? "Something went wrong");
        } finally {
          setLoading(false);
        }
      };
      setError(null);
      setLoading(true);
      return makeRequest();
    },
    [resolvedUrl, method, token]
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

  return result;
}

export default useApi;
