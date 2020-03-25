import {Logger} from "./logger";

export class ImageNotFoundError extends Error {
  constructor(image: string, tag: string) {
    super(`Could not find the image ${image}:${tag}.`);
  }
}

export function noAuthorizationError(logger: Logger) {
  logger.error("You need to login to do this action. Please run: ");
  logger.info("spica login <username> <password>");
}
