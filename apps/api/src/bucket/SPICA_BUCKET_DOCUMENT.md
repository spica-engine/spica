# Bucket Module — End‑User Guide

The Bucket module is a flexible, schema-driven data store. A “bucket” is like a collection/table; each document (row) follows the bucket schema. Buckets support relations, ACL (access control), localization, history, indexing, limits, and realtime updates.

This guide explains how to model data, set access rules, and perform CRUD with clear request/response examples.

## Key Concepts

- **Bucket**: A container of documents defined by a schema.
- **Document**: A JSON object stored in a bucket.
- **Properties**: Fields of your documents, each with a type and options.
- **Primary property**: The main display field of a bucket (string recommended).
- **ACL(ACR)**: Read/write rules to control who can access or modify data.
- **Relations**: References to documents in the same or another bucket (one‑to‑one or one‑to‑many).
- **Localization**: Store and request localized values; respond based on Accept-Language.
- **History**: Track changes to documents and revert to previous versions if enabled.
- **Indexes**: Improve query performance by indexing fields.
- **Limits**: Limit document count and specify behavior when the limit is exceeded.
- **Category**: Optional bucket categorization for organizational purposes.
- **Order**: Bucket display ordering in admin interface.
- **ReadOnly**: When enabled, bucket data cannot be modified through the UI.

## Supported Property Types

Use these types when defining properties in a bucket schema:

- `string` — text
- `number` — numeric values
- `boolean` — true/false
- `object` — nested object
- `array` — list of values
- `date` — ISO date/time
- `storage` — file/asset reference
- `richtext` — HTML-capable content
- `textarea` — multi-line text
- `color` — color value
- `multiselect` — multiple selectable options
- `relation` — reference to other bucket document(s)
- `location` — geolocation data (GeoJSON Point)
- `json` — arbitrary JSON blob

### Property Options

Each property can have the following options:

- `position`: UI layout position - "left", "right", or "bottom"
- `translate`: Enable localization for this property (boolean)
- `unique`: Make this property unique across documents (boolean)
- `index`: Create database index for this property (boolean)
- `history`: Track changes for this property (boolean)

**Note**: Not all property types support all options. For example, `location` type cannot be indexed with the `index` option.

### Property Naming Rules

Property names must follow these rules:

- Only lowercase letters, numbers, and underscores allowed
- Cannot be named `_id` (reserved for document ID)
- Pattern: `^(?!(_id)$)([a-z_0-9]*)+$`

Examples:

- ✅ Valid: `user_name`, `price`, `created_at`, `category_id`
- ❌ Invalid: `_id`, `UserName`, `user-name`, `user name`

## Example Bucket Schema (JSON)

Below is a realistic schema for a product catalog.

```json
{
  "title": "Product",
  "icon": "shopping_bag",
  "description": "Store catalog products",
  "category": "E-commerce",
  "order": 1,
  "readOnly": false,
  "primary": "name",
  "history": true,
  "required": ["name", "price"],
  "properties": {
    "name": {
      "type": "string",
      "title": "Name",
      "description": "Product name",
      "options": {"position": "left", "translate": true}
    },
    "price": {
      "type": "number",
      "title": "Price",
      "options": {"position": "left"}
    },
    "in_stock": {"type": "boolean", "title": "In Stock", "options": {"position": "left"}},
    "category": {
      "type": "relation",
      "title": "Category",
      "description": "One category per product",
      "relationType": "onetoone",
      "bucketId": "689b4a51e893e334440745a3",
      "dependent": false,
      "options": {"position": "right"}
    },
    "tags": {
      "type": "multiselect",
      "title": "Tags",
      "enum": ["sale", "featured", "new", "eco"],
      "options": {"position": "right"}
    },
    "location": {
      "type": "location",
      "title": "Store Location",
      "locationType": "Point",
      "options": {"position": "right"}
    },
    "images": {"type": "storage", "title": "Images", "options": {"position": "bottom"}},
    "specs": {"type": "json", "title": "Specifications", "options": {"position": "bottom"}}
  },
  "acl": {
    "read": "true==true",
    "write": "user.role=='admin'"
  },
  "documentSettings": {
    "countLimit": 20000,
    "limitExceedBehaviour": "prevent"
  },
  "indexes": [
    {"definition": {"price": 1}, "options": {"unique": false}},
    {"definition": {"name": 1}, "options": {"unique": true}}
  ]
}
```

