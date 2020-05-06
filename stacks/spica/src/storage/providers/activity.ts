export function provideActivityFactory(activity: any) {
  let url;
  if (activity.resource[0] == "storage") {
    url = `storage/${activity.resource[1]}`;
  }
  return url;
}
