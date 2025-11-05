import {Icon, Text, type IconName, helperUtils, Accordion} from "oziko-ui-kit";
import styles from "./Navigator.module.scss";
import {Button} from "oziko-ui-kit";
import {memo, useMemo} from "react";
import type {
  NavigatorItemGroup,
  TypeNavigatorItem,
  TypeNavigatorHeader
} from "../../../../types/sidebar";
import AddBucketPopup from "../../../../components/molecules/add-bucket-popup/AddBucketPopup";
import {NavigatorHeader} from "./components/navigator-header/NavigatorHeader";
import {ReorderableList} from "./components/reorderable-list/ReorderableList";
import {DefaultNavigatorItem} from "./components/default-navigator-item/DefaultNavigatorItem";
import {AccordionNavigatorItem} from "./components/accordion-navigator-item/AccordionNavigatorItem";

const groupObjectsByCategory = (items: TypeNavigatorItem[]) => {
  const groupedMap = new Map<string, TypeNavigatorItem[]>();
  const ungrouped: TypeNavigatorItem[] = [];
  items.forEach(obj => {
    if (obj.category) {
      if (!groupedMap.has(obj.category)) {
        groupedMap.set(obj.category, []);
      }
      groupedMap.get(obj.category)!.push(obj);
    } else {
      ungrouped.push(obj);
    }
  });

  const grouped = Array.from(groupedMap.values());

  return {
    grouped,
    ungrouped
  };
};

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
  const {grouped, ungrouped} = useMemo(() => groupObjectsByCategory(items?.items ?? []), [items]);

  const accordionItems = useMemo(
    () =>
      grouped.map((item, index) => {
        const title = helperUtils.capitalize(item?.[0]?.category ?? "");
        const content = (
          <>
            {item.map((item: TypeNavigatorItem, index: number) => (
              <AccordionNavigatorItem key={item._id} item={item} index={index} />
            ))}
          </>
        );

        const icon = (
          <>
            <Icon name="dragHorizontalVariant" />
            <Icon name="dotsVertical" />
          </>
        );
        const items = [{title, content, icon}];

        return (
          <Accordion
            key={index}
            items={items}
            headerClassName={styles.accordionHeader}
            className={`${styles.accordion} accordion`}
            openClassName={styles.accordionOpen}
            gap={0}
          />
        );
      }),
    [grouped, items]
  );

  const ungroupedItems = useMemo(() => {
    if (!Array.isArray(ungrouped) || !items) return null;
    if (items.onOrderChange) {
      return (
        <ReorderableList
          onOrderChange={items.onOrderChange}
          completeOrderChange={items.completeOrderChange}
          items={ungrouped as TypeNavigatorItem[]}
        />
      );
    }
    return ungrouped.map(item => <DefaultNavigatorItem key={item._id} item={item} />);
  }, [ungrouped]);

  return (
    <div className={styles.navigation}>
      <NavigatorHeader header={header} />
      <div className={styles.items}>
        {accordionItems}
        {ungroupedItems}
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