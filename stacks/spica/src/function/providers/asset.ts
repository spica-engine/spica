export function provideAssetFactory(resource) {
  if (resource.module != "function") {
    return false;
  }

  return `function/${resource._id}`;
}
