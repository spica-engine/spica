import {useParams} from "react-router-dom";
import {useMemo} from "react";


export const useNavigatorItemSelection = (itemId: string) => {
  const params = useParams();
  return useMemo(() => {
    return params.bucketId === itemId;
  }, [params.bucketId, itemId]);
};