Notes:

- `relationType` can be "onetoone" or "onetomany". For many, the value is an array of ids.
- Use `bucketId` to point to the related bucket and `dependent` to mark dependency behavior (when true, dependent entries can be considered during deletes).
- `options.translate` enables localization per property. Use Accept-Language in requests to get localized content.
- `documentSettings.limitExceedBehaviour`: "prevent" blocks new inserts when limit is reached; "remove" removes older documents to make room (retention behavior may be oldest-first).
- `category` and `order` help organize buckets in the admin interface.
- `readOnly` prevents data modification through the UI when set to true.
- `location` type supports GeoJSON Point coordinates with `locationType: "Point"`.
- Property options include `position` ("left", "right", "bottom"), `translate`, `unique`, and `index`.

## Access Control Rules (ACR)

Access Control Rules add a security layer in front of bucket APIs. ACR integrates with the Passport system and can access identity information. For business-domain accounts, consider creating a bucket that stores your application users (profile) and link each entry to a unique identifier from Passport.

At request time, the Passport module provides the following to the ACR engine:

- `auth._id`
- `auth.identifier`

You can define separate rules for reading and writing:

- Writing ACR applies to: INSERT, UPDATE, PATCH, DELETE
- Reading ACR applies to: INDEX (list), GET (single)

Inside rules, you can access the target bucket document via the `document` variable.

Note: ACR affects the Bucket UI as well because the UI consumes the same APIs.

Example bucket schema fields:

- `identifier: string`
- `name: string`
- `address: location`
- `age: number`

Examples:

- Writing: `(auth.identifier == document.identifier) && (document.age > 18)`
- Reading: `true == true`

Explanation: Users can write only to their own entry (matching identifier) and only if the entry’s `age > 18`. Reads are open to everyone.

Accepted operators

- Comparing: `<`, `<=`, `>=`, `>`, `==`, `!=`
  - Example: `document.age >= 18`
- Math operators: `*`, `+`, `-`, `/`, `%`
  - Example: `document.age >= document.allowed_age - 20`

Macros

- Structure operations
  - `has(propertyName)`: returns true if the document has the property
    - Example: `document.age >= 18 && has(document.access) && !has(document.banned)`
- Array operations
  - `equal(fieldPath: Array, comparingValues: Array)`: returns true if the value equals all comparing values combined
    - Example: `equal(document.tag, ['herbal','animal','milk'])`
  - `every(fieldPath: Array, comparingValues: Array)`: returns true if the value includes every comparing value
    - Example: `every(document.tag, ['herbal','animal'])`
  - `some(fieldPath: Array, comparingValues: Array)`: returns true if the value includes at least one comparing value
    - Example: `some(document.tag, ['herbal','animal'])`
- String operations
  - `regex(fieldPath: string, pattern: string, flag: string)`: returns true if the value matches the regex
    - Example: `regex(document.title, 'CEO', 'i') // true for "ceo"`
- Date operations
  - `unixTime(fieldPath: Date)`: returns the Unix timestamp of the value
    - Example: `now() - unixTime(document.created_at) > 3600`
  - `now()`: returns current time as Unix timestamp

## REST API — Endpoints and Parameters

Base path examples below use bucket id or slug as `{bucketId}`.

- **List documents**

  - `GET /bucket/{bucketId}/data`
  - Query params:
    - `paginate=true` (server default) returns `{ data, meta }`
    - `relation=true|false` resolves relation ids into full objects
    - `limit`, `skip` for pagination
    - `sort`: JSON string, e.g. `{ "price": -1, "name": 1 }`
    - `filter`: JSON string (MongoDB match) or rules string (see Filtering)
  - Headers:
    - `Authorization`: Bearer `<token>` (or API key)
    - `Accept-Language`: e.g. `en-EN` (optional)

