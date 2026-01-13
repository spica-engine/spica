import type { IconName } from "oziko-ui-kit";
import type {TypeMenuItems, TypeNavigatorItem} from "../../types/sidebar";

export type SideBarItem = {
  id: string;
  name: string;
  icon: IconName;
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
]




export const getMenuItems = (navigate?: (path: string) => void): TypeMenuItems[] => [
  {
    id: "bucket",
    name: "Bucket",
    icon: "bucket",
    header: {
      name: "Tables",
      buttons: [
        {
          icon: "clockOutline",
          onClick: () => {}
        },
        {icon: "viewList", onClick: () => navigate?.("/diagram")}
      ]
    },
    addNewButtonText: "New Bucket"
  },
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "dashboard",
    header: {
      name: "Dashboards"
    }
  },
  {
    id: "storage",
    name: "Storage",
    icon: "storage",
    header: {
      name: "Storage"
    }
  },
  {
    id: "identity",
    name: "Identity",
    icon: "identities",
    header: {
      name: "Identity"
    }
  },
  {
    id: "function",
    name: "Function",
    icon: "function",
    header: {
      name: "Function"
    }
  },
  {
    id: "webhook",
    name: "Webhook",
    icon: "webhook",
    header: {
      name: "Webhook"
    }
  },
  {
    id: "assetstore",
    name: "Assetstore",
    icon: "assetstore",
    header: {
      name: "Assetstore"
    }
  }
];

export const menuItems: TypeMenuItems[] = getMenuItems();

export const navigatorItems: {[key: string]: TypeNavigatorItem[]} = {
  dashboard: [
    {_id: "1", title: "Overview", icon: "dashboard", section: "dashboard"},
    {_id: "2", title: "Analytics", icon: "dashboard", section: "dashboard"}
  ],
  bucket: [
    {_id: "3", title: "Profile", icon: "bucket", section: "bucket"},
    {_id: "4", title: "Security", icon: "lock", section: "bucket"}
  ]
};
