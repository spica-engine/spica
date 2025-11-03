import {useNavigatorItemClick} from "../../hooks/useNavigatorItemClick";
import {useNavigatorItemSelection} from "../../hooks/useNavigatorItemSelection";
import styles from "./DefaultNavigatorItem.module.scss";
import NavigatorItem from "../../../../../molecules/navigator-item/NavigatorItem";
import type {TypeNavigatorItem} from "../../../../../../types/sidebar";

export const DefaultNavigatorItem = ({item}: {item: TypeNavigatorItem}) => {
  const isCurrentlySelected = useNavigatorItemSelection(item);
  const handleClick = useNavigatorItemClick(item, isCurrentlySelected);

  return (
    <NavigatorItem
      label={item?.title ?? ""}
      onClick={handleClick}
      className={`${styles.navigatorItem} ${isCurrentlySelected ? styles.selected : ""} ${item.className ?? ""}`}
      suffixElements={item.suffixElements}
      prefixIcon={item.icon}
    />
  );
};