- **List profile entries (advanced)**

  - `GET /bucket/{bucketId}/data/profile`
  - Query params: `filter`, `limit`, `skip`, `sort`
  - Special endpoint for profiling/debugging queries

- **Get one document**

  - `GET /bucket/{bucketId}/data/{documentId}`
  - Query params: `localize=true|false`, `relation=true|false`

- **Create**

  - `POST /bucket/{bucketId}/data`
  - Body: JSON document

- **Replace**

  - `PUT /bucket/{bucketId}/data/{documentId}`

- **Patch**

  - `PATCH /bucket/{bucketId}/data/{documentId}`

- **Delete**

  - `DELETE /bucket/{bucketId}/data/{documentId}`

- **History (if enabled)**
  - List versions: `GET /bucket/{bucketId}/history/{documentId}`
  - Revert: `GET /bucket/{bucketId}/history/{documentId}/{historyId}`
  - Clear all histories: `DELETE /bucket/{bucketId}/history`

## Request/Response Examples

### Create (POST)

Curl:

```bash
curl -X POST "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data" \
  -H "Authorization: <YOUR TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Laptop X15",
    "price": 1299.99,
    "in_stock": true,
    "category": "66b1e8f4c5e1a947e8f7abcd",
    "tags": ["featured", "new"],
    "location": {
      "type": "Point",
      "coordinates": [-73.935242, 40.730610]
    },
    "specs": {"cpu": "M3", "ram": "16GB"}
  }'
```

JavaScript (fetch):

```js
await fetch("<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data", {
  method: "POST",
  headers: {
    Authorization: "<YOUR TOKEN>",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    name: "Laptop X15",
    price: 1299.99,
    in_stock: true,
    category: "66b1e8f4c5e1a947e8f7abcd",
    tags: ["featured", "new"],
    location: {
      type: "Point",
      coordinates: [-73.935242, 40.73061]
    },
    specs: {cpu: "M3", ram: "16GB"}
  })
}).then(r => r.json());
```

Response:

```json
{
  "_id": "66b1ea02c5e1a947e8f7abce",
  "name": "Laptop X15",
  "price": 1299.99,
  "in_stock": true,
  "category": "66b1e8f4c5e1a947e8f7abcd",
  "tags": ["featured", "new"],
  "location": {
    "type": "Point",
    "coordinates": [-73.935242, 40.73061]
  },
  "specs": {"cpu": "M3", "ram": "16GB"}
}
```

### Read — List with pagination, sort, filters

Curl (MongoDB-style filter + sort):

```bash
curl -G "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data" \
  -H "Authorization: <YOUR TOKEN>" \
  --data-urlencode "paginate=true" \
  --data-urlencode "limit=10" \
  --data-urlencode "skip=0" \
  --data-urlencode 'sort={"price":-1}' \
  --data-urlencode 'filter={"in_stock":true, "price": {"$gt": 1000}}'
```

JavaScript (fetch):

```js
const params = new URLSearchParams({
  paginate: "true",
  limit: "10",
  skip: "0",
  sort: JSON.stringify({price: -1}),
  filter: JSON.stringify({in_stock: true, price: {$gt: 1000}})
});
await fetch(`<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data?${params.toString()}`, {
  headers: {Authorization: "<YOUR TOKEN>"}
}).then(r => r.json());
```

Rules-string filter (Spica Rules):

```bash
curl -G "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data" \
  -H "Authorization: <YOUR TOKEN>" \
  --data-urlencode "limit=3" \
  --data-urlencode "filter=price>1000 && in_stock==true"
```

JavaScript (fetch):

```js
const params2 = new URLSearchParams({limit: "3", filter: "price>1000 && in_stock==true"});
await fetch(`<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data?${params2.toString()}`, {
  headers: {Authorization: "<YOUR TOKEN>"}
}).then(r => r.json());
```

Regex matching (MongoDB):

