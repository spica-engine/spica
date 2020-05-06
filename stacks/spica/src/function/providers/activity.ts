export function provideActivityFactory(activity: any) {
  let url;
  if (activity.resource[0] == "function") {
    url = `function/${activity.resource[1]}`;
  }
  return url;
}
