export function provideActivityFactory(activity: any) {
  if (activity.action == 3) {
    return false;
  }

  let url;
  let module = activity.resource[0];

  if (module == "bucket") {
    let bucketId = activity.resource[1];
    if (activity.resource[2] == "data") {
      url = `bucket/${bucketId}/${activity.resource[3]}`;
    } else {
      url = `buckets/${bucketId}`;
    }
  } else if (module == "preference" && activity.resource[1] == "bucket") {
    url = `buckets/settings`;
  }

  return url;
}
