import {InstallationPreview, InstallationPreviewByModules, Resource} from "./interfaces";

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

  return separatedPreview
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