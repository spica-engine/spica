#!/usr/bin/env node
/**
 * The hand walkthrough of Phase 7 item 5, driven over HTTP.
 *
 * Why it exists: the test suite runs against a testing module, and a **real boot** exercises code the
 * suite never reaches. The first run of this proved the point by itself — `FunctionService.afterInit`
 * asked for a GIN index with an `ASC` option, PostgreSQL rejected the statement, and `afterInit` logs its
 * failure instead of throwing, so two production indexes were missing while 3007 tests stayed green.
 *
 * What it does NOT replace: browsing a **real** project's data in the panel. Long schemas, deeply nested
 * relations and records written by older versions produce shapes nothing here generates. Point this at an
 * instance that carries such data and the surfaces below are exercised against it; the eye is still yours.
 *
 * Usage:
 *   node scripts/walkthrough.mjs --url http://127.0.0.1:4300 [--identifier spica --password spica]
 *   node scripts/walkthrough.mjs --url … --json report.json
 *
 * The function step needs a running instance whose worker paths are set — `FUNCTION_SPAWN_ENTRYPOINT_PATH`,
 * `FUNCTION_TS_COMPILER_PATH`, `FUNCTION_ROLLUP_WORKER_PATH` (the container image sets them; locally
 * `jest.setup.js` shows the values). Without them the step reports a failure and the rest still runs.
 *
 * Both backends produce the same report. Run it twice and diff the files: any difference is either a
 * declared capability difference or a defect.
 */
import fs from "fs";
import {WebSocket} from "ws";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2)
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);

const URL_BASE = (args.get("url") || "http://127.0.0.1:4300").replace(/\/$/, "");
const IDENTIFIER = args.get("identifier") || "spica";
const PASSWORD = args.get("password") || "spica";
const JSON_OUT = args.get("json");

const report = {url: URL_BASE, backend: undefined, steps: []};
let token;

function record(name, outcome, detail) {
  report.steps.push({name, outcome, detail});
  const mark = outcome === "ok" ? "✔" : outcome === "declared" ? "•" : "✘";
  console.log(`${mark} ${name}${detail === undefined ? "" : `  ${JSON.stringify(detail)}`}`);
}

