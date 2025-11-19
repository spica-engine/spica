/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 * 
 * Navigation Registry - Maps menu item IDs to their corresponding navigation components
 */

import React from "react";
import { StorageNavigation } from "./storage-navigation";
import type { TypeMenuItems } from "../../../types/sidebar";
import { BucketNavigation } from "./bucket-navigation";

export type NavigationPrefabProps = {
  menuItem?: TypeMenuItems;
};

export type NavigationComponent = React.ComponentType<NavigationPrefabProps>;


export const navigationRegistry: Record<string, NavigationComponent> = {
  storage: StorageNavigation,
  bucket: BucketNavigation,
  // Add more navigation prefabs here as they are created
};

/**
 * Default navigation component used when no specific prefab is defined
 */

export const DefaultNavigation: React.FC<NavigationPrefabProps> = ({ menuItem }) => {
  return (
    //TODO: Implement default navigation
      <div>Default Navigation</div>
  );
};


export const getNavigationComponent = (menuItemId: string): NavigationComponent => {
  return navigationRegistry[menuItemId] || DefaultNavigation;
};

