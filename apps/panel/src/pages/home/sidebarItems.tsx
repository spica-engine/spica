import type {TypeMenuItems, TypeNavigatorItem} from "../../types/sidebar";

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
    {_id: "1", title: "Overview", icon: "dashboard", section: "dashboard", link: "/dashboard/overview"},
    {_id: "2", title: "Analytics", icon: "dashboard", section: "dashboard", link: "/dashboard/analytics"}
  ],
  storage: [
    { _id: "5", title: "/", icon: "folder", section: "storage", link: "/storage" },
  ],
};
