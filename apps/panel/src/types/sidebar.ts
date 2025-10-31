import type {IconName} from "oziko-ui-kit";

export type TypeMenuItems = {
  name?: string;
  icon?: IconName;
  header?: TypeNavigatorHeader;
  id: string;
  addNewButtonText?: string;
};

export type TypeNavigatorItem = {
  _id: string;
  section: string; //!Todo can be improvable like statically defined values etc.
  title?: string;
  icon?: IconName;
  category?: string;
  suffixElements?: React.ElementType[];
  className?: string;
  link: string;
};

export type NavigatorItemGroup = {
  items: TypeNavigatorItem[];
  onOrderChange: (from: number, to: number) => void;
  completeOrderChange: (identifier: string, newOrder: number) => void;
};

export type TypeNavigatorHeader = {
  name?: string;
  items?: NavigatorItemGroup;
  buttons?: {
    icon: IconName;
    onClick: () => void;
  }[];
};
