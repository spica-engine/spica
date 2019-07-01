import {Keyword} from "@spica-server/core/schema";

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
