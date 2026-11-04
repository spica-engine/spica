import {DuplicateKeyError} from "@spica-server/data";

const DUPLICATE_KEY = 11000;

export function translateWriteError(error: any): never {
  if (error?.code === DUPLICATE_KEY) {
    throw new DuplicateKeyError(error.message, error.keyValue, error);
  }
  throw error;
}
