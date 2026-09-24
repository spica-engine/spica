# @spica-devkit/sync

Plan and apply [Spica](https://spicaengine.com) resource files (the `spica plan` / `spica apply`
project format: `bucket/`, `function/`, `policy/`, `env-var/`, `secret/`) against a Spica
instance from code, without a terminal or a working tree on disk.

Built for servers that sync a project from a git commit: download the repository archive, keep
the resource files in memory, show the plan to a person, and apply exactly what they approved.

## Usage

```ts
import {plan, apply, readTarball} from "@spica-devkit/sync";

const connection = {url: "https://my-project.example.com/api", authorization: "APIKEY <key>"};

// 1. Read the resource files of a commit (e.g. GET /repos/{owner}/{repo}/tarball/{sha}).
const response = await fetch(tarballUrl, {headers: {Authorization: `Bearer ${token}`}});
const files = await readTarball(response.body, {path: "spica"});

// 2. Plan. The result is plain JSON: store it and show it for review.
const reviewed = await plan({connection, files});
// reviewed.totals → {creates, updates, deletes}
// reviewed.modules[].updates[].diffs → unified diffs per section

// 3. Apply after approval, with the same files.
const result = await apply({connection, files, fingerprint: reviewed.fingerprint});
// result.status: "succeeded" | "partial" | "failed" | "outdated"
```

`apply` plans again and only applies when the new plan has the same `fingerprint` as the reviewed
one. If the files or the instance changed in between, nothing is applied and the result has
status `"outdated"` with the new plan.

## API

| export                      | description                                                                       |
| --------------------------- | --------------------------------------------------------------------------------- |
| `plan(options)`             | Compare `files` with the instance; resolves to a JSON-serializable `SyncPlan`.    |
| `apply(options)`            | Apply if the plan still matches `options.fingerprint`; resolves to `ApplyResult`. |
| `readTarball(input, opts?)` | Stream a (gzipped) tar archive and keep only the resource files, in memory.       |
| `SpicaRequestError`         | Rejection type for failed Spica requests (`status`, `data`), without credentials. |

`plan` / `apply` options: `connection` (`{url, authorization}`), `files` (a `Map` or object keyed
by project-relative path such as `bucket/Users/schema.yaml`), `modules` (limit to some modules),
`concurrency` (parallel requests, default 10), `maxDiffLength` (longer diff sections are listed in
`omittedDiffs` instead, default 200000). `apply` also takes `fingerprint` and `abortOnError`.

`readTarball` options: `path` (the project folder inside the repository), `stripComponents`
(default 1, the `<owner>-<repo>-<sha>/` folder of GitHub/GitLab archives), `maxFileBytes`
(default 5 MiB), `maxTotalBytes` (default 50 MiB) and `maxFiles` (default 10000). Files that are
not resources are skipped without being buffered. A truncated archive is rejected, so a partial
download can never be planned as a set of deletions.
