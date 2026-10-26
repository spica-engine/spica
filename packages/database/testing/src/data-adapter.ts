import {DataAdapter} from "@spica-server/data";

// The root jest setup registers the adapter under this key. Importing the adapter package here
// would create a project reference cycle: it depends on libraries whose tests import this package.
const TESTING_DATA_ADAPTER = Symbol.for("SPICA_TESTING_DATA_ADAPTER");

export function testingDataAdapter(): DataAdapter {
  const factory: (() => DataAdapter) | undefined = globalThis[TESTING_DATA_ADAPTER];
  if (!factory) {
    throw new Error("No testing data adapter is registered. Register one in the jest setup.");
  }
  return factory();
}
