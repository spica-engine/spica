# @spica-devkit/bucket

Bucket package for Spica. Provides a client for interacting with Spica's bucket and bucket-data APIs, including realtime features.

## Installation

```bash
npm install @spica-devkit/bucket
```

## Usage

```typescript
import * as Bucket from "@spica-devkit/bucket";

// Initialize with your API key or identity token and public URL
Bucket.initialize({apikey: "YOUR_API_KEY", publicUrl: "https://your-spica-instance.com"});

// Insert a new bucket
const bucket = {
  title: "User Bucket",
  description: "User Bucket Description",
  primary: "name",
  properties: {
    name: {type: "string", title: "name"},
    surname: {type: "string", title: "surname"}
  }
};

Bucket.insert(bucket).then(inserted => {
  console.log("Inserted bucket:", inserted);
});
```

### More Examples

#### Insert Multiple Buckets

```typescript
const buckets = [
  {
    title: "User Bucket",
    description: "User Bucket Description",
    primary: "name",
    properties: {
      name: {type: "string", title: "name"},
      surname: {type: "string", title: "surname"}
    }
  },
  {
    title: "Address Bucket",
    description: "Address Bucket Description",
    primary: "street",
    properties: {
      street: {type: "string", title: "street"},
      city: {type: "string", title: "city"}
    }
  }
];

Bucket.insertMany(buckets).then(result => {
  console.log("Insert many result:", result);
});
```

#### Update a Bucket

```typescript
Bucket.update("bucket_id", {...bucket, title: "Updated Title"}).then(updated => {
  console.log("Updated bucket:", updated);
});
```

#### Get All Buckets

```typescript
Bucket.getAll().then(buckets => {
  console.log("All buckets:", buckets);
});
```

#### Remove a Bucket

```typescript
Bucket.remove("bucket_id").then(() => {
  console.log("Bucket removed");
});
```

#### Insert Data into a Bucket

```typescript
const user = {name: "Alice", surname: "Smith"};
Bucket.data.insert("bucket_id", user).then(inserted => {
  console.log("Inserted data:", inserted);
});
```

#### Insert Multiple Data Documents

```typescript
const users = [{name: "Alice", surname: "Smith"}, {name: "Bob", surname: "Brown"}];
Bucket.data.insertMany("bucket_id", users).then(result => {
  console.log("Insert many data result:", result);
});
```

#### Update Data Document

```typescript
Bucket.data
  .update("bucket_id", "document_id", {name: "Alice", surname: "Johnson"})
  .then(updated => {
    console.log("Updated data:", updated);
  });
```

#### Patch Data Document

```typescript
Bucket.data.patch("bucket_id", "document_id", {surname: "Williams"}).then(patched => {
  console.log("Patched data:", patched);
});
```

#### Remove Data Document

```typescript
Bucket.data.remove("bucket_id", "document_id").then(() => {
  console.log("Data removed");
});
```

#### Get Data Document

```typescript
Bucket.data.get("bucket_id", "document_id").then(doc => {
  console.log("Fetched document:", doc);
});
```

#### Get All Data Documents

```typescript
Bucket.data.getAll("bucket_id").then(docs => {
  console.log("All documents:", docs);
});
```

#### Realtime: Subscribe to All Data Changes

```typescript
const realtime = Bucket.data.realtime.getAll("bucket_id");
const subscription = realtime.subscribe(docs => {
  console.log("Realtime docs:", docs);
});

// Insert a document via realtime connection
realtime.insert({name: "Alice", surname: "Smith"});

// Patch a document via realtime connection
realtime.patch({_id: "document_id", surname: "Williams"});

// Replace a document via realtime connection
realtime.replace({_id: "document_id", name: "Alice", surname: "Johnson"});

// Remove a document via realtime connection
realtime.remove({_id: "document_id"});

// To unsubscribe:
subscription.unsubscribe();
```

#### Realtime: Subscribe to a Single Document

```typescript
const realtimeDoc = Bucket.data.realtime.get("bucket_id", "document_id");
const subscription = realtimeDoc.subscribe(doc => {
  console.log("Realtime doc:", doc);
});

// Patch the document via realtime connection
realtimeDoc.patch({surname: "Williams"});

// Replace the document via realtime connection
realtimeDoc.replace({name: "Alice", surname: "Johnson"});

// Remove the document via realtime connection
realtimeDoc.remove();

// To unsubscribe:
subscription.unsubscribe();
```

## API

### Initialization

- `Bucket.initialize(options)`: Initialize the client. Options can include `apikey`, `identity`, and `publicUrl`.

### Bucket Operations

- `Bucket.insert(bucket, headers?)`: Insert a new bucket.
- `Bucket.insertMany(buckets, headers?)`: Insert multiple buckets.
- `Bucket.update(id, bucket, headers?)`: Update a bucket.
- `Bucket.remove(id, headers?)`: Remove a bucket.
- `Bucket.removeMany(ids, headers?)`: Remove multiple buckets.
- `Bucket.get(id, headers?)`: Get a bucket by ID.
- `Bucket.getAll(headers?)`: Get all buckets.

### Bucket Data Operations

- `Bucket.data.insert(bucketId, document, headers?)`: Insert a document into a bucket.
- `Bucket.data.insertMany(bucketId, documents, headers?)`: Insert multiple documents.
- `Bucket.data.update(bucketId, documentId, document, headers?)`: Update a document.
- `Bucket.data.patch(bucketId, documentId, partialDocument, headers?)`: Patch a document.
- `Bucket.data.remove(bucketId, documentId, headers?)`: Remove a document.
- `Bucket.data.removeMany(bucketId, documentIds, headers?)`: Remove multiple documents.
- `Bucket.data.get(bucketId, documentId, options?)`: Get a document by ID.
- `Bucket.data.getAll(bucketId, options?)`: Get all documents in a bucket.

### Realtime

- `Bucket.data.realtime.getAll(bucketId, queryParams?, messageCallback?)`: Subscribe to realtime changes for all documents in a bucket.
- `Bucket.data.realtime.get(bucketId, documentId, messageCallback?, queryParams?)`: Subscribe to realtime changes for a specific document.

## License

AGPLv3

## Author

spica
