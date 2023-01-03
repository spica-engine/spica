import {Config, InstallationPreview, InstallationPreviewByModules, Resource} from "./interfaces";

export function separatePreviewResourcesByModule(
  preview: InstallationPreview
): InstallationPreviewByModules {
  const separatedPreview = {};
  const pushToPreview = (resource: Resource, action: "insertions" | "updations" | "deletions") => {
    separatedPreview[resource.module] = separatedPreview[resource.module] || getEmptyPreview();
    separatedPreview[resource.module][action].push(resource);
  };

  preview.insertions.forEach(resource => pushToPreview(resource, "insertions"));
  preview.updations.forEach(resource => pushToPreview(resource, "updations"));
  preview.deletions.forEach(resource => pushToPreview(resource, "deletions"));

  return separatedPreview;
}

export function getEmptyPreview(): InstallationPreview {
  return {
    insertions: [],
    updations: [],
    deletions: []
  };
}

export function displayPreview(resources: any[]) {
  const data = JSON.stringify(resources, null, 2);
  const x = window.open();
  x.document.open();
  x.document.write("<html><body><pre>" + data + "</pre></body></html>");
  x.document.close();
}

// export const getModuleConfigSchema = module => {
//   const schemas = [
//     {
//       module: "function",
//       schema: {
//         resource_id: {
//           type: "string",
//           title: "Resource Id",
//           description: "Select one of these resource ids",
//           enum: ["6398364b2b16efb47b26486c"],
//           viewEnum: ["test"]
//         },
//         submodule: {
//           type: "string",
//           title: "Sub-Module",
//           description: "Select one of these sub modules",
//           enum: ["schema", "package", "index", "env"],
//           viewEnum: ["Schema", "Dependencies", "Index", "Environment"]
//         }
//       }
//     },
//     {
//       module: "bucket",
//       schema: {
//         resource_id: {
//           type: "string",
//           title: "Resource Id",
//           description: "Select one of these resource ids",
//           enum: ["639836422b16efb47b264868"],
//           viewEnum: ["New Bucket"]
//         },
//         submodule: {
//           type: "string",
//           title: "Sub-Module",
//           description: "Select one of these sub modules",
//           enum: ["schema"],
//           viewEnum: ["Schema"]
//         }
//       }
//     },
//     {
//       module: "preference",
//       schema: {
//         resource_id: {
//           type: "string",
//           title: "Resource Id",
//           description: "Select one of these resource ids",
//           enum: ["identity"],
//           viewEnum: ["Identity"]
//         },
//         submodule: {
//           type: "string",
//           title: "Sub-Module",
//           description: "Select one of these sub modules",
//           enum: ["schema"],
//           viewEnum: ["Schema"]
//         }
//       }
//     }
//   ];

//   return schemas.find(s => (s.module = module));
// };

// export const getConfigSchema = () => {
//   return {
//     title: {
//       type: "string",
//       title: "Title",
//       description:
//         "It will be displayed on the configuration step while others installing this asset."
//     },
//     module: {
//       type: "string",
//       title: "Module",
//       description: "Select one of these modules",
//       // backend should set this
//       enum: ["bucket", "function", "preference"]
//     },
//     resource_id: {
//       type: "string",
//       title: "Resource Id",
//       description: "Select one of these resource ids"
//     },
//     submodule: {
//       type: "string",
//       title: "Sub-Module",
//       description: "Select one of these sub modules"
//     },
//     property: {
//       type: "string",
//       title: "Property",
//       description:
//         "Property target of the configuration will affect. Use dot(.) for nested properties"
//     },
//     value: {
//       type: "string",
//       title: "Value",
//       description:
//         "Value of the configuration that will be replaced with the value of matched property."
//     },
//     type: {
//       type: "string",
//       title: "Value Type",
//       description: "Select one of these types",
//       enum: ["number", "string", "boolean", "object", "array"]
//     }
//   };
// };

// export function getEmptyConfig() {
//   const config: any = {};
//   Object.entries(getConfigSchema()).forEach(([k]) => {
//     config[k] = undefined;
//   });
//   return config;
// }

// export function getEmptyExportResources() {
//   const res = [];
//   Object.keys(getExportResourceSchema()).forEach(mod => {
//     res.push({module: mod, ids: []});
//   });
//   return res;
// }

// export function getExportResourceSchema() {
//   return {
//     bucket: [{id: "639836422b16efb47b264868", title: "New Bucket"}],
//     function: [{id: "6398364b2b16efb47b26486c", title: "test"}],
//     preference: [{id: "identity", title: "Identity"}]
//   };
// }

export function getEmptyConfig() {
  return {
    title: undefined,
    module: undefined,
    submodule: undefined,
    resource_id: undefined,
    property: undefined,
    type: undefined,
    value: undefined
  };
}
