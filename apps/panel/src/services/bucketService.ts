import useApi from "src/hooks/useApi";

export const useBucketService = () => {
  const { request, data, error, loading } = useApi({
    endpoint: "/api/bucket",
    method: "get"
  });

  return {
    buckets: data,
    fetchBuckets: request,
    error,
    loading,
  };
};
