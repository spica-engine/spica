import type { TypeNavigatorItems } from "../../../SideBar";
import { useNavigatorItemClick } from "../../hooks/useNavigatorItemClick";
import { useNavigatorItemSelection } from "../../hooks/useNavigatorItemSelection";
import type {BucketType} from "src/store/api/bucketApi";
import styles from "./DefaultList.module.scss";
import NavigatorItem from "../../../../../molecules/navigator-item/NavigatorItem";

export const DefaultList = ({items}: {items: TypeNavigatorItems[]}) => {
  return (
    <>
      {items.map(item => {
        const isCurrentlySelected = useNavigatorItemSelection(item._id);
        const handleClick = useNavigatorItemClick(item, isCurrentlySelected);

        return (
          <NavigatorItem
            key={item._id}
            label={item?.title ?? ""}
            onClick={handleClick}
            className={`${styles.navigatorItem} ${isCurrentlySelected ? styles.selected : ""}`}
            bucket={item as unknown as BucketType}
          />
        );
      })}
    </>
  );
};