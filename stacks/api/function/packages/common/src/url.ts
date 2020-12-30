export function buildUrl(baseUrl: string, queryParams: object = {}): URL {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(queryParams)) {
    let encodedValue = encodeURIComponent(value);

    if (typeof value == "object") {
      encodedValue = JSON.stringify(value);
    }

    url.searchParams.set(key, encodedValue);
  }

  return url;
}
