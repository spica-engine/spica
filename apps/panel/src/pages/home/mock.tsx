import type {TypeMenuItems, TypeNavigatorItems} from "oziko-ui-kit";

export const menuItems: TypeMenuItems[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "dashboard"
  },
  {
    id: "assetstore",
    name: "Assetstore",
    icon: "assetstore"
  },
  {
    id: "bucket",
    name: "Bucket",
    icon: "bucket"
  },
  {
    id: "identity",
    name: "Identity",
    icon: "identities"
  },
  {
    id: "function",
    name: "Function",
    icon: "function"
  },
  {
    id: "webhook",
    name: "Webhook",
    icon: "webhook"
  },
  {
    id: "storage",
    name: "Storage",
    icon: "storage"
  }
];

export const navigatorItems: {[key: string]: TypeNavigatorItems[]} = {
  dashboard: [
    {_id: "1", title: "Overview", icon: "dashboard"},
    {_id: "2", title: "Analytics", icon: "dashboard"}
  ],
  bucket: [
    {_id: "3", title: "Profile", icon: "bucket"},
    {_id: "4", title: "Security", icon: "lock"}
  ]
};

export const name = "Spica";
export const token = "PlaceholderJWT123";
