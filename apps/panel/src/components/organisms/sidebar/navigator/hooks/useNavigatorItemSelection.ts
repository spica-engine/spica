import {useParams} from "react-router-dom";
import {useMemo} from "react";
import type {TypeNavigatorItem} from "../../../../../types/sidebar";

export const useNavigatorItemSelection = (item: TypeNavigatorItem) => {
  const params = useParams();
  return useMemo(() => {
    return params.bucketId === item._id || item.link === window.location.pathname;
  }, [params.bucketId, item._id]);
};