async function api(path, {method = "GET", body, raw, headers = {}} = {}) {
  const response = await fetch(`${URL_BASE}${path}`, {
    method,
    headers: {
      ...(token ? {Authorization: `IDENTITY ${token}`} : {}),
      ...(raw ? {} : {"Content-Type": "application/json"}),
      ...headers
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }
  return {status: response.status, body: parsed};
}

/**
 * Runs one step. A step that fails does **not** stop the walkthrough: the point is a full picture, and a
 * single unsupported surface should not hide the ten after it.
 */
async function step(name, fn) {
  try {
    const detail = await fn();
    record(name, "ok", detail);
    return detail;
  } catch (error) {
    record(name, "failed", String(error.message ?? error));
    return undefined;
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────── the walkthrough

await step("identify", async () => {
  const {status, body} = await api("/passport/identify", {
    method: "POST",
    body: {identifier: IDENTIFIER, password: PASSWORD}
  });
  expect(status === 200 && body?.token, `login failed: ${status} ${JSON.stringify(body)}`);
  token = body.token;
  return {status};
});

await step("status/capabilities reports the driver", async () => {
  const {status, body} = await api("/status/capabilities");
  expect(status === 200, `status ${status}`);
  report.backend = body.backend;
  return {
    backend: body.backend,
    aggregationPipeline: body.capabilities.aggregationPipeline,
    nativeTTLIndex: body.capabilities.nativeTTLIndex,
    rawMongoFilter: body.capabilities.rawMongoFilter,
    referentialIntegrity: body.capabilities.referentialIntegrity,
    directAccessDevkit: body.capabilities.directAccessDevkit,
    maxLifetimeFieldsPerCollection: body.capabilities.maxLifetimeFieldsPerCollection
  };
});

const stamp = Date.now();

/**
 * Two buckets and a relation between them, plus a localized field, a nested object, an array and a date.
 * This is the shape the suite covers well; it is here so the surfaces after it have something to read.
 */
const authors = await step("create the authors bucket", async () => {
  const {status, body} = await api("/bucket", {
    method: "POST",
    body: {
      title: `Walk authors ${stamp}`,
      description: "walkthrough",
      primary: "name",
      icon: "view_stream",
      readOnly: false,
      history: false,
      acl: {read: "true==true", write: "true==true"},
      properties: {
        name: {type: "string", title: "name", options: {}},
        rank: {type: "number", title: "rank", options: {}}
      }
    }
  });
  expect(status === 201 || status === 200, `status ${status} ${JSON.stringify(body)}`);
  return body._id;
});

const posts = await step("create the posts bucket (relation, i18n, nested, array)", async () => {
  const {status, body} = await api("/bucket", {
    method: "POST",
    body: {
      title: `Walk posts ${stamp}`,
      description: "walkthrough",
      primary: "title",
      icon: "view_stream",
      readOnly: false,
      history: false,
      acl: {read: "true==true", write: "true==true"},
      properties: {
        title: {type: "string", title: "title", options: {translate: true}},
        views: {type: "number", title: "views", options: {}},
        tags: {type: "array", title: "tags", items: {type: "string"}, options: {}},
        meta: {
          type: "object",
          title: "meta",
          options: {},
          properties: {slug: {type: "string"}, featured: {type: "boolean"}}
        },
        published_at: {type: "date", title: "published_at", options: {}},
        author: {
          type: "relation",
          title: "author",
          relationType: "onetoone",
          bucketId: authors,
          options: {}
        }
      }
    }
  });
  expect(status === 201 || status === 200, `status ${status} ${JSON.stringify(body)}`);
  return body._id;
});

const authorIds = await step("insert authors", async () => {
  const ids = [];
  for (const author of [
    {name: "Ada", rank: 1},
    {name: "Grace", rank: 2},
    {name: "Linus", rank: 3}
  ]) {
    const {status, body} = await api(`/bucket/${authors}/data`, {method: "POST", body: author});
    expect(status === 201 || status === 200, `status ${status} ${JSON.stringify(body)}`);
    ids.push(body._id);
  }
  return ids;
});

await step("insert posts", async () => {
  const rows = [
    {
      title: {en_US: "First", tr_TR: "Birinci"},
      views: 10,
      tags: ["a", "b"],
      meta: {slug: "first", featured: true},
      published_at: "2026-01-01T00:00:00.000Z",
      author: authorIds[0]
    },
    {
      title: {en_US: "Second", tr_TR: "İkinci"},
      views: 20,
      tags: ["b"],
      meta: {slug: "second", featured: false},
      published_at: "2026-02-01T00:00:00.000Z",
      author: authorIds[1]
    },
    {
      title: {en_US: "Third", tr_TR: "Üçüncü"},
      views: 30,
      tags: ["c"],
      meta: {slug: "third", featured: true},
      published_at: "2026-03-01T00:00:00.000Z",
      author: authorIds[2]
    }
  ];
  for (const row of rows) {
    const {status, body} = await api(`/bucket/${posts}/data`, {method: "POST", body: row});
    expect(status === 201 || status === 200, `status ${status} ${JSON.stringify(body)}`);
  }
  return {inserted: rows.length};
});

await step("list posts", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?sort=${encodeURIComponent('{"views":1}')}`
  );
  expect(status === 200, `status ${status}`);
  expect(body.length === 3, `expected 3, got ${body.length}`);
  return {count: body.length, views: body.map(row => row.views)};
});

await step("paginate", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?paginate=true&limit=2&sort=${encodeURIComponent('{"views":1}')}`
  );
  expect(status === 200, `status ${status}`);
  expect(body.meta.total === 3, `total ${body.meta.total}`);
  expect(body.data.length === 2, `page ${body.data.length}`);
  return {total: body.meta.total, page: body.data.length};
});

await step("filter with an expression", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?filter=${encodeURIComponent("views > 15")}`
  );
  expect(status === 200, `status ${status} ${JSON.stringify(body)}`);
  expect(body.length === 2, `expected 2, got ${body.length}`);
  return {count: body.length};
});

await step("filter on a nested path with an expression", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?filter=${encodeURIComponent('document.meta.slug == "third"')}`
  );
  expect(status === 200, `status ${status} ${JSON.stringify(body)}`);
  expect(body.length === 1, `expected 1, got ${body.length}`);
  return {count: body.length};
});

