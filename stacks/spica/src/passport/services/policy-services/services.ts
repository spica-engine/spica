import {of} from "rxjs";
import {Services} from "../../interfaces/service";

const paginationMap = <T>(res: {meta: number; data: T[]}) => {
  return res.data;
};

const asteriskMap = (primary: string) => {
  return (values: any[]) => values.concat({_id: "*", [primary]: "All Resources"});
};

const bucketResource = {
  title: "Bucket",
  source: "api:/bucket",
  primary: "title",
  requiredAction: "bucket:index",
  maps: [asteriskMap("title")]
};

const bucketDataResource = {title: "Bucket Data"};

const apikeyResource = {
  title: "Apikey",
  source: "api:/passport/apikey",
  primary: "name",
  requiredAction: "passport:apikey:index",
  maps: [paginationMap, asteriskMap("name")]
};

const policyResource = {
  title: "Policy",
  source: "api:/passport/policy",
  primary: "name",
  requiredAction: "passport:policy:index",
  maps: [paginationMap, asteriskMap("name")]
};

const identityResource = {
  title: "Identity",
  source: "api:/passport/identity",
  primary: "name",
  requiredAction: "passport:identity:index",
  maps: [asteriskMap("name")]
};

const strategyResource = {
  title: "Strategy",
  source: "api:/passport/strategy",
  primary: "title",
  requiredAction: "passport:strategy:index",
  maps: [asteriskMap("title")]
};

const dashboardResource = {
  title: "Dashboard",
  source: "api:/dashboard",
  primary: "name",
  requiredAction: "dashboard:index",
  maps: [asteriskMap("name")]
};

const functionResource = {
  title: "Function",
  source: "api:/function",
  primary: "name",
  requiredAction: "function:index",
  maps: [asteriskMap("name")]
};

const webhookResource = {
  title: "Webhook",
  source: "api:/webhook",
  primary: "url",
  requiredAction: "webhook:index",
  maps: [paginationMap, asteriskMap("url")]
};

const storageResource = {
  title: "Storage",
  source: "api:/storage",
  primary: "name",
  requiredAction: "storage:index",
  maps: [paginationMap, asteriskMap("url")]
};

const preferenceResource = {
  title: "Preference",
  primary: "title",
  source: of([{_id: "bucket", title: "Bucket"}, {_id: "passport", title: "Passport"}]),
  maps: [asteriskMap("title")]
};

const statusResource = {
  title: "Status",
  primary: "title",
  source: of([
    {_id: "bucket", title: "Bucket"},
    {_id: "identity", title: "Identity"},
    {_id: "storage", title: "Storage"},
    {_id: "function", title: "Function"},
    {_id: "api", title: "API"}
  ]),
  maps: [asteriskMap("title")]
};

export default {
  // ACTIVITY
  activity: {
    "activity:index": [],
    "activity:delete": []
  },
  // BUCKET
  bucket: {
    "bucket:index": [bucketResource],
    "bucket:show": [bucketResource],
    "bucket:create": [],
    "bucket:updated": [bucketResource],
    "bucket:delete": [bucketResource]
  },
  "bucket:data": {
    "bucket:data:index": [bucketResource, bucketDataResource],
    "bucket:data:show": [bucketResource, bucketDataResource],
    "bucket:data:create": [bucketResource],
    "bucket:data:update": [bucketResource, bucketDataResource],
    "bucket:data:delete": [bucketResource, bucketDataResource],
    "bucket:data:stream": [bucketResource, bucketDataResource]
  },
  // PASSPORT
  "passport:apikey": {
    "passport:apikey:index": [apikeyResource],
    "passport:apikey:show": [apikeyResource],
    "passport:apikey:create": [],
    "passport:apikey:update": [apikeyResource],
    "passport:apikey:delete": [apikeyResource]
  },
  "passport:apikey:policy": {
    "passport:apikey:policy:add": [apikeyResource, policyResource],
    "passport:apikey:policy:remove": [apikeyResource, policyResource]
  },
  "passport:identity": {
    "passport:identity:index": [identityResource],
    "passport:identity:show": [identityResource],
    "passport:identity:create": [],
    "passport:identity:update": [identityResource],
    "passport:identity:delete": [identityResource]
  },
  "passport:identity:policy": {
    "passport:identity:policy:add": [identityResource, policyResource],
    "passport:identity:policy:remove": [identityResource, policyResource]
  },
  "passport:policy": {
    "passport:policy:index": [policyResource],
    "passport:policy:show": [policyResource],
    "passport:policy:create": [],
    "passport:policy:update": [policyResource],
    "passport:policy:delete": [policyResource]
  },
  "passport:strategy": {
    "passport:strategy:index": [strategyResource],
    "passport:strategy:show": [strategyResource],
    "passport:strategy:update": [strategyResource],
    "passport:strategy:delete": [strategyResource]
  },
  // DASHBOARD
  dashboard: {
    "dashboard:index": [dashboardResource],
    "dashboard:show": [dashboardResource],
    "dashboard:create": [],
    "dashboard:update": [dashboardResource],
    "dashboard:delete": [dashboardResource]
  },
  // FUNCTION
  function: {
    "function:index": [functionResource],
    "function:show": [functionResource],
    "function:create": [],
    "function:update": [functionResource],
    "function:delete": [functionResource],
    "function:integrations": []
  },
  "function:logs": {
    "function:logs:index": [],
    "function:logs:delete": []
  },
  webhook: {
    "webhook:index": [webhookResource],
    "webhook:show": [webhookResource],
    "webhook:create": [],
    "webhook:update": [webhookResource],
    "webhook:delete": [webhookResource]
  },
  "webhook:logs": {
    "webhook:logs:index": [],
    "webhook:logs:delete": []
  },
  storage: {
    "storage:index": [storageResource],
    "storage:show:": [storageResource],
    "storage:create": [],
    "storage:update": [storageResource],
    "storage:delete": [storageResource]
  },
  preference: {
    "preference:show": [preferenceResource],
    "preference:update": [preferenceResource]
  },
  // STATUS
  status: {
    "status:index": [statusResource],
    "status:show": [statusResource]
  }
} as Services;
