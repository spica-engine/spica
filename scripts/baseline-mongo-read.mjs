#!/usr/bin/env node
/**
 * Faz 0 — Mongo baseline ölçümü (§5 Performans Bütçesi).
 *
 * Pipeline şekilleri gerçek koddan alındı:
 *   i18n       → packages/api/bucket/common/src/locale.ts    (buildI18nAggregation)
 *   relation   → packages/api/bucket/common/src/relation.ts  (buildRelationAggregation)
 *   sayfalama  → packages/database/pipeline/src/builder.ts   (dataPipeline + countPipeline)
 *   ACL/filtre → packages/api/bucket/common/src/pipeline.builder.ts ($match)
 *
 * Ortam: gerçek mongod (mongo:8.0.4) tek düğümlü replica set, Docker'da — CI'ın kullandığı yol.
 * Çıktı: docs/baseline-mongo.md
 */
import {execFileSync, execFile} from "child_process";
import {MongoClient, ObjectId} from "mongodb";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE = "mongo:8.0.4";
const PORT = 47017;
const NAME = "spica-baseline-mongo";
const POSTS = Number(process.env.POSTS ?? 10_000);
const AUTHORS = 500;
const WARMUP = 20;
const ITER = Number(process.env.ITER ?? 100);
const LOCALE = {best: "tr_TR", fallback: "en_US"};

const sh = (cmd, args) => execFileSync(cmd, args, {encoding: "utf8"}).trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- pipeline şekilleri
const i18nStage = () => ({
  $replaceWith: {
    $mergeObjects: [
      "$$ROOT",
      {
        $arrayToObject: {
          $map: {
            input: {
              $filter: {
                input: {$objectToArray: "$$ROOT"},
                as: "item",
                cond: {$eq: [{$type: "$$item.v"}, "object"]}
              }
            },
            as: "prop",
            in: {
              k: "$$prop.k",
              v: {
                $ifNull: [
                  `$$prop.v.${LOCALE.best}`,
                  {$ifNull: [`$$prop.v.${LOCALE.fallback}`, "$$prop.v"]}
                ]
              }
            }
          }
        }
      }
    ]
  }
});

const relationStages = target => [
  {$addFields: {author: {$toObjectId: "$author"}}},
  {$lookup: {from: target, localField: "author", foreignField: "_id", as: "author"}},
  {$unwind: {path: "$author", preserveNullAndEmptyArrays: true}}
];

const ACL_MATCH = {$match: {$expr: {$eq: ["$published", true]}}};
const FILTER = {$match: {views: {$gt: 500}}};
const SORT = {$sort: {created_at: -1}};

// ---------------------------------------------------------------- istatistik
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const stats = arr => ({
  p50: +pct(arr, 50).toFixed(2),
  p95: +pct(arr, 95).toFixed(2),
  p99: +pct(arr, 99).toFixed(2),
  mean: +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
});

