import {useMemo} from "react";
import type {TypeNavigatorItem} from "../../../../../types/sidebar";

export const useNavigatorItemSelection = (item: TypeNavigatorItem) => {
  return useMemo(() => {
    return item.link === window.location.pathname;
  }, [item._id]);
};
