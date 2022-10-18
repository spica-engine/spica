import {ActionParameters, Command, CreateCommandParameters} from "@caporal/core";
import * as jsonpath from "jsonpath";
import * as duration from "pretty-ms";
import {httpService} from "../../http";
import {formatFailureStatus, isFailureStatus} from "../../status";

async function get({args}: ActionParameters) {
  const machineryClient = await httpService.createFromCurrentCtx();
  const groupList = await machineryClient.get<any>("/apis-info");
  const kind = args.kind as string;

  for (const group of groupList.groups) {
    // TODO: get this from the API
    const preferredVersion = group.versions[0];
    const resourceList = await machineryClient.get<any>(`/apis-info/${group.name}/${preferredVersion}`);

    for (const resource of resourceList.resources) {
      if (
        kind == "all" ||
        resource.singular == kind ||
        resource.plural == kind ||
        resource.shortNames.indexOf(kind) != -1
      ) {
        const {rows, columns} = await printTable(
          machineryClient,
          `${group.name}/${preferredVersion}`,
          resource
        );
        if (kind == "all") {
          console.log(`${resource.plural.toLocaleUpperCase()}`);
        }
        console.table(rows, columns);

        if (kind != "all") {
          return;
        } else {
          console.log("\n");
        }
      }
    }
  }

  if (kind !== "all") {
    console.error(`the server has no resource with kind ${kind}`);
  }
}

async function printTable(client: httpService.Client, groupVersion, resource) {
  const table = await client.get<any>(`/apis/${groupVersion}/${resource.plural}`, {
    headers: {
      Accept: "application/json;as=Table;v=1"
    }
  });

  if (isFailureStatus(table)) {
    console.error(formatFailureStatus(table));
    return Promise.reject();
  }

  const rows = [];
  const columns = [];

  for (const column of table.columnDefinitions) {
    // TODO: rethink about this
    column.name = column.name.toLocaleUpperCase();
    columns.push(column.name);
  }

  for (const row of table.rows) {
    const data: any = {};

    for (const column of table.columnDefinitions) {
      const rawCellData = jsonpath.query(row.cells, `$${column.jsonPath}`);

      switch (column.type) {
        case "string":
          data[column.name] = rawCellData;
          break;
        case "date":
          data[column.name] = duration(Date.now() - new Date(rawCellData).getTime(), {
            compact: true
          });
          break;
        default:
          throw new Error(`unhandled type ${column.type}`);
      }

      switch (column.format) {
        case "password":
          data[column.name] = rawCellData.map(data => hideText(data ? String(data) : data));
          break;

        case undefined:
          break;

        default:
          throw new Error(`unhandled format ${column.format}`);
      }
    }

    rows.push(data);
  }

  return {rows, columns};
}

function hideText(text: string) {
  return new Array(Math.min(text.length, 10)).fill("*").join(" ");
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Get an object from the API.")
    .argument("<kind>", "Kind of the object")
    .argument("[name]", "Name of the object")
    .option("-n, --namespace", "Namespace of the object.")
    .action(get);
}
