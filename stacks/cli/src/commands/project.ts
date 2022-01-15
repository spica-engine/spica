import * as docker from "dockerode";

let machine: DockerMachine;

export class DockerMachine extends docker {
  constructor() {
    if (!machine) {
      super();
      machine = this;
    }
    return machine;
  }

  doesImageExist(image: string, tag: string) {
    return !!machine.listImages({
      filters: JSON.stringify({reference: [`${image}:${tag}`]})
    });
  }

  pullImage(image: string, tag: string) {
    return new Promise((resolve, reject) =>
      machine.pull(`${image}:${tag}`, {}, function(err, stream) {
        if (err) {
          if (err.message && err.message.indexOf(`manifest for ${image}`)) {
            reject(new ImageNotFoundError(image, tag));
          } else {
            reject(err);
          }
        } else {
          machine.modem.followProgress(stream, resolve);
        }
      })
    );
  }
}

export class ImageNotFoundError extends Error {
  constructor(image: string, tag: string) {
    super(`Could not find the image ${image}:${tag}.`);
  }
}
