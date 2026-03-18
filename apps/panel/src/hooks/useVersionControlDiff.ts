import {useMemo} from "react";
import {useGetDiffQuery} from "../store/api/versionControlApi";
import {parseDiffMessage} from "../utils/parseDiff";

export function useVersionControlDiff() {
  const {data, isLoading, error, refetch} = useGetDiffQuery({args: []});

  const parsed = useMemo(() => {
    if (!data?.message) return {modules: []};
    return parseDiffMessage(data.message);
  }, [data]);

  return {
    modules: parsed.modules,
    isLoading,
    error,
    refetch,
  };
}
