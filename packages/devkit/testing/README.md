# @spica-devkit/testing

Spin up a disposable [Spica](https://spicaengine.com) instance, install your resources, run
e2e tests against it with the other `@spica-devkit/*` packages, and tear it all down — all
from code, in any test framework.

It starts a **minimal** stack — a single-node MongoDB replica set plus the Spica API
container only (no panel, no ingress) — so it is fast enough to use from a test suite.

> Requires a running Docker daemon and the `@spica/cli` package (installed alongside it).

## Usage

```ts
import {start} from "@spica-devkit/testing";
import * as Bucket from "@spica-devkit/bucket";

let spica;

beforeAll(async () => {
  // Boots api + mongo, installs the CLI-format resources in ./ and logs in.
  spica = await start({version: "latest", resourcePath: "./resources"});

  // Point any other devkit at the instance:
  Bucket.initialize({apikey: spica.apikey.key, publicUrl: spica.url});
});

afterEach(() => spica.reset(["bucket-data"])); // fast wipe between tests

afterAll(() => spica.teardown());
```

`start(options?)` returns a handle with everything needed to connect:

| field | description |
|---|---|
| `url` / `publicUrl` | host-reachable api base (no `/api` suffix — there is no ingress) |
| `token` | IDENTITY token for the default identity |
| `apikey` | an auto-created **full-access** api key (`{_id, name, key}`) |
| `identifier` / `password` | the default identity credentials |
| `mongoUrl` | host-reachable mongo url (used by `reset()`) |

Helpers on the handle: `loginAs`, `createApiKey`, `waitForReady`, `installResources`,
`reset`, `teardown`, plus `initializeOptionsIdentity()` / `initializeOptionsApikey()`.

## `start` options

`version`, `mongoVersion`, `resourcePath` (default `./`), `port` (auto), `name` (auto),
`identifier`/`password` (default `spica`/`spica`), `masterKey`, `apiOptions`,
`imagePullPolicy` (default `if-not-present`), `installResources` (default `true`),
`readyTimeoutMs` (default `120_000`).

## `reset(modules?)`

Quickly clears state by **dropping the relevant MongoDB collections directly** (fastest path):

| module | effect |
|---|---|
| `bucket-data` | drops every `bucket_<id>` data collection (schemas kept) |
| `bucket` | drops data collections **and** the `buckets` schema collection |
| `identity` | deletes non-default identities and clears refresh tokens |
| `apikey` | deletes every api key except the instance's own |
| `function` | drops the `function` collection |
| `storage` | drops the `storage` metadata collection |
| `all` (default) | all of the above |

**Caveats (mongo-direct bypasses the api's cascade logic):**

- `function` reset drops the documents but does **not** unregister already-loaded
  functions/triggers from the running api process. Reliable function reset needs a restart.
- `storage` reset removes metadata but leaves uploaded files on the api volume.

Prefer the data-module resets (`bucket-data`, `identity`, `storage`) between tests.

## Tests

- `yarn nx test devkit/testing` — fully-mocked unit suite (no Docker needed).
- `SPICA_E2E_DOCKER=1 yarn nx test devkit/testing` — integration suite against a real daemon.
