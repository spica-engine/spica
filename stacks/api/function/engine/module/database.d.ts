/**
 * Internal Database module
 */
declare module "@internal/database" {
  interface Database {
    [key: string]: any;
    collection(name: string): Collection;
  }
  interface Collection {
    [key: string]: any;
  }
  /**
   * Returns the instance of current database
   */
  export function database(): Database;
  /**
   * Convert string into object id
   * @param id Id will that will be converted to objectid
   */
  export function objectId(id?: string | number): any;
}
