import fs from "fs";

export function pathExists(target: string): Promise<boolean> {
  return fs.promises.lstat(target).then(
    () => true,
    () => false
  );
}
