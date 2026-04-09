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
    id: "versionControl",
    name: "Version Control",
    icon: "forkRight",
    position: "bottom",
    route: "/version-control",
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
    },
    addNewButtonText: "New Dashboard"
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
  bucket: [
    {_id: "3", title: "Profile", icon: "bucket", section: "bucket"},
    {_id: "4", title: "Security", icon: "lock", section: "bucket"}
  ]
};
