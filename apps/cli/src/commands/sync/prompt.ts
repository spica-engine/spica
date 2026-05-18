import readline from "readline";

/**
 * Ask a yes/no question on stdin/stdout.
 * Returns true if the user types "y" or "yes" (case-insensitive), false otherwise.
 */
export async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  return new Promise(resolve => {
    rl.question(`${question} [y/N] `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}
