import type { TypeMenuItems, TypeNavigatorItems } from "../../components/organisms/sidebar/SideBar";

export const menuItems: TypeMenuItems[] = [
  {
    id: "bucket",
    name: "Bucket",
    icon: "bucket",
    header: {
      name: "Tables",
      buttons: [{
        icon: "clockOutline",
        onClick: () => { }
      }]
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
  },
];

export const navigatorItems: { [key: string]: TypeNavigatorItems[] } = {
  dashboard: [
    { _id: "1", title: "Overview", icon: "dashboard", section: "dashboard" },
    { _id: "2", title: "Analytics", icon: "dashboard", section: "dashboard" }
  ],
  bucket: [
    { _id: "3", title: "Profile", icon: "bucket", section: "bucket" },
    { _id: "4", title: "Security", icon: "lock", section: "bucket" }
  ]
};