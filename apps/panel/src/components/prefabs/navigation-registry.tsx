/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 * 
 * Navigation Registry - Maps menu item IDs to their corresponding navigation components
 */

import React from "react";
import { StorageNavigation } from "./storage-navigation";
import Navigator from "../organisms/sidebar/navigator/Navigator";
import type { TypeMenuItems, NavigatorItemGroup } from "../../types/sidebar";

export type NavigationPrefabProps = {
  menuItem?: TypeMenuItems;
  navigatorItems?: NavigatorItemGroup;
};

export type NavigationComponent = React.ComponentType<NavigationPrefabProps>;


export const navigationRegistry: Record<string, NavigationComponent> = {
  storage: StorageNavigation,
  // Add more navigation prefabs here as they are created
};

/**
 * Default navigation component used when no specific prefab is defined
 */

export const DefaultNavigation: React.FC<NavigationPrefabProps> = ({ menuItem, navigatorItems }) => {
  return (
    <Navigator
      header={menuItem?.header}
      items={navigatorItems}
      addNewButtonText={menuItem?.addNewButtonText}
    />
  );
};


export const getNavigationComponent = (menuItemId: string): NavigationComponent => {
  return navigationRegistry[menuItemId] || DefaultNavigation;
};

