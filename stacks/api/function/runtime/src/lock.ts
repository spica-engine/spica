import * as child_process from "child_process";

const locks = new Map<string, Promise<void>>();
export function acquire(name: string, version: string, command: string, cwd: string) {
  const lockKey = `${name}@${version}`;

  if (!locks.has(lockKey)) {
    locks.set(
      lockKey,
      new Promise((resolve, reject) => {
        child_process.exec(
          command,
          {
            cwd,
            env: {
              VERSION: version
            }
          },
          error => {
            if (error) {
              return reject(error);
            }
            resolve();
          }
        );
      })
    );
  }
  return locks.get(lockKey);
}
