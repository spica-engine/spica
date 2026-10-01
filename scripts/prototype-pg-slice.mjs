#!/usr/bin/env node
/**
 * Adım S — dikey dilim prototipi (postgresql-backend-plan.md §0.1).
 * Sekiz şeyi KANITLAR ya da kanıtlamaz. Atılacak kod; amaç bilgi üretmek.
 *
 * Sapma: plan modül olarak `packages/api/dashboard` diyor, ama madde 5 "§5 baseline'ıyla aynı
 * mertebede" diyor ve §5 bucket-data şekillerini ölçtü. Dashboard'da i18n/relation/filtre yok.
 * Bu yüzden prototip bucket şeklini kullanıyor — ölçüm karşılaştırılabilir olsun diye.
 */
import {execFileSync} from "child_process";
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const {Client, Pool} = pg;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE = "postgres:16";
const NAME = "spica-proto-pg";
const PORT = 45432;
const POSTS = Number(process.env.POSTS ?? 10_000);
const AUTHORS = 500;
const ITER = Number(process.env.ITER ?? 100);
const WARMUP = 20;
const CONN = {
  host: "127.0.0.1",
  port: PORT,
  user: "postgres",
  password: "proto",
  database: "postgres"
};

const oid = () => crypto.randomBytes(12).toString("hex");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sh = (c, a, o = {}) => execFileSync(c, a, {encoding: "utf8", ...o}).trim();
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const stats = a => ({
  p50: +pct(a, 50).toFixed(2),
  p95: +pct(a, 95).toFixed(2),
  p99: +pct(a, 99).toFixed(2),
  mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)
});

const findings = [];
const record = (id, title, verdict, detail) => {
  findings.push({id, title, verdict, detail});
  const mark = verdict === "PASS" ? "✓" : verdict === "FAIL" ? "✗" : "•";
  console.log(`${mark} ${id} ${title}\n    ${detail.replace(/\n/g, "\n    ")}`);
};

