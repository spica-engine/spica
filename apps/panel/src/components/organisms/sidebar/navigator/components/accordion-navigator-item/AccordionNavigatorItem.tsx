import { Icon } from "oziko-ui-kit";
import { useNavigatorItemClick } from "../../hooks/useNavigatorItemClick";
import { useNavigatorItemSelection } from "../../hooks/useNavigatorItemSelection";
import styles from "./AccordionNavigatorItem.module.scss";
import NavigatorItem from "../../../../../molecules/navigator-item/NavigatorItem";
import type { TypeNavigatorItem } from "../../../../../../types/sidebar";

type AccordionNavigatorItemProps = {
  item: TypeNavigatorItem;
  index: number;
};

export const AccordionNavigatorItem = ({item, index}: AccordionNavigatorItemProps) => {
  const isCurrentlySelected = useNavigatorItemSelection(item);
  const handleClick = useNavigatorItemClick(item, isCurrentlySelected);

  return (
    <div className={styles.accordionItemContainer} key={index}>
      <NavigatorItem
        key={item?._id}
        label={item?.title || ""}
        prefix={{children: <Icon name={"help"} />}}
        suffixIcons={[{name: "dragHorizontalVariant"}]}
        onClick={handleClick}
        className={`${styles.navigatorItem} ${isCurrentlySelected ? styles.selected : ""}`}
        suffixElements={item.suffixElements}
      />
    </div>
  );
};