```bash
curl -G "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data" \
  -H "Authorization: <YOUR TOKEN>" \
  --data-urlencode 'filter={"name":{"$regex":"Laptop"}}'
```

JavaScript (fetch):

```js
const params3 = new URLSearchParams({filter: JSON.stringify({name: {$regex: "Laptop"}})});
await fetch(`<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data?${params3.toString()}`, {
  headers: {Authorization: "<YOUR TOKEN>"}
}).then(r => r.json());
```

### Read — Resolve relations

Curl (relation expansion):

```bash
curl -G "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data" \
  -H "Authorization: <YOUR TOKEN>" \
  --data-urlencode "relation=true" \
  --data-urlencode "limit=1"
```

JavaScript (fetch):

```js
const params4 = new URLSearchParams({relation: "true", limit: "1"});
await fetch(`<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data?${params4.toString()}`, {
  headers: {Authorization: "<YOUR TOKEN>"}
}).then(r => r.json());
```

### Get one document

Curl:

```bash
curl "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce?localize=true&relation=true" \
  -H "Authorization: <YOUR TOKEN>"
```

JavaScript (fetch):

```js
await fetch(
  "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce?localize=true&relation=true",
  {headers: {Authorization: "<YOUR TOKEN>"}}
).then(r => r.json());
```

### Update (PUT)

Curl:

```bash
curl -X PUT "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce" \
  -H "Authorization: <YOUR TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"price": 1199.99, "in_stock": false}'
```

JavaScript (fetch):

```js
await fetch("<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce", {
  method: "PUT",
  headers: {Authorization: "<YOUR TOKEN>", "Content-Type": "application/json"},
  body: JSON.stringify({price: 1199.99, in_stock: false})
}).then(r => r.json());
```

### Patch (PATCH)

Curl:

```bash
curl -X PATCH "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce" \
  -H "Authorization: <YOUR TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"in_stock": true}'
```

JavaScript (fetch):

```js
await fetch("<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce", {
  method: "PATCH",
  headers: {Authorization: "<YOUR TOKEN>", "Content-Type": "application/json"},
  body: JSON.stringify({in_stock: true})
}).then(r => r.json());
```

### Delete (DELETE)

Curl:

```bash
curl -X DELETE "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce" \
  -H "Authorization: <YOUR TOKEN>"
```

JavaScript (fetch):

```js
await fetch("<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce", {
  method: "DELETE",
  headers: {Authorization: "<YOUR TOKEN>"}
}).then(r => r.json());
```

Note for one‑to‑many relations: when `relation=false`, the field is an array of ObjectId strings; when `relation=true`, it becomes an array of expanded objects.

## Filtering — Two Styles

You can filter data using either:

1. MongoDB match (JSON):

- Example: `{ "price": {"$gte": 100}, "name": {"$regex": "Pro"} }`
- Supports operators like `$eq`, `$ne`, `$in`, `$nin`, `$gt`, `$gte`, `$lt`, `$lte`, `$regex`, nested fields, etc.

2. Spica Rules (string):

- Example: `price>=100 && in_stock==true`
- Good for simple comparisons and boolean logic.

Tip: When using curl with JSON query strings, wrap with single quotes and URL-encode as needed.

## Localization

- Mark translatable properties with `options.translate: true`.
- Provide `Accept-Language` header, e.g., `Accept-Language: en-EN`.
- System uses bucket settings:

```json
{
  "language": {
    "available": {"en": "English", "tr": "Türkçe"},
    "default": "en"
  }
}
```

## History (Versioning)

Enable `history: true` in the bucket schema to track changes.

- List history for a document: `GET /bucket/{bucketId}/history/{documentId}`
- Revert to a version: `GET /bucket/{bucketId}/history/{documentId}/{historyId}`
- Clear all histories in a bucket: `DELETE /bucket/{bucketId}/history`

History entries typically include:

```json
{"_id": "histId", "changes": 3, "date": "2025-08-12T10:33:00.000Z"}
```

## Relations — Modeling and Usage

