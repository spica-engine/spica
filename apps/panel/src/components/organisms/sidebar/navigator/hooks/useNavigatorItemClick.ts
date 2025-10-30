import {useNavigate} from "react-router-dom";
import {useCallback} from "react";
import type {TypeNavigatorItem} from "../../../../../types/sidebar";

export const useNavigatorItemClick = (item: TypeNavigatorItem, isCurrentlySelected: boolean) => {
  const navigate = useNavigate();
  return useCallback(() => {
    if (!isCurrentlySelected) {
      navigate(item.link ?? `/${item?.section}/${item?._id}`);
    }
  }, [navigate, item?.section, item?._id, isCurrentlySelected]);
};