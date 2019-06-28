import {Default, Format, Keyword} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";

export const CREATED_AT: Default = {
  keyword: ":created_at",
  type: "date",
  create: data => {
    return data || new Date().toISOString();
  }
};

export const UPDATED_AT: Default = {
  keyword: ":updated_at",
  type: "date",
  create: () => {
    return new Date().toISOString();
  }
};

export const BUCKET_ID: Format = {
  name: "bucketid",
  type: "string",
  coerce: bucketId => {
    return new ObjectId(bucketId);
  },
  validate: bucketId => {
    try {
      return !!bucketId && !!new ObjectId(bucketId);
    } catch {
      return false;
    }
  }
};

export const CUSTOM_TYPES: Keyword = {
  name: "type",
  type: "string",
  macro: (schema, parentSchema) => {
    switch (schema) {
      case "storage":
      case "richtext":
      case "textarea":
        parentSchema["type"] = "string";
        return "string";
      case "relation":
        parentSchema["type"] = "string";
        parentSchema["format"] = "bucketid";
        return "string";
      case "date":
        parentSchema["type"] = "string";
        parentSchema["format"] = "date-time";
        return "string";
      case "location":
        parentSchema["type"] = "object";
        parentSchema["required"] = ["lat", "long"];
        parentSchema["properties"] = {
          lat: {
            title: "Latitude",
            type: "number",
            minimum: -90,
            maximum: 90
          },
          long: {
            title: "Longitude",
            type: "number",
            minimum: -180,
            maximum: 180
          }
        };
        return "object";
      default:
        return schema;
    }
  }
};
