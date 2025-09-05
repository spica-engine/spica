export const isObjectEffectivelyEmpty = (obj: any): boolean => {
  if (obj == null || typeof obj !== "object") return true;

  return Object.keys(obj).every(
    key =>
      obj[key] === undefined ||
      obj[key] === null ||
      obj[key] === "" ||
      (Array.isArray(obj[key]) && obj[key].length === 0) ||
      (typeof obj[key] === "object" && isObjectEffectivelyEmpty(obj[key]))
  );
};

export const cleanValue = (value: any, type: string) => {
  if (type === "location" && value) {
    return {type: "Point", coordinates: [value.lat, value.lng]};
  }

  if (type === "array") {
    return value?.length === 1 && value[0] === "" ? undefined : value;
  }

  if (type === "relation") {
    return value?.value;
  }

  if (type === "multiselect") {
    return value?.length === 0 ? undefined : value;
  }

  if (type === "object") {
    const cleanedObject = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        v === "" || (Array.isArray(v) && v.length === 0) ? undefined : v
      ])
    );
    return isObjectEffectivelyEmpty(cleanedObject) ? undefined : cleanedObject;
  }

  return value === "" ? undefined : value;
};

export const buildOptionsUrl = (bucketId: string, skip = 0, searchValue?: string) => {
  const base = `${import.meta.env.VITE_BASE_URL}/api/bucket/${bucketId}/data?paginate=true&relation=true&limit=25&sort=%7B%22_id%22%3A-1%7D`;
  const filter = searchValue
    ? `&filter=${encodeURIComponent(
        JSON.stringify({
          $or: [{title: {$regex: searchValue, $options: "i"}}]
        })
      )}`
    : "";

  return `${base}${filter}&skip=${skip}`;
};

export const findFirstErrorId = (
  errors: any,
  formattedProperties: any,
  prefix = ""
): string | null => {
  for (const [key, error] of Object.entries(errors)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const property = formattedProperties[key];

    if (typeof error === "string" && property?.id) {
      return property.id;
    } else if (typeof error === "object" && property?.properties) {
      const nestedId = findFirstErrorId(error, property.properties, fullKey);
      if (nestedId) return nestedId;
    }
  }
  return null;
};
