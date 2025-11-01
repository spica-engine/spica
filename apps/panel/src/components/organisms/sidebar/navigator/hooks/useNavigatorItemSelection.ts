import {useMemo} from "react";
import type {TypeNavigatorItem} from "../../../../../types/sidebar";
import {useLocation} from "react-router-dom";

export const useNavigatorItemSelection = (item: TypeNavigatorItem) => {
  const location = useLocation();

  const isActive = useMemo(() => {
    return item.link === location.pathname;
  }, [item.link, location.pathname]);
  return isActive;
};