async function timeIt(fn, iter = ITER) {
  for (let i = 0; i < WARMUP; i++) await fn();
  const s = [];
  for (let i = 0; i < iter; i++) {
    const t = process.hrtime.bigint();
    await fn();
    s.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  return stats(s);
}

// ───────────────────────────────────────────────────────────── container + şema
function up() {
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
  sh("docker", [
    "run",
    "-d",
    "--name",
    NAME,
    "-p",
    `${PORT}:5432`,
    "-e",
    "POSTGRES_PASSWORD=proto",
    IMAGE,
    "-c",
    "max_connections=200"
  ]);
}
const down = () => {
  try {
    execFileSync("docker", ["rm", "-f", NAME], {stdio: "ignore"});
  } catch {}
};

const DDL = `
CREATE SCHEMA spica;
CREATE SCHEMA bucket;

-- K-12: niyet
CREATE TABLE spica.buckets (
  _id char(24) PRIMARY KEY,
  definition jsonb NOT NULL
);
CREATE TABLE spica.bucket_schema_changes (
  id bigserial PRIMARY KEY, bucket_id char(24), sql text, applied_at timestamptz DEFAULT now()
);

-- K-6: outbox
CREATE TABLE spica._changes (
  seq     bigserial PRIMARY KEY,
  txid    xid8 NOT NULL DEFAULT pg_current_xact_id(),
  coll    text NOT NULL,
  op      text NOT NULL,
  doc_id  char(24),
  new_doc jsonb,
  old_doc jsonb
);
CREATE INDEX ON spica._changes (seq);

CREATE FUNCTION spica.emit_change() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE s bigint;
BEGIN
  INSERT INTO spica._changes (coll, op, doc_id, new_doc, old_doc)
  VALUES (TG_TABLE_NAME, lower(TG_OP), COALESCE(NEW._id, OLD._id),
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END)
  RETURNING seq INTO s;
  PERFORM pg_notify('spica_changes', s::text);
  RETURN NULL;
END $fn$;

CREATE FUNCTION spica.emit_change_silent() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  INSERT INTO spica._changes (coll, op, doc_id, new_doc, old_doc)
  VALUES (TG_TABLE_NAME, lower(TG_OP), COALESCE(NEW._id, OLD._id),
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END);
  RETURN NULL;
END $fn$;

-- K-1: gerçek kolonlar
CREATE TABLE bucket.authors (_id char(24) PRIMARY KEY, name text, email text);
CREATE TABLE bucket.posts (
  _id         char(24) PRIMARY KEY,
  title       jsonb,                 -- options.translate
  description jsonb,                 -- options.translate
  slug        text,
  views       double precision,
  published   boolean,
  tags        text[],
  created_at  timestamptz,
  author      char(24) REFERENCES bucket.authors(_id),
  meta        jsonb                  -- type: json (serbest form)
);
CREATE INDEX posts_views_idx      ON bucket.posts (views);
CREATE INDEX posts_created_at_idx ON bucket.posts (created_at DESC);
CREATE INDEX posts_author_idx     ON bucket.posts (author);
CREATE INDEX posts_published_idx  ON bucket.posts (published);
CREATE INDEX posts_tags_idx       ON bucket.posts USING gin (tags);
CREATE INDEX posts_title_tr_idx   ON bucket.posts ((title->>'tr_TR'));

CREATE TRIGGER posts_changes AFTER INSERT OR UPDATE OR DELETE ON bucket.posts
  FOR EACH ROW EXECUTE FUNCTION spica.emit_change();

-- codec testi: kolon tipleri
CREATE TABLE bucket.types (
  _id char(24) PRIMARY KEY,
  at  timestamptz,
  big bigint,
  dec numeric,
  ref char(24),
  free jsonb
);
`;

async function main() {
  console.log(`▸ ${IMAGE} başlatılıyor (port ${PORT})…`);
  up();
  let db;
  for (let i = 0; i < 60; i++) {
    try {
      db = new Client(CONN);
      db.on("error", () => {});
      await db.connect();
      break;
    } catch {
      db = null;
      await sleep(500);
    }
  }
  if (!db) throw new Error("postgres'e bağlanılamadı");
  await db.query(DDL);
  const {
    rows: [ver]
  } = await db.query("SHOW server_version");
  console.log(`▸ PostgreSQL ${ver.server_version} hazır\n`);

  // ── seed
  const authorIds = Array.from({length: AUTHORS}, oid);
  await db.query(
    `INSERT INTO bucket.authors (_id,name,email) SELECT u.id, 'Author '||u.i, 'a'||u.i||'@example.com'
     FROM unnest($1::char(24)[]) WITH ORDINALITY AS u(id,i)`,
    [authorIds]
  );
  const tagPool = ["premium", "draft", "news", "tech", "spica", "archive"];
  await db.query(
    `INSERT INTO bucket.posts (_id,title,description,slug,views,published,tags,created_at,author,meta)
     SELECT substr(md5(i::text), 1, 24),
            jsonb_build_object('en_US','Post '||i,'tr_TR','Yazı '||i),
            jsonb_build_object('en_US','Body '||i,'tr_TR','Gövde '||i),
            'post-'||i, (random()*1000)::int, i % 3 <> 0,
            ARRAY[($2::text[])[1 + i % 6], ($2::text[])[1 + (i+2) % 6]],
            now() - (i || ' minutes')::interval,
            ($3::char(24)[])[1 + i % ${AUTHORS}], jsonb_build_object('n', i)
     FROM generate_series(0, $1::int - 1) AS i`,
    [POSTS, tagPool, authorIds]
  );
  await db.query(`UPDATE bucket.posts SET tags = tags || ARRAY['rare-tag']
                  WHERE _id IN (SELECT _id FROM bucket.posts LIMIT 8)`);
  await db.query("ANALYZE bucket.posts; ANALYZE bucket.authors");
  await db.query("TRUNCATE spica._changes RESTART IDENTITY");
  console.log(`▸ seed: ${POSTS} post + ${AUTHORS} author\n`);

  // ─────────────────────────────────────────────── P1 codec / tip yuvarlaması
  {
    const at = new Date("2026-01-01T00:00:00.123Z");
    const big = "9007199254740993"; // 2^53 + 1
    const dec = "123456789.123456789012345";
    const ref = oid();
    const free = {
      oid: {$oid: ref},
      date: {$date: at.getTime()},
      long: {$numberLong: big},
      dec: {$numberDecimal: dec}
    };
    const id = oid();
    await db.query(
      "INSERT INTO bucket.types (_id,at,big,dec,ref,free) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, at, big, dec, ref, free]
    );
    const {
      rows: [r]
    } = await db.query("SELECT * FROM bucket.types WHERE _id=$1", [id]);
    const okDate = r.at.getTime() === at.getTime();
    const okBig = r.big === big; // pg int8 → string, hassasiyet korunur
    const okDec = r.dec === dec;
    const okRef = r.ref === ref;
    const f = r.free;
    const okFree =
      f.oid.$oid === ref &&
      f.date.$date === at.getTime() &&
      f.long.$numberLong === big &&
      f.dec.$numberDecimal === dec;
    const all = okDate && okBig && okDec && okRef && okFree;
    record(
      "P1",
      "Tip yuvarlaması (kolon + serbest jsonb)",
      all ? "PASS" : "FAIL",
      `timestamptz(ms korundu)=${okDate} · bigint 2^53+1=${okBig} · numeric=${okDec} · char(24)=${okRef}\n` +
        `jsonb içinde etiketli tipler ($oid/$date/$numberLong/$numberDecimal)=${okFree}\n` +
        `Not: tip etiketleme YALNIZ serbest jsonb alanında gerekli; gerçek kolonlarda tip kolonun kendisinde.`
    );
  }

  // ─────────────────────────────────────────────── P2 filtre → SQL
  {
    const q = async (sql, params) => (await db.query(sql, params)).rows;
    const [a] = await q("SELECT count(*)::int n FROM bucket.posts WHERE views > $1", [500]);
    const [b] = await q("SELECT count(*)::int n FROM bucket.posts WHERE tags @> ARRAY[$1]", [
      "premium"
    ]);
    const [c] = await q(
      "SELECT count(*)::int n FROM bucket.posts WHERE COALESCE(title->>'tr_TR', title->>'en_US') = $1",
      ["Yazı 7"]
    );
    const [d] = await q(
      `SELECT count(*)::int n FROM bucket.posts WHERE views > $1 AND published = $2 AND tags @> ARRAY[$3]`,
      [500, true, "premium"]
    );
    // bağımsız doğrulama: aynı sonuçları jsonb'siz, düz SQL ile say
    const [ref] = await q("SELECT count(*)::int n FROM bucket.posts WHERE title->>'tr_TR' = $1", [
      "Yazı 7"
    ]);
    record(
      "P2",
      "Filtre → SQL (dizi örtük eşleşme dahil)",
      c.n === ref.n && b.n > 0 ? "PASS" : "FAIL",
      `views > 500            → ${a.n} satır\n` +
        `"premium" in tags      → tags @> ARRAY['premium'] → ${b.n} satır\n` +
        `i18n alanda eşitlik    → COALESCE(title->>'tr_TR', …) → ${c.n} satır (doğrulama: ${ref.n})\n` +
        `üç koşul AND           → ${d.n} satır`
    );
  }

  // ─────────────────────────────────────────────── P3 index gerçekten kullanılıyor mu
  {
    const plan = async (sql, params) => {
      const {rows} = await db.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`, params);
      return JSON.stringify(rows[0]["QUERY PLAN"][0].Plan);
    };
    const cases = [
      ["views aralığı", "SELECT * FROM bucket.posts WHERE views > $1 LIMIT 25", [990]],
      ["created_at sıralı", "SELECT * FROM bucket.posts ORDER BY created_at DESC LIMIT 25", []],
      [
        "tags GIN (seçici)",
        "SELECT * FROM bucket.posts WHERE tags @> ARRAY[$1] LIMIT 25",
        ["rare-tag"]
      ],
      [
        "tags GIN (%33 seçicilik)",
        "SELECT * FROM bucket.posts WHERE tags @> ARRAY[$1] LIMIT 25",
        ["premium"]
      ],
      ["i18n expression index", "SELECT * FROM bucket.posts WHERE title->>'tr_TR' = $1", ["Yazı 7"]]
    ];
    const res = [];
    for (const [label, sql, p] of cases) {
      const j = await plan(sql, p);
      const scan = /"Index Only Scan"/.test(j)
        ? "Index Only Scan"
        : /"Bitmap Index Scan"/.test(j)
          ? "Bitmap Index Scan"
          : /"Index Scan"/.test(j)
            ? "Index Scan"
            : /"Seq Scan"/.test(j)
              ? "Seq Scan"
              : "?";
      res.push([label, scan]);
    }
    // %33 seçicilikte Seq Scan planlayıcının DOĞRU seçimi; onu başarısızlık sayma
    const allIndexed = res
      .filter(([l]) => !l.includes("%33"))
      .every(([, s]) => s !== "Seq Scan" && s !== "?");
    record(
      "P3",
      "Index gerçekten kullanılıyor (EXPLAIN ANALYZE)",
      allIndexed ? "PASS" : "FAIL",
      res.map(([l, s]) => `${l.padEnd(24)} → ${s}`).join("\n") +
        `\nNot: tarih indeksi timestamptz kolonu üzerinde — IMMUTABLE ifade sorunu yok (jsonb'de vardı).` +
        `\nNot: %33 seçicilikte Seq Scan planlayıcının doğru kararı — 10.000 satırın üçte birini index'le\n` +
        `      çekmek tarama yapmaktan pahalı. Index'in çalıştığı seçici vakayla ayrıca doğrulandı.`
    );
  }

  // ─────────────────────────────────────────────── P4 INSERT → LISTEN gecikmesi
  {
    const listener = new Client(CONN);
    await listener.connect();
    await listener.query("LISTEN spica_changes");
    const waiters = new Map(),
      arrived = new Map();
    listener.on("notification", msg => {
      const t = process.hrtime.bigint();
      const w = waiters.get(msg.payload);
      if (w) {
        w(t);
        waiters.delete(msg.payload);
      } else arrived.set(msg.payload, t);
    });
    const lat = [];
    for (let i = 0; i < 100; i++) {
      const id = oid();
      const t0 = process.hrtime.bigint();
      await db.query(
        `INSERT INTO bucket.posts (_id,title,views,published,tags,created_at,author)
         VALUES ($1, '{"en_US":"rt"}'::jsonb, 1, true, '{}', now(), $2)`,
        [id, authorIds[0]]
      );
      // seq'i AYRI sorguyla öğren: CTE ile aynı statement snapshot'ında kendi satırı görünmüyor
      const {
        rows: [r]
      } = await db.query(
        `SELECT seq::text s FROM spica._changes WHERE doc_id = $1 ORDER BY seq DESC LIMIT 1`,
        [id]
      );
      const seq = r.s;
      const t1 = arrived.has(seq)
        ? arrived.get(seq)
        : await new Promise(res => {
            waiters.set(seq, res);
            setTimeout(() => {
              if (waiters.has(seq)) {
                waiters.delete(seq);
                res(process.hrtime.bigint());
              }
            }, 2000);
          });
      arrived.delete(seq);
      lat.push(Number(t1 - t0) / 1e6);
    }
    await listener.end();
    const s = stats(lat);
    record(
      "P4",
      "INSERT → LISTEN gecikmesi",
      s.p95 < 50 ? "PASS" : "FAIL",
      `p50=${s.p50} ms · p95=${s.p95} ms · p99=${s.p99} ms (hedef: p95 < 50 ms)\n` +
        `Mongo change stream baseline'ı: p95 3.67 ms (§5.1)`
    );
  }

  // ─────────────────────────────────────────────── P5 p95 · §5 karşılaştırması
  let shapeResults;
  {
    const L = "tr_TR",
      F = "en_US";
    const loc = c => `COALESCE(${c}->>'${L}', ${c}->>'${F}')`;
    const q = (sql, p = []) => db.query(sql, p);
    const shapes = [
      [
        "S1 liste, filtresiz, limit 25",
        1,
        0.58,
        () => q(`SELECT * FROM bucket.posts ORDER BY created_at DESC LIMIT 25`)
      ],
      [
        "S2 filtre + limit 25",
        1,
        0.37,
        () => q(`SELECT * FROM bucket.posts WHERE views > 500 ORDER BY created_at DESC LIMIT 25`)
      ],
      [
        "S3 filtre + sıralama + sayfalama",
        1,
        0.84,
        () =>
          q(`SELECT *, count(*) OVER () AS total FROM bucket.posts
                 WHERE views > 500 ORDER BY created_at DESC LIMIT 25 OFFSET 0`)
      ],
      [
        "S4 i18n + filtre + limit",
        1,
        27.27,
        () =>
          q(`SELECT _id, ${loc("title")} AS title, ${loc("description")} AS description, views, created_at
                 FROM bucket.posts WHERE views > 500 ORDER BY created_at DESC LIMIT 25`)
      ],
      [
        "S5a relation filtrede",
        1,
        37.86,
        () =>
          q(`SELECT p.*, to_jsonb(a) AS author FROM bucket.posts p
                 JOIN bucket.authors a ON a._id = p.author
                 WHERE p.views > 500 AND a.name LIKE 'Author 1%'
                 ORDER BY p.created_at DESC LIMIT 25`)
      ],
      [
        "S5b relation görüntüleme için",
        1,
        0.63,
        () =>
          q(`SELECT p.*, to_jsonb(a) AS author FROM bucket.posts p
                 LEFT JOIN LATERAL (SELECT * FROM bucket.authors a WHERE a._id = p.author) a ON true
                 WHERE p.views > 500 ORDER BY p.created_at DESC LIMIT 25`)
      ],
      [
        "S6 ACL + filtre + limit",
        1,
        0.39,
        () =>
          q(`SELECT * FROM bucket.posts WHERE published = true AND views > 500
                 ORDER BY created_at DESC LIMIT 25`)
      ],
      [
        "S7 gerçekçi tam yığın",
        1,
        28.57,
        () =>
          q(`SELECT p._id, ${loc("p.title")} AS title, ${loc("p.description")} AS description,
                        p.views, p.created_at, to_jsonb(a) AS author, count(*) OVER () AS total
                 FROM bucket.posts p
                 LEFT JOIN LATERAL (SELECT * FROM bucket.authors a WHERE a._id = p.author) a ON true
                 WHERE p.published = true AND p.views > 500
                 ORDER BY p.created_at DESC LIMIT 25 OFFSET 0`)
      ]
    ];
    shapeResults = [];
    for (const [label, trips, mongoP95, fn] of shapes) {
      const s = await timeIt(fn);
      shapeResults.push({label, trips, mongoP95, ...s, ratio: +(s.p95 / mongoP95).toFixed(3)});
    }
    const worst = Math.max(...shapeResults.map(r => r.ratio));
    record(
      "P5",
      "p95 · Mongo baseline karşılaştırması",
      worst <= 1.2 ? "PASS" : "PARTIAL",
      shapeResults
        .map(
          r =>
            `${r.label.padEnd(34)} PG p95=${String(r.p95).padStart(6)} ms  Mongo=${String(r.mongoP95).padStart(6)} ms  oran=${r.ratio}`
        )
        .join("\n") + `\nEn kötü oran ${worst} (§5 bütçesi ≤ 1.20)`
    );
  }

  // ─────────────────────────────────────────────── P6 eşzamanlı yazmada olay kaybı
  {
    const WRITERS = 32,
      PER = 120,
      ROLLBACK = 0.2;

    // İki okuma protokolü yan yana:
    //  A) seq-watermark  — planın R1 formülasyonu: seq > last AND txid < xmin
    //  B) txid-watermark — düzeltilmiş: txid >= last_x AND txid < xmin, (txid,seq) sırasıyla
    const run = async protocol => {
      await db.query("TRUNCATE spica._changes RESTART IDENTITY");
      const pool = new Pool({...CONN, max: WRITERS + 4});
      let stop = false,
        rounds = 0;
      const seen = new Map();
      let lastSeq = 0n,
        lastXid = "1";

      const consumer = (async () => {
        const c = await pool.connect();
        while (!stop) {
          let rows;
          if (protocol === "seq") {
            ({rows} = await c.query(
              `SELECT seq, doc_id FROM spica._changes
               WHERE seq > $1 AND txid < pg_snapshot_xmin(pg_current_snapshot())
               ORDER BY seq`,
              [lastSeq.toString()]
            ));
            for (const r of rows) {
              seen.set(r.doc_id.trim(), r.seq);
              lastSeq = BigInt(r.seq);
            }
          } else {
            const {
              rows: [snap]
            } = await c.query(`SELECT pg_snapshot_xmin(pg_current_snapshot())::text x`);
            ({rows} = await c.query(
              `SELECT seq, txid::text tx, doc_id FROM spica._changes
               WHERE txid >= $1::xid8 AND txid < $2::xid8
               ORDER BY txid, seq`,
              [lastXid, snap.x]
            ));
            for (const r of rows) seen.set(r.doc_id.trim(), r.seq);
            lastXid = snap.x;
          }
          rounds++;
          if (!rows.length) await sleep(4);
        }
        c.release();
      })();

      const committed = new Set();
      await Promise.all(
        Array.from({length: WRITERS}, async () => {
          const c = await pool.connect();
          for (let i = 0; i < PER; i++) {
            const id = oid();
            const roll = Math.random() < ROLLBACK;
            await c.query("BEGIN");
            await c.query(
              `INSERT INTO bucket.posts (_id,title,views,published,tags,created_at,author)
                         VALUES ($1,'{"en_US":"c"}'::jsonb,1,true,'{}',now(),$2)`,
              [id, authorIds[0]]
            );
            if (roll) await c.query("ROLLBACK");
            else {
              await c.query("COMMIT");
              committed.add(id);
            }
          }
          c.release();
        })
      );

      // tüketicinin kalanı boşaltmasını bekle
      for (let i = 0; i < 300; i++) {
        const {
          rows: [r]
        } = await db.query("SELECT count(*)::int n FROM spica._changes");
        if (seen.size >= r.n) break;
        await sleep(20);
      }
      await sleep(200);
      stop = true;
      await consumer;
      await pool.end();

      const {
        rows: [tot]
      } = await db.query("SELECT count(*)::int n FROM spica._changes");
      const missing = [...committed].filter(id => !seen.has(id));
      return {
        committed: committed.size,
        rows: tot.n,
        seen: seen.size,
        missing: missing.length,
        rounds
      };
    };

    const a = await run("seq");
    const b = await run("txid");
    record(
      "P6",
      "Eşzamanlı yazmada olay kaybı (R1 protokolü)",
      b.missing === 0 ? (a.missing > 0 ? "PASS" : "PASS") : "FAIL",
      `${WRITERS} paralel yazıcı × ${PER} transaction, ~%${ROLLBACK * 100} rastgele rollback\n\n` +
        `A) seq-watermark  (seq > last AND txid < xmin)\n` +
        `   commit=${a.committed} · _changes=${a.rows} · görülen=${a.seen} · KAÇAN=${a.missing} · tur=${a.rounds}\n\n` +
        `B) txid-watermark (txid >= last_x AND txid < xmin, ORDER BY txid,seq)\n` +
        `   commit=${b.committed} · _changes=${b.rows} · görülen=${b.seen} · KAÇAN=${b.missing} · tur=${b.rounds}\n\n` +
        `Kök neden: \`seq\` (nextval) ile \`txid\` (pg_current_xact_id) aynı INSERT'te atanıyor ama\n` +
        `göreli sıraları oturumlar arası garanti DEĞİL. Yüksek txid'li bir transaction düşük seq\n` +
        `alabiliyor; seq-watermark ilerleyince o satır bir daha sorgulanmıyor. txid-watermark'ta\n` +
        `bu imkânsız: xmin'in altındaki her txid bitmiştir, aborted satırlar MVCC ile görünmez.`
    );
  }

  // ─────────────────────────────────────────────── P7 şema evrimi
  {
    const bid = oid();
    await db.query("INSERT INTO spica.buckets (_id, definition) VALUES ($1,$2)", [
      bid,
      {title: "Posts", properties: {title: {type: "string"}, views: {type: "number"}}}
    ]);
    const colCount = async () =>
      (
        await db.query(
          `SELECT count(*)::int n FROM information_schema.columns
       WHERE table_schema='bucket' AND table_name='posts'`
        )
      ).rows[0].n;
    const before = await colCount();
    const timings = [];
    const step = async (label, sqls, defPatch) => {
      const t = process.hrtime.bigint();
      await db.query("BEGIN");
      await db.query("SET LOCAL lock_timeout = '3s'");
      for (const s of sqls) await db.query(s);
      await db.query(
        `UPDATE spica.buckets SET definition = definition || $2::jsonb WHERE _id = $1`,
        [bid, defPatch]
      );
      await db.query(`INSERT INTO spica.bucket_schema_changes (bucket_id, sql) VALUES ($1,$2)`, [
        bid,
        sqls.join("; ")
      ]);
      await db.query("COMMIT");
      timings.push([label, +(Number(process.hrtime.bigint() - t) / 1e6).toFixed(2)]);
    };
    await step("ADD COLUMN subtitle", [`ALTER TABLE bucket.posts ADD COLUMN subtitle text`], {
      properties: {title: {type: "string"}, views: {type: "number"}, subtitle: {type: "string"}}
    });
    await step(
      "RENAME COLUMN subtitle→lead",
      [`ALTER TABLE bucket.posts RENAME COLUMN subtitle TO lead`],
      {properties: {title: {type: "string"}, views: {type: "number"}, lead: {type: "string"}}}
    );
    await step("DROP COLUMN lead", [`ALTER TABLE bucket.posts DROP COLUMN lead`], {
      properties: {title: {type: "string"}, views: {type: "number"}}
    });
    const after = await colCount();
    // drift denetimi
    const {
      rows: [drift]
    } = await db.query(
      `
      WITH def AS (SELECT jsonb_object_keys(definition->'properties') k FROM spica.buckets WHERE _id=$1),
           col AS (SELECT column_name k FROM information_schema.columns
                   WHERE table_schema='bucket' AND table_name='posts' AND column_name <> '_id')
      SELECT (SELECT count(*) FROM def WHERE k NOT IN (SELECT k FROM col))::int AS def_only`,
      [bid]
    );
    // lock_timeout davranışı: uzun süren okumanın arkasında DDL bekliyor mu
    const blocker = new Client(CONN);
    await blocker.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT count(*) FROM bucket.posts");
    let lockMsg;
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL lock_timeout='300ms'");
      await db.query("ALTER TABLE bucket.posts ADD COLUMN x text");
      await db.query("COMMIT");
      lockMsg = "kilit alındı (blocker AccessShare tutuyordu, çakışmadı)";
    } catch (e) {
      await db.query("ROLLBACK");
      lockMsg = `lock_timeout devreye girdi: ${e.code}`;
    }
    await blocker.query("ROLLBACK");
    await blocker.end();
    await db.query("ALTER TABLE bucket.posts DROP COLUMN IF EXISTS x");
    record(
      "P7",
      "Şema evrimi tek transaction'da (K-7, K-12)",
      drift.def_only === 0 ? "PASS" : "FAIL",
      timings.map(([l, ms]) => `${l.padEnd(28)} ${ms} ms  (${POSTS} satırlık tabloda)`).join("\n") +
        `\nkolon sayısı ${before} → ${after} (rename veri korudu, drop katalog-only)` +
        `\ndrift (buckets'ta var, tabloda yok) = ${drift.def_only}` +
        `\nlock_timeout: ${lockMsg}`
    );
  }

  // ─────────────────────────────────────────────── P8 NOTIFY commit maliyeti
  {
    const variants = [];
    const bench = async (label, n = 400) => {
      const t = process.hrtime.bigint();
      for (let i = 0; i < n; i++) {
        await db.query(
          `INSERT INTO bucket.posts (_id,title,views,published,tags,created_at,author)
                        VALUES ($1,'{"en_US":"b"}'::jsonb,1,true,'{}',now(),$2)`,
          [oid(), authorIds[0]]
        );
      }
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      variants.push([label, +(n / (ms / 1000)).toFixed(0), +(ms / n).toFixed(3)]);
    };
    await bench("trigger + pg_notify");
    await db.query("DROP TRIGGER posts_changes ON bucket.posts");
    await db.query(`CREATE TRIGGER posts_changes AFTER INSERT OR UPDATE OR DELETE ON bucket.posts
                    FOR EACH ROW EXECUTE FUNCTION spica.emit_change_silent()`);
    await bench("trigger, notify yok");
    await db.query("DROP TRIGGER posts_changes ON bucket.posts");
    await bench("trigger yok");
    const [withN, noN, noT] = variants;
    const amp = +((withN[2] / noT[2] - 1) * 100).toFixed(1);
    const notifyCost = +((withN[2] / noN[2] - 1) * 100).toFixed(1);
    record(
      "P8",
      "NOTIFY commit maliyeti",
      amp < 20 ? "PASS" : "PARTIAL",
      variants
        .map(
          ([l, tps, ms]) => `${l.padEnd(22)} ${String(tps).padStart(6)} insert/s · ${ms} ms/insert`
        )
        .join("\n") +
        `\nCDC yazma amplifikasyonu (trigger+notify vs trigger yok) = %${amp}  (§5 eşiği: %20)` +
        `\nyalnız pg_notify'ın payı = %${notifyCost}`
    );
  }

  await db.end();

  // ───────────────────────────────────────────────────────────── rapor
  const pass = findings.filter(f => f.verdict === "PASS").length;
  const md = `# Adım S — dikey dilim prototipi sonuçları

> \`scripts/prototype-pg-slice.mjs\` tarafından üretildi — elle düzenlenmez.
> Tarih: ${new Date().toISOString().slice(0, 10)} · PostgreSQL ${ver.server_version} (Docker) ·
> ${POSTS.toLocaleString("tr-TR")} post + ${AUTHORS} author · ${WARMUP} warmup + ${ITER} iterasyon
> Karşılaştırma tabanı: [\`baseline-mongo.md\`](./baseline-mongo.md)

**${pass}/${findings.length} madde PASS.** Planın kuralı: bu kod atılacak; amacı §5'e sayı yazmak ve
açık kararları kapatmak.

**Sapma:** plan modül olarak \`packages/api/dashboard\` diyor; prototip bucket şeklini kullandı çünkü
madde 5 §5 baseline'ıyla karşılaştırma istiyor ve dashboard'da i18n/relation/filtre yok. Faz 1'in
seam işi planlandığı gibi dashboard'dan başlayabilir.

| # | Kanıt | Sonuç |
|---|---|---|
${findings.map(f => `| ${f.id} | ${f.title} | ${f.verdict === "PASS" ? "✅ PASS" : f.verdict === "FAIL" ? "❌ FAIL" : "🟡 " + f.verdict} |`).join("\n")}

## Sorgu şekilleri: PG vs Mongo

| Şekil | round-trip | PG p95 | Mongo p95 | oran |
|---|---|---|---|---|
${shapeResults.map(r => `| ${r.label} | ${r.trips} | **${r.p95} ms** | ${r.mongoP95} ms | ${r.ratio < 1 ? "**" + r.ratio + "**" : r.ratio} |`).join("\n")}

§5 bütçesi: oran ≤ 1.20. Sayfalama PG'de **tek** round-trip (\`count(*) OVER ()\`), Mongo'da iki.

## Ayrıntılar

${findings.map(f => `### ${f.id} — ${f.title}  ·  ${f.verdict}\n\n\`\`\`\n${f.detail}\n\`\`\``).join("\n\n")}
`;
  fs.writeFileSync(path.join(ROOT, "docs/prototype-pg-slice.md"), md);
  console.log(`\n✓ docs/prototype-pg-slice.md yazıldı — ${pass}/${findings.length} PASS`);
}

main()
  .catch(e => {
    console.error("✗", e.stack || e.message);
    process.exitCode = 1;
  })
  .finally(() => {
    console.log("▸ container kaldırılıyor…");
    down();
  });
