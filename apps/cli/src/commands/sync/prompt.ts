import readline from "readline";
import {Writable} from "stream";

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

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const input = Buffer.concat(chunks).toString("utf-8");
  if (!input) throw new Error("No value received on stdin.");
  return input.replace(/\r?\n$/, "");
}

function mutedOutput(): Writable {
  return new Writable({write: (_chunk, _encoding, done) => done()});
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: mutedOutput(),
    terminal: true
  });
  process.stdout.write(question);

  return new Promise((resolve, reject) =>
    rl.question("", answer => {
      rl.close();
      process.stdout.write("\n");
      if (answer) resolve(answer);
      else reject(new Error("No value entered."));
    })
  );
}

export function readSecret(question: string): Promise<string> {
  return process.stdin.isTTY ? ask(question) : readStdin();
}
