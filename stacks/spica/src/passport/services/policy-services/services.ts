import {of} from "rxjs";
import {Services} from "../../interfaces/service";

const bucketSelectableResource = {
  title: "Bucket",
  url: "api:/bucket",
  primary: "title"
};

const bucketDataResource = {title: "Bucket Data"};

const apikeySelectableResource = {
  title: "Apikey",
  url: "api:/passport/apikey",
  primary: "name"
};

const policySelectableResource = {
  title: "Policy",
  url: "api:/passport/policy",
  primary: "name"
};

const identitySelectableResource = {
  title: "Identity",
  url: "api:/passport/identity",
  primary: "name"
};

const strategyResource = {
  title: "Strategy",
  url: "api:/passport/strategy",
  primary: "title"
};

const dashboardResource = {
  title: "Dashboard",
  url: "api:/dashboard",
  primary: "name"
};

const functionResource = {
  title: "Function",
  url: "api:/function",
  primary: "name"
};

const webhookResource = {
  title: "Webhook",
  url: "api:/webhook",
  primary: "url"
};

const storageResource = {
  title: "Storage",
  url: "api:/storage",
  primary: "name"
};

const preferenceResource = {
  title: "Preference",
  values: of([{_id: "bucket"}, {_id: "passport"}, {_id: "*"}])
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
    "bucket:create": []
  },
  "bucket:data": {
    "bucket:data:show": [bucketSelectableResource, bucketDataResource],
    "bucket:data:create": [bucketSelectableResource, bucketDataResource],
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
