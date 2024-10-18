export function provideAssetFactory(resource) {
  if (resource.module != "bucket") {
    return false;
  }

  return `buckets/${resource._id}`;
}
