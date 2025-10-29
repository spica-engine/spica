import {Icon, Text, type IconName, helperUtils, Accordion} from "oziko-ui-kit";
import styles from "./Navigator.module.scss";
import {Button} from "oziko-ui-kit";
import {memo} from "react";
import type {NavigatorItemGroup, TypeNavigatorItems} from "../SideBar";
import AddBucketPopup from "../../../../components/molecules/add-bucket-popup/AddBucketPopup";
import {
  NavigatorHeader,
  type TypeNavigatorHeader
} from "./components/navigator-header/NavigatorHeader";
import {ReorderableList} from "./components/reorderable-list/ReorderableList";
import {DefaultList} from "./components/default-list/DefaultList";
import {AccordionNavigatorItem} from "./components/accordion-navigator-item/AccordionNavigatorItem";

type TypeNavigatorProps = {
  header?: TypeNavigatorHeader;
  items?: NavigatorItemGroup;
  button?: {
    title: string;
    icon: IconName;
    onClick: () => void;
  };
  addNewButtonText?: string;
};

const Navigator = ({header, items, button, addNewButtonText}: TypeNavigatorProps) => {
  const groupObjectsByCategory = (object: {items: any[]}) => {
    const groupedMap = new Map<string, TypeNavigatorItems[]>();
    const ungrouped: TypeNavigatorItems[] = [];
    object.items.forEach(obj => {
      if (obj.category) {
        if (!groupedMap.has(obj.category)) {
          groupedMap.set(obj.category, []);
        }
        groupedMap.get(obj.category)!.push(obj);
      } else {
        ungrouped.push(obj);
      }
    });

    return {
      grouped: Array.from(groupedMap.values()),
      ungrouped
    };
  };

  const {grouped, ungrouped} = groupObjectsByCategory({
    items: items?.items ?? []
  });

  const accordionItems = grouped?.map(item => ({
    title: helperUtils.capitalize(item?.[0]?.category ?? ""),
    content: (
      <>
        {item.map((item: any, index: number) => (
          <AccordionNavigatorItem key={item._id} item={item} index={index} />
        ))}
      </>
    ),
    icon: (
      <>
        <Icon name="dragHorizontalVariant" />
        <Icon name="dotsVertical" />
      </>
    ),
    className: item?.[0]?.className
  }));

  
  return (
    <div className={styles.navigation}>
      <NavigatorHeader header={header} />
      <div className={styles.items}>
        {accordionItems.map((item, index) => (
          <Accordion
            key={index}
            items={[item]}
            headerClassName={styles.accordionHeader}
            className={`${styles.accordion} accordion ${item.className ?? ""}`}
            openClassName={styles.accordionOpen}
            gap={0}
          />
        ))}

        {Array.isArray(ungrouped) &&
          items &&
          (items.onOrderChange ? (
            <ReorderableList
              onOrderChange={items.onOrderChange}
              completeOrderChange={items.completeOrderChange}
              items={ungrouped as TypeNavigatorItems[]}
            />
          ) : (
            <DefaultList items={ungrouped as TypeNavigatorItems[]} />
          ))}
        {addNewButtonText && <AddBucketPopup text={addNewButtonText} />}
      </div>
      {button && (
        <Button color="transparent" variant="text">
          <Icon name={button.icon} />
          <Text className={styles.noLineHeight}>{button.title}</Text>
        </Button>
      )}
    </div>
  );
};

export default memo(Navigator);