await step("filter with regex() over a localized field", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?filter=${encodeURIComponent('regex(document.title, "^Se")')}`
  );
  expect(status === 200, `status ${status} ${JSON.stringify(body)}`);
  return {count: Array.isArray(body) ? body.length : body};
});

await step("filter with raw Mongo JSON (a declared difference)", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?filter=${encodeURIComponent('{"views":{"$gt":15}}')}`
  );
  if (status === 400) {
    record("  raw Mongo JSON is refused as declared (AK-6)", "declared", {status});
    return {status, refused: true};
  }
  expect(status === 200, `status ${status} ${JSON.stringify(body)}`);
  expect(body.length === 2, `expected 2, got ${body.length}`);
  return {status, count: body.length};
});

await step("resolve the relation", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?relation=true&sort=${encodeURIComponent('{"views":1}')}`
  );
  expect(status === 200, `status ${status}`);
  const names = body.map(row => row.author?.name);
  expect(names.every(Boolean), `unresolved relation: ${JSON.stringify(names)}`);
  return {authors: names};
});

await step("localize", async () => {
  const en = await api(`/bucket/${posts}/data?sort=${encodeURIComponent('{"views":1}')}`, {
    headers: {"accept-language": "en_US"}
  });
  const tr = await api(`/bucket/${posts}/data?sort=${encodeURIComponent('{"views":1}')}`, {
    headers: {"accept-language": "tr_TR"}
  });
  expect(en.status === 200 && tr.status === 200, `status ${en.status}/${tr.status}`);
  return {en: en.body.map(r => r.title), tr: tr.body.map(r => r.title)};
});

await step("update a post and read it back", async () => {
  const list = await api(`/bucket/${posts}/data?sort=${encodeURIComponent('{"views":1}')}`);
  const id = list.body[0]._id;
  const patched = await api(`/bucket/${posts}/data/${id}`, {method: "PATCH", body: {views: 11}});
  expect(patched.status === 200, `status ${patched.status}`);
  const read = await api(`/bucket/${posts}/data/${id}`);
  expect(read.body.views === 11, `views ${read.body.views}`);
  // R104's shape: an updated row used to come back with a string id on PostgreSQL.
  expect(typeof read.body._id === "string" && read.body._id.length === 24, `id ${read.body._id}`);
  return {views: read.body.views};
});

await step("realtime: subscribe, insert, receive", async () => {
  const wsUrl = `${URL_BASE.replace(/^http/, "ws")}/bucket/${posts}/data?Authorization=${encodeURIComponent(`IDENTITY ${token}`)}`;
  const socket = new WebSocket(wsUrl);
  const messages = [];
  const closed = new Promise((resolve, reject) => {
    socket.onerror = event => reject(new Error(`websocket error: ${event.message ?? "unknown"}`));
    socket.onmessage = event => messages.push(JSON.parse(event.data));
    socket.onopen = () => resolve();
  });
  await closed;

  // Wait for the initial sync to drain, then write and wait for the change to arrive.
  for (let i = 0; i < 40 && !messages.some(m => m.kind === -1 || m.kind === 1); i++)
    await sleep(100);
  const before = messages.length;
  await api(`/bucket/${posts}/data`, {
    method: "POST",
    body: {title: {en_US: "Realtime"}, views: 99, tags: [], meta: {slug: "rt", featured: false}}
  });
  for (let i = 0; i < 100 && messages.length === before; i++) await sleep(100);
  socket.close();
  expect(messages.length > before, "no realtime message arrived within 10 s");
  return {received: messages.length - before, kinds: [...new Set(messages.map(m => m.kind))]};
});

await step("aggregate over the whole collection", async () => {
  const {status, body} = await api(
    `/bucket/${posts}/data?filter=${encodeURIComponent("views > 0")}&paginate=true`
  );
  expect(status === 200, `status ${status}`);
  return {total: body.meta.total};
});

await step("storage: upload, list, filter", async () => {
  const boundary = "----walkthrough";
  const filename = `walk-${stamp}.txt`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: text/plain\r\n\r\n`
    ),
    Buffer.from("walkthrough"),
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);
  const uploaded = await api("/storage", {
    method: "POST",
    raw: payload,
    headers: {"Content-Type": `multipart/form-data; boundary=${boundary}`}
  });
  expect(
    uploaded.status === 201 || uploaded.status === 200,
    `upload ${uploaded.status} ${JSON.stringify(uploaded.body)}`
  );

  const byJson = await api(
    `/storage?filter=${encodeURIComponent(JSON.stringify({name: filename}))}`
  );
  const byExpression = await api(`/storage?filter=${encodeURIComponent(`name == "${filename}"`)}`);
  expect(
    byJson.status === 200 && byExpression.status === 200,
    `list ${byJson.status}/${byExpression.status}`
  );
  expect(byExpression.body.length === byJson.body.length, "the two filter forms disagree");
  return {json: byJson.body.length, expression: byExpression.body.length};
});

