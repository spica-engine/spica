import type { IconName } from "oziko-ui-kit";
import type {TypeMenuItems, TypeNavigatorItem} from "../../types/sidebar";

export type SideBarItem = {
  id: string;
  name: string;
  icon: IconName;
  position?: "bottom";
  route?: string;
};

export const sideBarItems: SideBarItem[]=  [
  {
    id: "bucket",
    name: "Bucket",
    icon: "bucket",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "dashboard",
  },
 
  {
    id: "storage",
    name: "Storage",
    icon: "storage",
  },
  {
    id: "accessManagement",
    name: "Access Management",
    icon: "identities",
  },
  {
    id: "function",
    name: "Function",
    icon: "function",
  },
  {
    id: "webhook",
    name: "Webhook",
    icon: "webhook",
  },
  {
    id: "config",
    name: "Configuration",
    icon: "cog",
  },
  {
    id: "observability",
    name: "Observability",
    icon: "security",
  },
  {
    id: "versionControl",
    name: "Version Control",
    icon: "forkRight",
    position: "bottom",
    route: "/version-control",
  },
]

type MenuItemMeta = {
  headerName?: string;
  addNewButtonText?: string;
  buttons?: (navigate?: (path: string) => void) => {icon: IconName; onClick: () => void}[];
};

const menuItemMeta: Record<string, MenuItemMeta> = {
  bucket: {
    headerName: "Tables",
    addNewButtonText: "New Bucket",
    buttons: (navigate) => [
      {icon: "clockOutline", onClick: () => {}},
      {icon: "viewList", onClick: () => navigate?.("/diagram")}
    ]
  },
  dashboard: {
    headerName: "Dashboards",
    addNewButtonText: "New Dashboard"
  },
  storage: {headerName: "Storage"},
  identity: {headerName: "Identity"},
  function: {headerName: "Function"},
  webhook: {headerName: "Webhook"},
  assetstore: {headerName: "Assetstore"}
};

const menuItemIds: string[] = [
  "bucket", "dashboard", "storage", "identity", "function", "webhook", "assetstore"
];

const sideBarItemsById = new Map(sideBarItems.map(item => [item.id, item]));

const extraMenuItems: {id: string; name: string; icon: IconName}[] = [
  {id: "identity", name: "Identity", icon: "identities"},
  {id: "assetstore", name: "Assetstore", icon: "assetstore"}
];
const extraMenuItemsById = new Map(extraMenuItems.map(item => [item.id, item]));

export const getMenuItems = (navigate?: (path: string) => void): TypeMenuItems[] =>
  menuItemIds.map(id => {
    const sideBarItem = sideBarItemsById.get(id);
    const extra = extraMenuItemsById.get(id);
    const source = sideBarItem ?? extra;
    const meta = menuItemMeta[id];
    if (!source || !meta) return null;

    const item: TypeMenuItems = {
      id: source.id,
      name: source.name,
      icon: source.icon,
      header: {
        name: meta.headerName,
        ...(meta.buttons ? {buttons: meta.buttons(navigate)} : {})
      },
      ...(meta.addNewButtonText ? {addNewButtonText: meta.addNewButtonText} : {})
    };
    return item;
  }).filter((item): item is TypeMenuItems => item !== null);

export const menuItems: TypeMenuItems[] = getMenuItems();

export const navigatorItems: {[key: string]: TypeNavigatorItem[]} = {
  bucket: [
    {_id: "3", title: "Profile", icon: "bucket", section: "bucket"},
    {_id: "4", title: "Security", icon: "lock", section: "bucket"}
  ]
};
