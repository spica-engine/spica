export function provideActivityFactory(activity: any) {
  let url;
  if (activity.resource[0] == "storage") {
    url = activity.resource.length > 2 ? `storage` : `storage/${activity.resource[1]}`;
  }
  return url;
}
