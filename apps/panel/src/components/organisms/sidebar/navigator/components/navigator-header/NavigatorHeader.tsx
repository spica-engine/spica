import {Text, FluidContainer, Button, Icon, type IconName} from "oziko-ui-kit";
import styles from "./NavigatorHeader.module.scss";
import type {NavigatorItemGroup} from "../../../SideBar";

export type TypeNavigatorHeader = {
  name?: string;
  items?: NavigatorItemGroup;
  buttons?: {
    icon: IconName;
    onClick: () => void;
  }[];
};

type TypeNavigatorHeaderProps = {
  header?: TypeNavigatorHeader;
  items?: NavigatorItemGroup;
  button?: {
    title: string;
    icon: IconName;
    onClick: () => void;
  };
};

export const NavigatorHeader = ({header}: TypeNavigatorHeaderProps) => {
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
            <Icon name={button.icon} size={18} />
          </Button>
        ))
      }}
      className={styles.header}
    />
  );
};
