<p align="center">
  <img height="100px" src="stacks/spica/assets/astro-composer.svg">
</p>

# Spica - development engine [![Build status](https://badge.buildkite.com/231efc3a5086b0db36206b21f04ee665939ca9186505894312.svg?style=square)](https://buildkite.com/spica/default)

Spica is not a framework, it's a full-fledged free and open-source development platform. We aim cost-efficient, fast and reliable development. Spica fulfills the needs of development among other things such as:

- Data modeling with **Bucket** module and support for GraphQL
- Custom behavior implementation with **Function** module.
- Resource based identity management with **Passport** module.
- Platform agnostic build with API-first approach.

### Spica is free and always will be! :v:

## Quick Start

```bash
# Install the CLI
npm install -g @spica/cli

# Start a fresh server
spica project start my-first-server
```

#### Alternatively, you can check out the example which is already up and running

[Click here](https://example.spicaengine.com/spica) to go to example and login with the following credentials:

```
username: spica

password: spica
```

## Packages

|                                                  Package                                                  |                                                                                                                                                                                                  Status                                                                                                                                                                                                   |                             Description                              |
| :-------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :------------------------------------------------------------------: |
|                        [spicaengine/api](https://hub.docker.com/r/spicaengine/api)                        |                      ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/api?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/api?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/api?label=downloads&color=blue)                       |                         API server of spica                          |
|                      [spicaengine/spica](https://hub.docker.com/r/spicaengine/spica)                      |                   ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/spica?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/spica?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/spica?label=downloads&color=blue)                    |                         Dashboard for spica                          |
|                       [spicaengine/site](https://hub.docker.com/r/spicaengine/site)                       |                     ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/site?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/site?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/site?label=downloads&color=blue)                     |                   Site for spica and documentation                   |
| [spicaengine/mongoreplicationcontroller](https://hub.docker.com/r/spicaengine/mongoreplicationcontroller) | ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/mongoreplicationcontroller?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/initcontainer?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/initcontainer?label=downloads&color=blue) |            Kubernetes controller for MongoDB replication             |
|                          [@spica/cli](https://www.npmjs.com/package/@spica/cli)                           |                                                                                                                               ![npm (scoped)](https://img.shields.io/npm/v/@spica/cli?label=version&color=blue) ![npm](https://img.shields.io/npm/dm/@spica/cli?color=blue)                                                                                                                               |                     CLI for controlling the API.                     |
|              [@spica-devkit/database](https://www.npmjs.com/package/@spica-devkit/database)               |                                                                                                                   ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/database?label=version&color=blue) ![npm](https://img.shields.io/npm/dm/@spica-devkit/database?color=blue)                                                                                                                   | Development package for interacting with the APIs database directly. |
|             [@spica-devkit/dashboard](https://www.npmjs.com/package/@spica-devkit/dashboard)              |                                                                                                                  ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/dashboard?label=version&color=blue) ![npm](https://img.shields.io/npm/dm/@spica-devkit/dashboard?color=blue)                                                                                                                  |     Development package for interacting with the Dashboard APIs.     |
|                [@spica-devkit/bucket](https://www.npmjs.com/package/@spica-devkit/bucket)                 |                                                                                                                     ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/bucket?label=version&color=blue) ![npm](https://img.shields.io/npm/dm/@spica-devkit/bucket?color=blue)                                                                                                                     |      Development package for interacting with the Bucket APIs.       |

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
