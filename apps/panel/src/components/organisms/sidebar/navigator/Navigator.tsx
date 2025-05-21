import {FluidContainer, Icon, Text} from "oziko-ui-kit";
import type {IconName} from "../../../../../../../node_modules/oziko-ui-kit/dist/utils/iconList";
import styles from "./Navigator.module.scss";
import {Button, Accordion} from "oziko-ui-kit";
//Todo! import type from ui-kit
// import {helperUtils} from "../../../../../../../node_modules/oziko-ui-kit/dist/utils/helperUtils";
import NavigatorItem from "../../../molecules/navigator-item/NavigatorItem";
import {memo} from "react";

type TypeNavigatorProps = {
  header?: TypeNavigatorHeader;
  items?: any;
  button?: {
    title: string;
    icon: IconName;
    onClick: () => void;
  };
};

export type TypeNavigatorHeader = {
  name?: string;
  buttons?: {
    icon: IconName;
    onClick: () => void;
  }[];
};

const NavigatorHeader = ({header}: TypeNavigatorProps) => {
  return (
    <FluidContainer
      dimensionX="fill"
      mode="fill"
      alignment="leftCenter"
      root={{
        children: <Text className={styles.title}>{header?.name}</Text>,
        alignment: "leftCenter"
      }}
      suffix={{
        children: header?.buttons?.map((button, index) => (
          <Button
            key={index}
            variant="text"
            color="transparent"
            className={styles.icon}
            onClick={button.onClick}
          >
            <Icon name={button.icon} size="lg" />
          </Button>
        ))
      }}
      className={styles.header}
    />
  );
};

const Navigator = ({header, items, button}: TypeNavigatorProps) => {
  const groupObjectsByCategory = (objects: any) => {
    const groupedMap = new Map();
    const ungrouped: any[] = [];

    objects.forEach((obj: any) => {
      if (obj.category) {
        if (!groupedMap.has(obj.category)) {
          groupedMap.set(obj.category, []);
        }
        groupedMap.get(obj.category).push(obj);
      } else {
        ungrouped.push(obj);
      }
    });

    return {
      grouped: Array.from(groupedMap.values()),
      ungrouped
    };
  };

  const {grouped, ungrouped} = groupObjectsByCategory(items);

  const accordionItems = grouped?.map((item: any, index: number) => ({
    title: item[0].category.charAt(0).toUpperCase() + item[0].category.slice(1),
    content: (
      <>
        {item.map((item: any, index: number) => (
          <NavigatorItem
            label={item?.title}
            prefix={{children: <Icon name={item?.icon} />}}
            prefixIcon={item?.icon}
            suffixIcons={[
              {
                name: "dragHorizontalVariant"
              },
              {
                name: "dotsVertical"
              }
            ]}
          />
        ))}
      </>
    ),
    icon: (
      <>
        <Icon name="dragHorizontalVariant" />
        <Icon name="dotsVertical" />
      </>
    )
  }));

  return (
    <div className={styles.navigation}>
      <NavigatorHeader header={header} />
      <div className={styles.items}>
        <Accordion
          items={accordionItems}
          headerClassName={styles.header}
          contentClassName={styles.content}
          gap={0}

          //TODO: add hoverable api
        />
        {ungrouped?.map((item: any, index: number) => (
          <NavigatorItem
            label={item?.title}
            prefixIcon={item?.icon}
            suffixIcons={[
              {
                name: "dragHorizontalVariant"
              },
              {
                name: "dotsVertical"
              }
            ]}
            className={styles.ungrouped}
          />
        ))}
      </div>
      {button && (
        <Button color="transparent" variant="text">
          <Icon name={button.icon} />
          <Text>{button.title}</Text>
        </Button>
      )}
    </div>
  );
};

export default memo(Navigator);
