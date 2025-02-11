export function provideActivityFactory(activity: any) {
  if (activity.action == 3) {
    return false;
  }

  let url;

  if (activity.resource[0] == "function") {
    url = `function/${activity.resource[1]}`;
  }

  return url;
}
