import * as docker from "dockerode";
import * as semver from "semver";

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

export const version = image => /^spicaengine\/(spica|api):(.*)/g.exec(image)[2];
const nonActualVersions = ["latest"];

export async function isVersionUpgrade(desiredVersion: string, oldImage: docker.ContainerInfo) {
  if (desiredVersion == "latest") {
    return true;
  }

  let oldImageVersion = version(oldImage.Image);
  if (nonActualVersions.includes(oldImageVersion)) {
    oldImageVersion = await getActualVersion(oldImage.Image);
  }

  return semver.gt(desiredVersion, oldImageVersion);
}

function getActualVersion(image: string) {
  const machine = new DockerMachine();

  const actualVersionMatch = /^spicaengine\/spica:\d+\.\d+\.\d+$/g;

  return machine
    .getImage(image)
    .inspect()
    .then(info => {
      let match = info.RepoTags.find(tag => actualVersionMatch.test(tag));
      if (!match) {
        throw Error(`Could not find the actual version of image '${image}'`);
      }
      return version(match);
    });
}
