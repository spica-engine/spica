export function provideActivityFactory(activity: any) {
  let module = activity.resource.name;
  let documentId = activity.resource.documentId;
  let url;
  if (module == "Storage") {
    url = `storage/${documentId}`;
  }
  return url;
}
