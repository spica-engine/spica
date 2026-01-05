/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 * 
 */

import React from "react";

import type { TypeMenuItems } from "../../../types/sidebar";

import Storage from "./storage-navigation/Storage";
import Bucket from "./bucket-navigation/Bucket";
import AccessManagement from "./access-management/AccessManagement";

export type NavigationPrefabProps = {
  menuItem?: TypeMenuItems;
};

export type NavigationComponent = React.ComponentType<NavigationPrefabProps>;


export const navigationRegistry: Record<string, NavigationComponent> = {
  storage: Storage,
  bucket: Bucket,
  accessManagement: AccessManagement,
  // Add more navigation prefabs here as they are created
};

export const DefaultNavigation: React.FC<NavigationPrefabProps> = ({ menuItem }) => {
  return (
    //TODO: Implement default navigation
      <div>Default Navigation</div>
  );
};


export const getNavigationComponent = (menuItemId: string): NavigationComponent => {
  return navigationRegistry[menuItemId] || DefaultNavigation;
};

