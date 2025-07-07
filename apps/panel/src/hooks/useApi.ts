import axios from "axios";
import {useCallback, useEffect, useMemo, useState} from "react";
import useLocalStorage from "./useLocalStorage";

type ApiRequestOptions = {
  endpoint: string;
  method?: "get" | "post" | "put" | "delete";
  onSuccess?: () => void;
  onError?: () => void;
};

function useApi<T>({endpoint, method = "get", onSuccess, onError}: ApiRequestOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [token] = useLocalStorage("token", null);

  const resolvedUrl = useMemo(() => {
    if (endpoint.startsWith("http")) return endpoint;
    return `${import.meta.env.VITE_BASE_URL}${endpoint}`;
  }, [endpoint]);

  const request = useCallback(
    (body?: any) => {
      const makeRequest = async () => {
        try {
          const response = await axios({
            method,
            url: resolvedUrl,
            data: body,
            headers: token ? {Authorization: token} : undefined
          });

          if (response.status >= 200 && response.status < 300) {
            setData(response.data);
            onSuccess?.();
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
      makeRequest();
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
