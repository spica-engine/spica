/**
 * Typings for database trigger
 * @trigger database
 */
declare namespace triggers.database {
  export interface Change {
    /**
     * The type of operation that occurred
     */
    operationType: "insert" | "update" | "replace" | "delete" | "drop" | "rename" | "dropDatabase";
    /**
     * The document created or modified by the insert, replace, delete, update operations (i.e. CRUD operations).
     * For insert and replace operations, this represents the new document created by the operation.
     * For delete operations, this field is omitted as the document no longer exists.
     * For update operations, this field only appears if you configured the change stream with fullDocument set to updateLookup.
     * This field then represents the most current majority-committed version of the document modified by the update operation.
     * This document may differ from the changes described in updateDescription if other majority-committed operations modified the document between the original update operation and the full document lookup.
     */
    fullDocument: {[index: string]: any} | null;
    /**
     * The namespace (database and or collection) affected by the event.
     */
    ns: {
      /**
       * 	The name of the database.
       */
      db: string;
      /**
       * The name of the collection.
       * For dropDatabase operations, this field is omitted.
       */
      coll: string;
    };
    /**
     * A document that contains the _id of the document created or modified by the insert, replace, delete, update operations (i.e. CRUD operations).
     */
    documentKey: {_id: any};
    /**
     * A document describing the fields that were updated or removed by the update operation.
     * This document and its fields only appears if the operationType is update.
     */
    updateDescription?: {
      /**
       * 	A document whose keys correspond to the fields that were modified by the update operation. The value of each field corresponds to the new value of those fields, rather than the operation that resulted in the new value.
       */
      updatedFields: {[index: string]: any};
      /**
       * An array of fields that were removed by the update operation.
       */
      removedFields: Array<string>;
    };
  }
}
