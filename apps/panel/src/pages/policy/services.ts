/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { ApiStatementsResponse, ApiResource } from "./mapApiStatementsToCatalog";

// Resource definitions
const bucketResource: ApiResource = {
  title: "Bucket",
  source: "api:/bucket",
  primary: "title",
  requiredAction: "bucket:index",
};

const bucketDataResource: ApiResource = {
  title: "Bucket Data",
};

const apikeyResource: ApiResource = {
  title: "Apikey",
  source: "api:/passport/apikey",
  primary: "name",
  requiredAction: "passport:apikey:index",
};

const policyResource: ApiResource = {
  title: "Policy",
  source: "api:/passport/policy",
  primary: "name",
  requiredAction: "passport:policy:index",
};

const identityResource: ApiResource = {
  title: "Identity",
  source: "api:/passport/identity",
  primary: "name",
  requiredAction: "passport:identity:index",
};

const strategyResource: ApiResource = {
  title: "Strategy",
  source: "api:/passport/strategy",
  primary: "title",
  requiredAction: "passport:strategy:index",
};

const dashboardResource: ApiResource = {
  title: "Dashboard",
  source: "api:/dashboard",
  primary: "name",
  requiredAction: "dashboard:index",
};

const functionResource: ApiResource = {
  title: "Function",
  source: "api:/function",
  primary: "name",
  requiredAction: "function:index",
};

const webhookResource: ApiResource = {
  title: "Webhook",
  source: "api:/webhook",
  primary: "url",
  requiredAction: "webhook:index",
};

const storageResource: ApiResource = {
  title: "Storage",
  source: "api:/storage",
  primary: "name",
  requiredAction: "storage:index",
};

const preferenceResource: ApiResource = {
  title: "Preference",
  primary: "title",
};

const statusResource: ApiResource = {
  title: "Status",
  primary: "title",
};

// Services catalog
export const servicesData: ApiStatementsResponse = {
  // ASSET
  apis: {
    title: "Asset",
    actions: {
      "apis:index": [],
      "apis:create": [],
      "apis:update": [],
      "apis:delete": [],
    },
  },
  // ACTIVITY
  activity: {
    title: "Activity",
    actions: {
      "activity:index": [],
      "activity:delete": [],
    },
  },
  // BUCKET
  bucket: {
    title: "Bucket",
    actions: {
      "bucket:index": [bucketResource],
      "bucket:show": [bucketResource],
      "bucket:create": [],
      "bucket:update": [bucketResource],
      "bucket:delete": [bucketResource],
    },
  },
  "bucket:data": {
    title: "Bucket Data",
    actions: {
      "bucket:data:index": [bucketResource, bucketDataResource],
      "bucket:data:show": [bucketResource, bucketDataResource],
      "bucket:data:create": [bucketResource],
      "bucket:data:update": [bucketResource, bucketDataResource],
      "bucket:data:delete": [bucketResource, bucketDataResource],
      "bucket:data:stream": [bucketResource, bucketDataResource],
    },
  },
  // PASSPORT
  "passport:apikey": {
    title: "Apikey",
    actions: {
      "passport:apikey:index": [apikeyResource],
      "passport:apikey:show": [apikeyResource],
      "passport:apikey:create": [],
      "passport:apikey:update": [apikeyResource],
      "passport:apikey:delete": [apikeyResource],
    },
  },
  "passport:apikey:policy": {
    title: "Apikey's Policy",
    actions: {
      "passport:apikey:policy:add": [apikeyResource, policyResource],
      "passport:apikey:policy:remove": [apikeyResource, policyResource],
    },
  },
  "passport:identity": {
    title: "Identity",
    actions: {
      "passport:identity:index": [identityResource],
      "passport:identity:show": [identityResource],
      "passport:identity:create": [],
      "passport:identity:update": [identityResource],
      "passport:identity:delete": [identityResource],
    },
  },
  "passport:identity:policy": {
    title: "Identity's Policy",
    actions: {
      "passport:identity:policy:add": [identityResource, policyResource],
      "passport:identity:policy:remove": [identityResource, policyResource],
    },
  },
  "passport:policy": {
    title: "Policy",
    actions: {
      "passport:policy:index": [policyResource],
      "passport:policy:show": [policyResource],
      "passport:policy:create": [],
      "passport:policy:update": [policyResource],
      "passport:policy:delete": [policyResource],
    },
  },
  "passport:strategy": {
    title: "Authentication Strategy",
    actions: {
      "passport:strategy:index": [strategyResource],
      "passport:strategy:show": [strategyResource],
      "passport:strategy:update": [strategyResource],
      "passport:strategy:delete": [strategyResource],
    },
  },
  // DASHBOARD
  dashboard: {
    title: "Dashboard",
    actions: {
      "dashboard:index": [dashboardResource],
      "dashboard:show": [dashboardResource],
      "dashboard:create": [],
      "dashboard:update": [dashboardResource],
      "dashboard:delete": [dashboardResource],
    },
  },
  // FUNCTION
  function: {
    title: "Function",
    actions: {
      "function:index": [functionResource],
      "function:show": [functionResource],
      "function:create": [],
      "function:update": [functionResource],
      "function:delete": [functionResource],
      "function:integrations": [],
    },
  },
  "function:logs": {
    title: "Function Logs",
    actions: {
      "function:logs:index": [],
      "function:logs:delete": [],
    },
  },
  webhook: {
    title: "Webhook",
    actions: {
      "webhook:index": [webhookResource],
      "webhook:show": [webhookResource],
      "webhook:create": [],
      "webhook:update": [webhookResource],
      "webhook:delete": [webhookResource],
    },
  },
  "webhook:logs": {
    title: "Webhook Logs",
    actions: {
      "webhook:logs:index": [],
      "webhook:logs:delete": [],
    },
  },
  storage: {
    title: "Storage",
    actions: {
      "storage:index": [storageResource],
      "storage:show:": [storageResource],
      "storage:create": [],
      "storage:update": [storageResource],
      "storage:delete": [storageResource],
    },
  },
  preference: {
    title: "Preference",
    actions: {
      "preference:show": [preferenceResource],
      "preference:update": [preferenceResource],
    },
  },
  // STATUS
  status: {
    title: "Status",
    actions: {
      "status:index": [statusResource],
      "status:show": [statusResource],
    },
  },
};
