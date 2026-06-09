# @spica-devkit/testing

Spin up a disposable [Spica](https://spicaengine.com) instance, install your resources, run
e2e tests against it with the other `@spica-devkit/*` packages, and tear it all down — all
from code, in any test framework.

It starts a **minimal** stack — a single-node MongoDB replica set plus the Spica API
container only (no panel, no ingress) — so it is fast enough to use from a test suite.

> Requires a running Docker daemon. The Spica resource-sync engine is bundled in, so no
> separate CLI install is needed.

## Usage

```ts
import {start} from "@spica-devkit/testing";
import axios from "axios";
import * as Bucket from "@spica-devkit/bucket";

let spica;

beforeAll(async () => {
  // Boots api + mongo, installs the CLI-format resources in ./resources.
  spica = await start({version: "latest", resourcePath: "./resources"});

  // Authenticate and point any other devkit at the instance:
  const {token} = (
    await axios.post(`${spica.publicUrl}/passport/identify`, {
      identifier: "spica",
      password: "spica"
    })
  ).data;
  Bucket.initialize({authorization: `IDENTITY ${token}`, publicUrl: spica.publicUrl});
});

afterEach(() => spica.reset(["bucket-data"])); // fast wipe between tests

afterAll(() => spica.teardown());
```

`start(options?)` returns a handle with everything needed to manage the instance's lifecycle:

| field / method   | description                                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| `publicUrl`      | host-reachable api base, e.g. `"http://localhost:54231"` (no `/api` suffix)         |
| `waitForReady()` | wait until the api accepts logins, or the timeout elapses                           |
| `reset(modules)` | quickly wipe state between tests by dropping targeted MongoDB collections           |
| `teardown()`     | stop and remove every container, network and volume of this instance                |

Authenticate with the `identifier`/`password` passed to `start()` (default `"spica"`/`"spica"`)
by calling `POST /passport/identify` directly, or via any `@spica-devkit/*` package.

## `start` options

| option            | default           | description                                                                                      |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `version`         | `"latest"`        | `spicaengine/api` image tag                                                                      |
| `mongoVersion`    | `"8.0"`           | `mongo` image tag                                                                                |
| `resourcePath`    | `"./"`            | root folder holding CLI-format resources (`bucket/`, `function/`, …)                            |
| `port`            | auto              | host port the api will be published on                                                           |
| `name`            | auto              | instance/namespace name used to label containers                                                 |
| `identifier`      | `"spica"`         | default identity username                                                                        |
| `password`        | `"spica"`         | default identity password                                                                        |
| `masterKey`       | random 16-byte hex | `--master-key` api flag                                                                         |
| `apiOptions`      | `{}`              | extra api flags, e.g. `{"activity-stream": false}`                                              |
| `imagePullPolicy` | `"if-not-present"` | `"always"` re-pulls even if the image is cached                                                 |
| `installResources`| `true`            | `true` — install everything; `false` — skip; or a `ResourceSelection` — install only a slice    |
| `readyTimeoutMs`  | `120_000`         | how long to wait for the api to accept logins before failing                                    |

### `ResourceSelection` — install only a slice

When a test file only needs a subset of your project's resources, pass a selection map to
`installResources` instead of `true`. This avoids compiling every function on every boot:

```ts
await start({
  resourcePath: "./",
  installResources: {
    bucket: ["products"],          // only the "products" bucket
    function: ["seed-products"]    // only this function
  }
});
```

Each entry is either `true` (install all resources of that module) or a list of folder names
under the module directory. Modules left out of the map are not installed at all.
Unknown module names and missing resource names throw immediately — before any container boots.

## `reset(modules?)`

Quickly clears state by **dropping the relevant MongoDB collections directly** (fastest path):

| module          | effect                                                         |
| --------------- | -------------------------------------------------------------- |
| `bucket-data`   | drops every `bucket_<id>` data collection (schemas kept)       |
| `bucket`        | drops data collections **and** the `buckets` schema collection |
| `identity`      | deletes non-default identities and clears refresh tokens       |
| `apikey`        | deletes every api key the test created                         |
| `function`      | drops the `function` collection                                |
| `storage`       | drops the `storage` metadata collection                        |
| `all` (default) | all of the above                                               |

**Caveats (mongo-direct bypasses the api's cascade logic):**

- `function` reset drops the documents but does **not** unregister already-loaded
  functions/triggers from the running api process. Reliable function reset needs a restart.
- `storage` reset removes metadata but leaves uploaded files on the api volume.

Prefer the data-module resets (`bucket-data`, `identity`, `storage`) between tests.

## Tests

- `yarn nx test devkit/testing` — fully-mocked unit suite (no Docker needed).
- `SPICA_E2E_DOCKER=1 yarn nx test devkit/testing` — integration suite against a real daemon.
