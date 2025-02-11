export function provideActivityFactory(activity: any) {
  if (activity.action == 3) {
    return false;
  }

  let module = activity.resource[0];
  let subModule = activity.resource[1];
  let documentId = activity.resource[2];
  let url;
  if (module == "passport") {
    url = `passport/${subModule}/${documentId}/edit`;
  } else if (module == "preference" && subModule == "passport") {
    url = `passport/settings`;
  }
  return url;
}
