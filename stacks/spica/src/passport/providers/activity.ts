export function provideActivityFactory(activity: any) {
  let module = activity.resource.name;
  let documentId = activity.resource.documentId;
  let url;
  if (module == "Identity") {
    url = `passport/identity/${documentId}/edit`;
  } else if (module == "Policy") {
    url = `passport/policy/${documentId}/edit`;
  } else if (module == "Apikey") {
    url = `passport/apikey/${documentId}/edit`;
  } else if (module == "Preference" && documentId == "passport") {
    url = `passport/settings`;
  }
  return url;
}
