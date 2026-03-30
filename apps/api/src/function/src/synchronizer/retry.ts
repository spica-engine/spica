import {FunctionService} from "@spica-server/function/services";
import {Function} from "@spica-server/interface/function";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionSyncRetry");

const MAX_RETRIES = 5;
const INITIAL_DELAY_SECONDS = 2;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function findFunctionBySlugWithRetry(
  fs: FunctionService,
  slug: string,
  retryIndex = 0
): Promise<Function> {
  const fn = await fs.findOne({name: slug});
  if (fn) return fn;

  if (retryIndex >= MAX_RETRIES) {
    throw new Error(`Function with name "${slug}" not found after ${MAX_RETRIES} retries`);
  }

  const delayMs = Math.pow(INITIAL_DELAY_SECONDS, retryIndex + 1) * 1000;
  logger.warn(
    `Function "${slug}" not found, retrying in ${delayMs}ms (attempt ${retryIndex + 1}/${MAX_RETRIES})`
  );
  await delay(delayMs);
  return findFunctionBySlugWithRetry(fs, slug, retryIndex + 1);
}