async function timeIt(fn, iter) {
  for (let i = 0; i < WARMUP; i++) await fn();
  const samples = [];
  for (let i = 0; i < iter; i++) {
    const t = process.hrtime.bigint();
    await fn();
    samples.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  return stats(samples);
}

// ---------------------------------------------------------------- container
function startContainer() {
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
  sh("docker", [
    "run",
    "-d",
    "--name",
    NAME,
    "-p",
    `${PORT}:27017`,
    IMAGE,
    "--replSet",
    "bench",
    "--bind_ip_all"
  ]);
}
function stopContainer() {
  try {
    sh("docker", ["rm", "-f", NAME]);
  } catch {}
}

async function main() {
  console.log(`▸ ${IMAGE} başlatılıyor (tek düğüm replica set, port ${PORT})…`);
  startContainer();

  const uri = `mongodb://127.0.0.1:${PORT}/?directConnection=true&retryWrites=false`;
  let client;
  for (let i = 0; i < 40; i++) {
    try {
      client = await MongoClient.connect(uri, {serverSelectionTimeoutMS: 1000});
      break;
    } catch {
      await sleep(500);
    }
  }
  if (!client) throw new Error("mongod'a bağlanılamadı");

  await client
    .db("admin")
    .command({
      replSetInitiate: {_id: "bench", members: [{_id: 0, host: `127.0.0.1:27017`}]}
    })
    .catch(() => {});
  await sleep(3000);
  await client.close();
  client = await MongoClient.connect(uri, {
    replicaSet: "bench",
    directConnection: true,
    retryWrites: false
  });

  const db = client.db("baseline");
  const posts = db.collection("bucket_posts");
  const authors = db.collection("bucket_authors");

  console.log(`▸ seed: ${AUTHORS} author, ${POSTS} post…`);
  const authorIds = Array.from({length: AUTHORS}, () => new ObjectId());
  await authors.insertMany(
    authorIds.map((_id, i) => ({
      _id,
      name: `Author ${i}`,
      email: `a${i}@example.com`
    }))
  );

  const tagPool = ["premium", "draft", "news", "tech", "spica", "archive"];
  const batch = [];
  for (let i = 0; i < POSTS; i++) {
    batch.push({
      _id: new ObjectId(),
      title: {en_US: `Post ${i}`, tr_TR: `Yazı ${i}`},
      description: {en_US: `Body of post ${i}`, tr_TR: `Yazı ${i} gövdesi`},
      slug: `post-${i}`,
      views: Math.floor(Math.random() * 1000),
      published: i % 3 !== 0,
      tags: [tagPool[i % tagPool.length], tagPool[(i + 2) % tagPool.length]],
      created_at: new Date(Date.now() - i * 60_000),
      author: authorIds[i % AUTHORS].toHexString() // relation string olarak saklanıyor
    });
    if (batch.length === 1000) {
      await posts.insertMany(batch);
      batch.length = 0;
    }
  }
  if (batch.length) await posts.insertMany(batch);

  await posts.createIndexes([
    {key: {views: 1}},
    {key: {created_at: -1}},
    {key: {author: 1}},
    {key: {published: 1}}
  ]);

  // ------------------------------------------------------------- şekiller
  const run = p => posts.aggregate(p).toArray();
  // builder.ts:82-88 — countPipeline, sort/skip/limit eklenmeden ÖNCEki pipeline + $count
  const paginated = async (base, seeking) => {
    const countPipeline = [...base, {$count: "total"}];
    await Promise.all([run([...base, ...seeking]), posts.aggregate(countPipeline).next()]);
  };

  const shapes = [
    ["S1 · liste, filtresiz, limit 25", 1, () => run([SORT, {$limit: 25}])],
    ["S2 · filtre + limit 25", 1, () => run([FILTER, SORT, {$limit: 25}])],
    [
      "S3 · filtre + sıralama + sayfalama (data+count)",
      2,
      () => paginated([FILTER], [SORT, {$skip: 0}, {$limit: 25}])
    ],
    ["S4 · i18n + filtre + limit", 1, () => run([i18nStage(), FILTER, SORT, {$limit: 25}])],
    [
      "S5a · relation **filtrede** ($lookup filtreden önce)",
      1,
      () => run([...relationStages("bucket_authors"), FILTER, SORT, {$limit: 25}])
    ],
    [
      "S5b · relation **görüntüleme için** (`?relation=true`, lookup limit'ten sonra)",
      1,
      () => run([FILTER, SORT, {$limit: 25}, ...relationStages("bucket_authors")])
    ],
    ["S6 · ACL ($match) + filtre + limit", 1, () => run([ACL_MATCH, FILTER, SORT, {$limit: 25}])],
    [
      "S7 · gerçekçi tam yığın: i18n → ACL → filtre → sayfalama → relation → projeksiyon",
      2,
      () =>
        paginated(
          [i18nStage(), ACL_MATCH, FILTER],
          [
            SORT,
            {$skip: 0},
            {$limit: 25},
            ...relationStages("bucket_authors"),
            {$project: {title: 1, description: 1, views: 1, created_at: 1, author: 1}}
          ]
        )
    ],
    [
      "S8 · en kötü hal: i18n + relation filtrede + ACL + filtre + sayfalama",
      2,
      () =>
        paginated(
          [i18nStage(), ...relationStages("bucket_authors"), ACL_MATCH, FILTER],
          [SORT, {$skip: 0}, {$limit: 25}]
        )
    ]
  ];

  const results = [];
  for (const [label, trips, fn] of shapes) {
    process.stdout.write(`▸ ${label} … `);
    const s = await timeIt(fn, ITER);
    results.push({label, trips, ...s});
    console.log(`p50=${s.p50}ms p95=${s.p95}ms`);
  }

  // ------------------------------------------------------------- realtime gecikmesi
  process.stdout.write("▸ realtime: commit → change stream olayı … ");
  const stream = posts.watch([], {fullDocument: "updateLookup"});
  await new Promise(r => setTimeout(r, 500));
  const latencies = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const doc = {
      _id: new ObjectId(),
      title: {en_US: "rt", tr_TR: "rt"},
      views: 1,
      published: true,
      tags: [],
      created_at: new Date(),
      author: authorIds[0].toHexString()
    };
    const waitEvent = (async () => {
      await stream.next();
      return process.hrtime.bigint();
    })();
    const t0 = process.hrtime.bigint();
    await posts.insertOne(doc);
    const t1 = await waitEvent;
    latencies.push(Number(t1 - t0) / 1e6);
  }
  await stream.close();
  const rt = stats(latencies);
  console.log(`p50=${rt.p50}ms p95=${rt.p95}ms`);

  const serverStatus = await db.admin().serverStatus();
  await client.close();

  // ------------------------------------------------------------- rapor
  const md = `# Mongo baseline ölçümü

> \`scripts/baseline-mongo-read.mjs\` tarafından üretildi — elle düzenlenmez.
> Tarih: ${new Date().toISOString().slice(0, 10)} · MongoDB ${serverStatus.version} (tek düğüm replica set, Docker)
> Veri: ${POSTS.toLocaleString("tr-TR")} post + ${AUTHORS} author · ölçüm: ${WARMUP} warmup + ${ITER} iterasyon

Bu tablo [\`postgresql-backend-plan.md\` §5](./postgresql-backend-plan.md)'in karşılaştırma tabanıdır.
Pipeline şekilleri üretim kodundan birebir alındı (kaynak dosyalar script başlığında).

## Bucket-data okuma şekilleri

| Şekil | round-trip | p50 (ms) | p95 (ms) | p99 (ms) | ortalama |
|---|---|---|---|---|---|
${results.map(r => `| ${r.label} | ${r.trips} | ${r.p50} | **${r.p95}** | ${r.p99} | ${r.mean} |`).join("\n")}

**§5 hedefi:** PG'nin bucket-data list p95'i bu tablonun **%120'sini** geçmeyecek. Gerçekçi tam
yığın (S7) için üst sınır **${(results.find(r => r.label.startsWith("S7")).p95 * 1.2).toFixed(2)} ms**.

## Realtime gecikmesi (commit → change stream olayı)

| p50 (ms) | p95 (ms) | p99 (ms) | ortalama | örnek |
|---|---|---|---|---|
| ${rt.p50} | **${rt.p95}** | ${rt.p99} | ${rt.mean} | ${N} |

**§5 hedefi:** < 50 ms p95. Mongo baseline'ı ${rt.p95} ms; CDC (Faz 5) bu mertebeyi tutmak zorunda.

## Ölçümden çıkan notlar

1. **Sayfalama iki round-trip.** \`builder.ts:82-88\` filtre uygulandığında \`countPipeline\`
   üretiyor ve \`executePaginationPlan\` ikisini \`Promise.all\` ile paralel koşuyor. §5'in
   "sorgu başına round-trip = 1" satırı filtresiz liste için doğru, **filtreli sayfalama için 2**.
   PG tarafında \`COUNT(*) OVER ()\` ile tek statement'a indirilebilir — yani burada PG'nin
   baseline'ı geçme şansı var.
2. **i18n stage'i pahalı.** Her dokümanda \`$objectToArray\` → \`$filter\` → \`$map\` →
   \`$arrayToObject\` çalışıyor (S1 ile S4 farkı). PG'de karşılığı
   \`COALESCE(col->>'tr_TR', col->>'en_US')\` — kolon başına tek ifade.
3. **Relation alanı string olarak saklanıyor**, \`$toObjectId\` ile cast ediliyor
   (\`relation.ts:315-323\`). PG'deki \`char(24)\` eşlemesi bu yüzden birebir uyuyor; cast ihtiyacı
   ortadan kalkıyor.
4. **Ortam notu:** aynı makinede Docker içinde tek düğümlü mongod; ağ gecikmesi yok. PG ölçümü
   **aynı koşulda** yapılmadan karşılaştırma geçerli değildir.
`;

  const out = path.join(ROOT, "docs/baseline-mongo.md");
  fs.writeFileSync(out, md);
  console.log(`\n✓ docs/baseline-mongo.md yazıldı`);
}

main()
  .catch(e => {
    console.error("✗", e.message);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log("▸ container kaldırılıyor…");
    stopContainer();
  });
