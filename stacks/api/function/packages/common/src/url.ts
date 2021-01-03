export function buildUrl(baseUrl: string, queryParams: object = {}): URL {
  const url = new URL(baseUrl);

  for (let [key, value] of Object.entries(queryParams)) {
    if (typeof value != "string") {
      value = JSON.stringify(value);
    }

    url.searchParams.set(key, value);
  }

  return url;
}
