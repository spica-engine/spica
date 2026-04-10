import type { IconName } from "oziko-ui-kit";
import type {TypeMenuItems, TypeNavigatorItem} from "../../types/sidebar";

export type SideBarItem = {
  id: string;
  name: string;
  icon: IconName;
  position?: "bottom";
  route?: string;
};

const BASE_ITEMS: Record<string, { id: string; name: string; icon: IconName }> = {
  bucket:            { id: "bucket",            name: "Bucket",            icon: "bucket" },
  dashboard:         { id: "dashboard",         name: "Dashboard",         icon: "dashboard" },
  storage:           { id: "storage",           name: "Storage",           icon: "storage" },
  accessManagement:  { id: "accessManagement",  name: "Access Management", icon: "identities" },
  function:          { id: "function",          name: "Function",          icon: "function" },
  webhook:           { id: "webhook",           name: "Webhook",           icon: "webhook" },
  config:            { id: "config",            name: "Configuration",     icon: "cog" },
  versionControl:    { id: "versionControl",    name: "Version Control",   icon: "forkRight" },
  identity:          { id: "identity",          name: "Identity",          icon: "identities" },
  assetstore:        { id: "assetstore",        name: "Assetstore",        icon: "assetstore" },
};

export const sideBarItems: SideBarItem[] = [
  BASE_ITEMS.bucket,
  BASE_ITEMS.dashboard,
  BASE_ITEMS.storage,
  BASE_ITEMS.accessManagement,
  BASE_ITEMS.function,
  BASE_ITEMS.webhook,
  BASE_ITEMS.config,
  { ...BASE_ITEMS.versionControl, position: "bottom", route: "/version-control" },
];

export const getMenuItems = (navigate?: (path: string) => void): TypeMenuItems[] => [
  {
    ...BASE_ITEMS.bucket,
    header: {
      name: "Tables",
      buttons: [
        { icon: "clockOutline", onClick: () => {} },
        { icon: "viewList", onClick: () => navigate?.("/diagram") }
      ]
    },
    addNewButtonText: "New Bucket"
  },
  {
    ...BASE_ITEMS.dashboard,
    header: { name: "Dashboards" },
    addNewButtonText: "New Dashboard"
  },
  {
    ...BASE_ITEMS.storage,
    header: { name: "Storage" }
  },
  {
    ...BASE_ITEMS.identity,
    header: { name: "Identity" }
  },
  {
    ...BASE_ITEMS.function,
    header: { name: "Function" }
  },
  {
    ...BASE_ITEMS.webhook,
    header: { name: "Webhook" }
  },
  {
    ...BASE_ITEMS.assetstore,
    header: { name: "Assetstore" }
  }
];

export const navigatorItems: {[key: string]: TypeNavigatorItem[]} = {
  bucket: [
    {_id: "3", title: "Profile", icon: "bucket", section: "bucket"},
    {_id: "4", title: "Security", icon: "lock", section: "bucket"}
  ]
};
