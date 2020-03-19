<p align="center">
  <img src="/docs/site/src/assets/images/spica-dark.png">
</p>


# Spica - Development Engine ![CircleCI](https://img.shields.io/circleci/build/github/spica-engine/spica/master)

Spica is not a framework, it's a full-fledged free and open-source development engine. We aim cost-efficient, fast and reliable development. Spica fulfills the needs of development among other things such as:

* Data modeling with **Bucket** module.
* Custom behavior implementation with **Function** module.
* Resource based identity management with **Passport** module.
* Platform agnostic build with API-first approach.


### Spica is free and always will be! :v:

## Quick Start
```bash
# Install the CLI
npm install -g @spica/cli

# Start a fresh server
spica serve my-first-server
```


#### Alternatively, you can check out the example which is already up and running

[Click here](https://example.spicaengine.com/spica) to go to example and login with the following credentials:

```
username: spica

password: spica
```

## Packages

| Project | Package | Version | Size | Downloads |
|:------------------------------:|:---------------------------------------------------------------------------------:|:--------------------------------------------------------------------------------------------------------------:|:--------------------------------------------------------------------------------------------------------------------:|:------------------------------------------------------------------------------:|
| APIs | [`spicaengine/api`](https://hub.docker.com/r/spicaengine/api) | ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/api?sort=semver) | ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/api?sort=semver) | ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/api) |
| Web Client | [`spicaengine/spica`](https://hub.docker.com/r/spicaengine/spica) | ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/spica?sort=semver) | ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/spica?sort=semver) | ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/spica) |
| Docs - SITE | [`spicaengine/site`](https://hub.docker.com/r/spicaengine/site) | ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/site?sort=semver) | ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/site?sort=semver) | ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/site) |
| MongoDB Replication Controller | [`spicaengine/initcontainer`](https://hub.docker.com/r/spicaengine/initcontainer) | ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/initcontainer?sort=semver) | ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/initcontainer?sort=semver) | ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/initcontainer) |
| CLI | [`@spica/cli`](https://www.npmjs.com/package/@spica/cli) | ![npm (scoped)](https://img.shields.io/npm/v/@spica/cli?label=version) |  | ![npm](https://img.shields.io/npm/dm/@spica/cli) |
| Devkit - Database | [`@spica-devkit/database`](https://www.npmjs.com/package/@spica-devkit/database) | ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/database?label=version) |  | ![npm](https://img.shields.io/npm/dm/@spica-devkit/database) |

## Chat
Join us on [Slack][slack] or [Discord][discord], feel free to request to join our private `#development` channel if you're planning to contribute. 

## Contributing

Thanks for your interest in contributing! Read up on our guidelines for [contributing](https://github.com/spica-engine/spica/blob/master/CONTRIBUTING.md).

## Changelog

[Learn about the latest improvements][changelog].

## Licence

Spica is an open-source software licensed under the [AGPL-3.0][licence].

[slack]: https://join.slack.com/t/spica-engine/shared_invite/enQtNzYzMDE3NjQ2MTkyLTA3MTg4ZTViZGI0MThiYzdhNTYxMTQxNjcwYzRjZTJhZDE4YWFhOGU5NmUzMGZiYjlmOWY2NDg5OTUxZjM2NDM
[discord]: https://discord.gg/HJTrRMH
[changelog]: https://github.com/spica-engine/spica/blob/master/CHANGELOG.md
[licence]: https://opensource.org/licenses/AGPL-3.0
