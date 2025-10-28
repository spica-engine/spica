import {useNavigate} from "react-router-dom";
import {useCallback} from "react";

export const useNavigatorItemClick = (item: any, isCurrentlySelected: boolean) => {
  const navigate = useNavigate();
  return useCallback(() => {
    if (!isCurrentlySelected) {
      navigate(`/${item?.section}/${item?._id}`);
    }
  }, [navigate, item?.section, item?._id, isCurrentlySelected]);
};