import {BadRequestException, DatabaseException} from "@spica-server/bucket-common";
import {BucketMetadata, constraintName, TableMetadata} from "../schema/index.js";

export type WriteOperation = "write" | "delete";

interface ConstraintError {
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  message: string;
}

const NOT_NULL = "23502";
const FOREIGN_KEY = "23503";
const UNIQUE = "23505";
const CHECK = "23514";

const pathOf = (table: TableMetadata | undefined, columnName: string | undefined) =>
  table?.columns.find(column => column.name == columnName)?.path.join(".");

function uniquePath(table: TableMetadata | undefined, constraint: string | undefined) {
  const index = table?.indexes.find(candidate => candidate.name == constraint);
  if (index) {
    return pathOf(table, index.columns[0].name);
  }
  const isKey = table && constraintName(table.name, table.keyColumns, "pk") == constraint;
  return isKey ? pathOf(table, table.keyColumns[0]) : undefined;
}

function referencePath(table: TableMetadata | undefined, constraint: string | undefined) {
  const reference = table?.foreignKeys.find(candidate => candidate.name == constraint);
  return pathOf(table, reference?.column);
}

function checkedPath(table: TableMetadata | undefined, constraint: string | undefined) {
  return table?.columns.find(column => column.checkName == constraint)?.path.join(".");
}

export function translateWriteError(
  error: unknown,
  metadata: BucketMetadata,
  operation: WriteOperation
): unknown {
  const {code, constraint, column, message, table: tableName} = (error ?? {}) as ConstraintError;
  if (typeof code != "string" || !(code.startsWith("22") || code.startsWith("23"))) {
    return error;
  }

  const table = metadata.tables.find(candidate => candidate.name == tableName);

  switch (code) {
    case UNIQUE: {
      const path = uniquePath(table, constraint);
      if (path) {
        return new BadRequestException(
          `Value of the property .${path} should unique across all documents.`
        );
      }
      break;
    }
    case FOREIGN_KEY: {
      if (operation == "delete") {
        return new BadRequestException(
          "The document is referenced by a required property of another document and cannot be deleted."
        );
      }
      const path = referencePath(table, constraint);
      return new BadRequestException(
        path
          ? `The property .${path} refers to a document that does not exist.`
          : "A referenced document does not exist."
      );
    }
    case NOT_NULL: {
      const path = pathOf(table, column);
      if (path) {
        return new BadRequestException(`The property .${path} is required.`);
      }
      break;
    }
    case CHECK: {
      const path = checkedPath(table, constraint);
      if (path) {
        return new BadRequestException(`The property .${path} has a value that is not allowed.`);
      }
      break;
    }
  }
  return new DatabaseException(message);
}