- One‑to‑one: property stores a single ObjectId string.
- One‑to‑many: property stores an array of ObjectId strings.
- Use `relation=true` to expand ids into full objects in responses.
- Deleting a referenced document will break relations. Review UI/cleanup behavior and adjust your app logic accordingly.

Examples:

- Category (1‑1):

```json
{
  "type": "relation",
  "relationType": "onetoone",
  "bucketId": "689b4a51e893e334440745a3",
  "dependent": false
}
```

- Product images (1‑many relation to an "assets" bucket):

```json
{
  "type": "relation",
  "relationType": "onetomany",
  "bucketId": "<ASSETS_BUCKET_ID>",
  "dependent": false
}
```

### Relation expansion: relation=false vs relation=true (same bucket, same document)

Below shows the exact same document from the `products` bucket where `category` is a relation to the `categories` bucket. Only the `relation` query param changes.

Without relation expansion (relation=false or omitted)

Curl:

```bash
curl "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce" \
  -H "Authorization: <YOUR TOKEN>"
```

Response:

```json
{
  "_id": "66b1ea02c5e1a947e8f7abce",
  "name": "Laptop X15",
  "price": 1299.99,
  "in_stock": true,
  "category": "66b1e8f4c5e1a947e8f7abcd"
}
```

JavaScript (fetch):

```js
await fetch("<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce", {
  headers: {Authorization: "<YOUR TOKEN>"}
}).then(r => r.json());
```

With relation expansion (relation=true)

Curl:

```bash
curl "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce?relation=true" \
  -H "Authorization: <YOUR TOKEN>"
```

Response:

```json
{
  "_id": "66b1ea02c5e1a947e8f7abce",
  "name": "Laptop X15",
  "price": 1299.99,
  "in_stock": true,
  "category": {
    "_id": "66b1e8f4c5e1a947e8f7abcd",
    "title": "Ultrabooks",
    "description": "Description of ultrabooks bucket"
  }
}
```

JavaScript (fetch):

```js
await fetch(
  "<BASE_URL>/api/bucket/689b4a51e893e334440745a3/data/66b1ea02c5e1a947e8f7abce?relation=true",
  {
    headers: {Authorization: "<YOUR TOKEN>"}
  }
).then(r => r.json());
```

## Indexes and Uniqueness

- Define `indexes` at bucket level to speed up queries.
  Examples:

```json
{"definition": {"price": 1}, "options": {"unique": false},}
{"definition": {"name": 1}, "options": {"unique": true},}
```

## Limits and Retention

Configure `documentSettings`:

```json
{"countLimit": 10000, "limitExceedBehaviour": "prevent"}
```

- `prevent`: reject new inserts after limit.
- `remove`: automatically remove older documents to make room (retention strategy may be oldest-first).

## Error Responses (typical)

- `400 Bad Request` — invalid body, filter, or sort
- `401 Unauthorized` — missing/invalid credentials
- `403 Forbidden` — ACL denies operation
- `404 Not Found` — bucket or document not found
- `409 Conflict` — unique constraint violation

## Realtime Updates

Bucket data supports realtime updates through WebSocket connections when using the Spica SDK. Changes to documents are automatically pushed to connected clients.

### Using Realtime with SDK

```js
import * as Bucket from "@spica-devkit/bucket";

Bucket.initialize({publicUrl: "<BASE_URL>", identity: "<YOUR TOKEN>"});
//OR
Bucket.initialize({publicUrl: "<BASE_URL>", apikey: "<APIKEY>"});

// Watch all documents in a bucket
Bucket.data.realtime
  .getAll({
    queryParams: {limit: 10}
  })
  .subscribe(result => {
    console.log("Realtime data:", result);
  });

// Watch a specific document
Bucket.data.realtime
  .get("<DOCUMENT_ID>", {
    queryParams: {relation: true}
  })
  .subscribe(document => {
    console.log("Document updated:", document);
  });
```

The realtime connection will emit events for:

- Document insertions
- Document updates
- Document deletions
- Bucket schema changes

— End of Guide —
