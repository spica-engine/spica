import {ColumnDefinition, Resource, ResourceDefinitionVersion} from "./definition";

export function acceptsTable(accepts: string | undefined): string | undefined {
  if (!accepts) {
    return undefined;
  }

  const result = /application\/json;as=Table;v=([a-zA-Z0-9]+),?/.exec(accepts);
  if (!result) {
    return undefined;
  }
  return result[1];
}

export interface Row {
  cells: {
    [k: string]: any;
  };
}

// TODO: handle version
export function table(
  data: Iterable<Resource<unknown, unknown>>,
  version: ResourceDefinitionVersion
) {
  const columnDefinitions: ColumnDefinition[] = [
    {
      name: "NAME",
      description: "Name of the object",
      jsonPath: ".metadata.name",
      priority: 0,
      type: "string"
    },
    {
      name: "AGE",
      description: "Age of the object",
      jsonPath: ".metadata.creationTimestamp",
      priority: 1,
      type: "date"
    }
  ];
  const rows: Row[] = [];

  if (version.additionalPrinterColumns) {
    columnDefinitions.push(...version.additionalPrinterColumns);
  }

  for (const object of data) {
    rows.push({
      cells: object
    });
  }

  return {
    kind: "Table",
    apiVersion: "v1",
    columnDefinitions: columnDefinitions.sort((a, b) => {
      return (
        (typeof a.priority == "number" ? a.priority : 1) -
        (typeof b.priority == "number" ? b.priority : 1)
      );
    }),
    rows
  };
}
