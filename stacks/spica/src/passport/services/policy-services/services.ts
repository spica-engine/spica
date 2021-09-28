import {of} from "rxjs";
import {Services} from "../../interfaces/service";

const paginationMap = <T>(res: {meta: number; data: T[]}) => {
  return res.data;
};

const asteriskMap = (values: any[]) => {
  return values.concat({_id: "*"});
};

const bucketSelectableResource = {
  title: "Bucket",
  source: "api:/bucket",
  primary: "title",
  maps: [asteriskMap]
};

const bucketDataResource = {title: "Bucket Data"};

const apikeySelectableResource = {
  title: "Apikey",
  source: "api:/passport/apikey",
  primary: "name",
  maps: [paginationMap, asteriskMap]
};

const policySelectableResource = {
  title: "Policy",
  source: "api:/passport/policy",
  primary: "name",
  maps: [paginationMap, asteriskMap]
};

const identitySelectableResource = {
  title: "Identity",
  source: "api:/passport/identity",
  primary: "name",
  maps: [asteriskMap]
};

const strategyResource = {
  title: "Strategy",
  source: "api:/passport/strategy",
  primary: "title",
  maps: [asteriskMap]
};

const dashboardResource = {
  title: "Dashboard",
  source: "api:/dashboard",
  primary: "name",
  maps: [asteriskMap]
};

const functionResource = {
  title: "Function",
  source: "api:/function",
  primary: "name",
  maps: [asteriskMap]
};

const webhookResource = {
  title: "Webhook",
  source: "api:/webhook",
  primary: "source",
  maps: [paginationMap, asteriskMap]
};

const storageResource = {
  title: "Storage",
  source: "api:/storage",
  primary: "name",
  maps: [paginationMap, asteriskMap]
};

const preferenceResource = {
  title: "Preference",
  source: of([{_id: "bucket"}, {_id: "passport"}]),
  maps: [asteriskMap]
};

export default {
  // ACTIVITY
  activity: {
    "activity:index": [],
    "activity:delete": []
  },
  // BUCKET
  bucket: {
    "bucket:index": [bucketSelectableResource],
    "bucket:show": [bucketSelectableResource],
    "bucket:create": [],
    "bucket:updated": [bucketSelectableResource],
    "bucket:delete": [bucketSelectableResource]
  },
  "bucket:data": {
    "bucket:data:index": [bucketSelectableResource, bucketDataResource],
    "bucket:data:show": [bucketSelectableResource, bucketDataResource],
    "bucket:data:create": [bucketSelectableResource],
    "bucket:data:update": [bucketSelectableResource, bucketDataResource],
    "bucket:data:delete": [bucketSelectableResource, bucketDataResource],
    "bucket:data:stream": [bucketSelectableResource, bucketDataResource]
  },
  // PASSPORT
  "passport:apikey": {
    "passport:apikey:index": [apikeySelectableResource],
    "passport:apikey:show": [apikeySelectableResource],
    "passport:apikey:create": [],
    "passport:apikey:update": [apikeySelectableResource],
    "passport:apikey:delete": [apikeySelectableResource]
  },
  "passport:apikey:policy": {
    "passport:apikey:policy:add": [apikeySelectableResource, policySelectableResource],
    "passport:apikey:policy:remove": [apikeySelectableResource, policySelectableResource]
  },
  "passport:identity": {
    "passport:identity:index": [identitySelectableResource],
    "passport:identity:show": [identitySelectableResource],
    "passport:identity:create": [],
    "passport:identity:update": [identitySelectableResource],
    "passport:identity:delete": [identitySelectableResource]
  },
  "passport:identity:policy": {
    "passport:identity:policy:add": [identitySelectableResource, policySelectableResource],
    "passport:identity:policy:remove": [identitySelectableResource, policySelectableResource]
  },
  "passport:policy": {
    "passport:policy:index": [policySelectableResource],
    "passport:policy:show": [policySelectableResource],
    "passport:policy:create": [],
    "passport:policy:update": [policySelectableResource],
    "passport:policy:delete": [policySelectableResource]
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
  }
} as Services;
