import docker from "dockerode";
import semver from "semver";

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
    return machine
      .listImages({
        filters: JSON.stringify({reference: [`${image}:${tag}`]})
      })
      .then(images => images.length > 0);
  }

  pullImage(image: string, tag: string) {
    return new Promise((resolve, reject) =>
      machine.pull(`${image}:${tag}`, {}, function (err, stream) {
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

export const version = image => {
  const vers = /^spicaengine\/(spica|api):(.*)/g.exec(image)[2];

  if (nonActualVersions.includes(vers)) {
    return machine
      .getImage(image)
      .inspect()
      .then(info => {
        const actualVersion = info.RepoTags.map(tag => tag.slice(tag.indexOf(":") + 1)).find(tag =>
          semver.valid(tag)
        );
        if (!actualVersion) {
          throw Error(`Could not find the actual version of image '${image}'`);
        }
        return actualVersion;
      });
  }

  return Promise.resolve(vers);
};
const nonActualVersions = ["latest"];

export function isVersionUpgrade(desiredVersion: string, oldVersion: string) {
  if (desiredVersion == "latest") {
    return true;
  }
  return semver.gt(desiredVersion, oldVersion);
}