await step("passport: create an identity and filter it", async () => {
  const created = await api("/passport/identity", {
    method: "POST",
    body: {identifier: `walk-${stamp}`, password: "walkthrough"}
  });
  expect(
    created.status === 201 || created.status === 200,
    `create ${created.status} ${JSON.stringify(created.body)}`
  );

  const byExpression = await api(
    `/passport/identity?filter=${encodeURIComponent(`identifier == "walk-${stamp}"`)}`
  );
  expect(byExpression.status === 200, `list ${byExpression.status}`);
  expect(byExpression.body.length === 1, `expected 1, got ${byExpression.body.length}`);
  return {found: byExpression.body.length};
});

await step("function: a database trigger fires on an insert", async () => {
  const fn = await api("/function", {
    method: "POST",
    body: {
      name: `walk-${stamp}`,
      description: "walkthrough",
      language: "javascript",
      timeout: 30,
      triggers: {
        onInsert: {
          type: "database",
          active: true,
          options: {collection: `bucket_${posts}`, type: "INSERT"}
        }
      },
      env_vars: []
    }
  });
  expect(fn.status === 201 || fn.status === 200, `create ${fn.status} ${JSON.stringify(fn.body)}`);

  const indexed = await api(`/function/${fn.body._id}/index`, {
    method: "POST",
    body: {
      index: `export function onInsert(change) { console.log("walkthrough saw " + change.kind); }`
    }
  });
  expect(indexed.status === 200 || indexed.status === 204, `index ${indexed.status}`);

  await sleep(2000);
  await api(`/bucket/${posts}/data`, {
    method: "POST",
    body: {title: {en_US: "Trigger"}, views: 77, tags: [], meta: {slug: "trigger", featured: false}}
  });

  let logs = [];
  for (let i = 0; i < 60; i++) {
    // The logs live at their own controller (`/function-logs`), filtered by function id.
    const {body} = await api(`/function-logs?functions=${fn.body._id}&limit=50`);
    logs = Array.isArray(body) ? body : [];
    if (logs.some(log => String(log.content).includes("walkthrough saw"))) break;
    await sleep(500);
  }
  expect(
    logs.some(log => String(log.content).includes("walkthrough saw")),
    `no trigger log in 30 s (${logs.length} log lines)`
  );
  return {logs: logs.length};
});

// ─────────────────────────────────────────────────────────────── report

const failed = report.steps.filter(s => s.outcome === "failed");
console.log(`\n${report.steps.length} steps · ${failed.length} failed · backend ${report.backend}`);
if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 1));
  console.log(`JSON: ${JSON_OUT}`);
}
process.exit(failed.length ? 1 : 0);
