export function provideActivityFactory(activity: any) {
  if (activity.action == 3) {
    return false;
  }

  let url;

  if (activity.resource[0] == "storage") {
    url = `storage/${activity.resource[1]}`;
  }

  return url;
}
