/**
 * Typings for database trigger
 * @trigger database
 */
declare namespace triggers.database {
  interface Changes {
    [index: string]: any;
  }
}
