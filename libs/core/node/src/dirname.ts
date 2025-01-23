// Designed for manipulating dirname for different environments when necessary
// for example jest tests should use build dirname, not source code.
export function dirname(actualDirname: string) {
  return actualDirname;
}
