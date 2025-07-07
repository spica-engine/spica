import axios from "axios";
import {useEffect, useMemo, useState} from "react";
import useLocalStorage from "./useLocalStorage";

type ApiRequestOptions = {
  endpoint: string;
  method?: "get" | "post" | "put" | "delete";
  body?: any;
  onSuccess?: () => void;
  onError?: () => void;
};

const defaultBaseUrl = "https://jsonplaceholder.typicode.com";

function useApi<T>({endpoint, method = "get", body, onSuccess, onError}: ApiRequestOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [token] = useLocalStorage("token", null);

  const resolvedUrl = useMemo(() => {
    if (endpoint.startsWith("http")) return endpoint;
    return `${defaultBaseUrl}${endpoint}`;
  }, [endpoint]);

  useEffect(() => {
    const fetchData = async () => {
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
    fetchData();
  }, [resolvedUrl, method, JSON.stringify(body)]);

  const result = useMemo(
    () => ({
      data,
      error,
      loading
    }),
    [data, error, loading]
  );

  return result;
}

export default useApi;
