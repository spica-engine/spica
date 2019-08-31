export class ImageNotFoundError extends Error {
  constructor(image: string, tag: string) {
    super(`Can not find the image ${image}:${tag}.`);
  }
}
