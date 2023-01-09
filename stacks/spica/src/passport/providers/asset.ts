export function provideAssetFactory(resource) {
  if (!(resource.module == "preference" && resource._id == "identity")) {
    return false;
  }

  return "passport/settings";
}
