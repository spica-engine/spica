<p align="center">
  <img height="200px" src="stacks/spica/assets/logo-1.png">
</p>

---

# Spica - development engine [![Build status](https://badge.buildkite.com/231efc3a5086b0db36206b21f04ee665939ca9186505894312.svg?style=square)](https://buildkite.com/spica/default)

Spica is a full-fledged, free and open-source backend development platform. It aims to reduce all repetitive backend tasks and provide to fastest backend development process. Spica fulfills the needs of development among other things such as:

| Modules                        | Version |        Tests         | Used In Enterprise Project |
| :----------------------------- | :------ | :------------------: | :------------------------: |
| Data Modeling                  | Release |  :white_check_mark:  |     :white_check_mark:     |
| Realtime Database              | Release |  :white_check_mark:  |     :white_check_mark:     |
| Cloud Functions                | Release |  :white_check_mark:  |     :white_check_mark:     |
| Identity and Access Management | Release | :white_large_square: |     :white_check_mark:     |
| Storage (CDN)                  | Release |  :white_check_mark:  |     :white_check_mark:     |
| Dashboards                     | Release |  :white_check_mark:  |     :white_check_mark:     |
| **Features**                   |         |                      |                            |
| Auto-Generated REST API        | Release |  :white_check_mark:  |     :white_check_mark:     |
| WebHooks                       | Release |  :white_check_mark:  |     :white_check_mark:     |
| Custom OAuth & SAML            | Beta    |  :white_check_mark:  |    :white_large_square:    |
| GraphQL                        | Beta    |  :white_check_mark:  |    :white_large_square:    |
| ACL Rules                      | Release |  :white_check_mark:  |     :white_check_mark:     |
| Asset System                   | Beta    | :white_large_square: |    :white_large_square:    |
| Monitoring Tools               | Beta    |  :white_check_mark:  |    :white_large_square:    |
| Identity Activity Monitoring   | Release |  :white_check_mark:  |     :white_check_mark:     |
| Instance Stats                 | Alpha   |  :white_check_mark:  |     :white_check_mark:     |

## Secondary Features

- Inline image editing
- Data history
- Data localization
- Event driven function triggers
- Prebuilt Open-Source Assets & Plugins
- Customizable back-office UI
- API-first approach

Spica provides enterprise-grade backend features and customizable back-office UI for non-technical people.

## Quick Start

