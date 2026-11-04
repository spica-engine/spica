const compact = (sql: string) =>
  sql.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

/**
 * Compares SQL ignoring how it is laid out, so a test can write the statement it expects over
 * several lines, one clause per line.
 */
export function expectSql(actual: string, expected: string) {
  expect(compact(actual)).toBe(compact(expected));
}