Important: To run serve command, you must have [Docker](https://www.docker.com/) and [NodeJs](https://nodejs.org/en/) installed on your development environment.

```bash
# Install the CLI
npm install -g @spica/cli

# Start a fresh server
spica project start my-first-server
```

## How It Works

We are trying to reduce development time for fast-paced projects and startups. Also we want to give a platform where the backend developers enjoy while developing robust projects. You can use Spica as a backend engine as well as a headless CMS.

To use Spica as a **backend engine**:

1. Prepare your data models in **Bucket Module**, REST API and GraphQL API will be generated automatically
2. Add rules to each bucket as an entry level security layer
3. Create custom policy for your project user roles
4. Apply your logic with **cloud functions**
5. Add **custom dashboards** for the business managers

To use Spica as a **Headless CMS**:

1. Prepare your data models in **Bucket Module**, REST API and GraphQL API will be generated automatically
2. Place your inputs and customize your bucket views with a few clicks
3. Create **identities** for your content editors
4. Add policies to your **identities** so your content editors can't reach to any technical part.
5. Add automations with **cloud functions**
6. Add **Webhooks** if you want to trigger any other 3rd party integration such as Slack, Zapier

## RoadMap

We are currently in **public beta**. This means, you can use every feature and 99% of features are stable. We used Spica for a few enterprise-grade projects which are serving millions of requests in a day.

We can tell that the current roadmap:

1. Automate some settings with AI and reduce the complexity of the tool
2. Better monitoring tools
3. Adding new open-source assets such as Google Auth, Facebook Auth...
4. Adding new ready-to-use full-project starter kits such as Marketplace backend, social network backend .etc
5. New feature requests by our community are welcomed

## Documentation

You can see full documentation on [spicaengine/docs](https://spicaengine.com/docs)

## Alternatively, you can check out the example which is already up and running

[Click here](https://spicaengine.com/) and you will see `Examples & Starters` section in our official web page.

## Community

Join us on [Slack][slack] or [Discord][discord], feel free to request to join our private `#development` channel if you're planning to contribute.

[slack]: https://join.slack.com/t/spica-engine/shared_invite/enQtNzYzMDE3NjQ2MTkyLTA3MTg4ZTViZGI0MThiYzdhNTYxMTQxNjcwYzRjZTJhZDE4YWFhOGU5NmUzMGZiYjlmOWY2NDg5OTUxZjM2NDM
[discord]: https://discord.gg/fBtzBEaxKJ

## Docker Packs

|                                                  Package                                                  |                                                                                                                                                                                                  Status                                                                                                                                                                                                   |                  Description                  |
| :-------------------------------------------------------------------------------------------------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | :-------------------------------------------: |
|                        [spicaengine/api](https://hub.docker.com/r/spicaengine/api)                        |                      ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/api?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/api?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/api?label=downloads&color=blue)                       |              API server of spica              |
|                      [spicaengine/spica](https://hub.docker.com/r/spicaengine/spica)                      |                   ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/spica?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/spica?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/spica?label=downloads&color=blue)                    |              Dashboard for spica              |
| [spicaengine/mongoreplicationcontroller](https://hub.docker.com/r/spicaengine/mongoreplicationcontroller) | ![Docker Image Version (latest semver)](https://img.shields.io/docker/v/spicaengine/mongoreplicationcontroller?sort=semver&label=version&color=blue) ![Docker Image Size (latest semver)](https://img.shields.io/docker/image-size/spicaengine/initcontainer?sort=semver&label=size&color=blue) ![Docker Pulls](https://img.shields.io/docker/pulls/spicaengine/initcontainer?label=downloads&color=blue) | Kubernetes controller for MongoDB replication |

## Libraries

|        Libraries         |                                            Status                                             |                             Description                              |                         Languages                          |
| :----------------------: | :-------------------------------------------------------------------------------------------: | :------------------------------------------------------------------: | :--------------------------------------------------------: |
|       `@spica/cli`       |       ![npm (scoped)](https://img.shields.io/npm/v/@spica/cli?label=version&color=blue)       |                     CLI for controlling the API.                     |       [JS](https://www.npmjs.com/package/@spica/cli)       |
| `@spica-devkit/database` | ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/database?label=version&color=blue) | Development package for interacting with the APIs database directly. | [JS](https://www.npmjs.com/package/@spica-devkit/database) |
|  `@spica-devkit/bucket`  |  ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/bucket?label=version&color=blue)  |      Development package for interacting with the Bucket APIs.       |  [JS](https://www.npmjs.com/package/@spica-devkit/bucket)  |
| `@spica-devkit/storage`  | ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/storage?label=version&color=blue)  |             Development package for the Storage module.              | [JS](https://www.npmjs.com/package/@spica-devkit/storage)  |
| `@spica-devkit/identity` | ![npm (scoped)](https://img.shields.io/npm/v/@spica-devkit/identity?label=version&color=blue) |             Development package for the Identity module.             | [JS](https://www.npmjs.com/package/@spica-devkit/identity) |

## Contributing

Thanks for your interest in contributing! Read up on our guidelines for [contributing](https://github.com/spica-engine/spica/blob/master/CONTRIBUTING.md).

## Changelog

[Learn about the latest improvements][changelog].

## Licence

Spica is an open-source software licensed under the [AGPL-3.0][licence].

[changelog]: https://github.com/spica-engine/spica/blob/master/CHANGELOG.md
[licence]: https://opensource.org/licenses/AGPL-3.0
