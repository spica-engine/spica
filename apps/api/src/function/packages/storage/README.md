# @spica-devkit/storage

Storage package for Spica. Provides utilities to upload, download, update, and manage files in Spica-based applications.

## Installation

```bash
npm install @spica-devkit/storage
```

## Usage

```typescript
import * as Storage from "@spica-devkit/storage";

// Initialize with your API key or identity token
Storage.initialize({apikey: "YOUR_API_KEY"});
// or
Storage.initialize({identity: "YOUR_IDENTITY_TOKEN", publicUrl: "https://your-spica-instance"});

// Insert a file (Node.js example)
const file = {
  name: "example.txt",
  contentType: "text/plain",
  data: Buffer.from("Hello, Spica!")
};
const inserted = await Storage.insert(file);

// Insert a file with upload progress
await Storage.insert(file, progressEvent => {
  const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
  console.log(`Upload progress: ${percent}%`);
});

// Insert multiple files
const files = [
  {
    name: "file1.txt",
    contentType: "text/plain",
    data: Buffer.from("File 1 content")
  },
  {
    name: "file2.json",
    contentType: "application/json",
    data: Buffer.from('{"key":"value"}')
  }
];
const insertedMany = await Storage.insertMany(files);

// Insert multiple files with upload progress
await Storage.insertMany(files, progressEvent => {
  const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
  console.log(`Upload progress: ${percent}%`);
});

// Update a file
const updated = await Storage.update(inserted._id, {
  name: "example.txt",
  contentType: "text/plain",
  data: Buffer.from("Updated content")
});

// Update file metadata (rename)
const updatedMeta = await Storage.updateMeta(inserted._id, {name: "renamed.txt"});

// Get all storage objects
const allFiles = await Storage.getAll();

// Get all with pagination
const paginated = await Storage.getAll({paginate: true, limit: 10, skip: 0});

// Get a specific storage object
const fileObj = await Storage.get(inserted._id);

// Download a file (Node.js: returns ReadableStream)
const stream = await Storage.download(inserted._id);
stream.pipe(fs.createWriteStream("downloaded.txt"));

// Download a file (Browser: returns Blob)
const blob = await Storage.download(inserted._id);
// Use blob in browser, e.g., createObjectURL(blob)

// Delete a storage object
await Storage.remove(inserted._id);

// Delete multiple storage objects
await Storage.removeMany([inserted._id, insertedMany[0]._id]);
```

## API

### `initialize(options)`

Initialize the storage client.

- `options`: `{ apikey: string }` or `{ identity: string, publicUrl?: string }`

### `insert(object, onUploadProgress?, headers?)`

Insert a single file.

- `object`: `File` (browser) or `{ name, contentType, data }` (Node.js)
- `onUploadProgress`: optional callback
- `headers`: optional headers

### `insertMany(objects, onUploadProgress?, headers?)`

Insert multiple files.

### `get(id, headers?)`

Get a storage object by ID.

### `getAll(queryParams?, headers?)`

Get all storage objects.

### `update(id, object, onUploadProgress?, headers?)`

Update a storage object.

### `updateMeta(id, meta, headers?)`

Update metadata (e.g., name) of a storage object.

### `remove(id, headers?)`

Delete a storage object.

### `removeMany(ids, headers?)`

Delete multiple storage objects.

### `download(id, options?)`

Download a storage object. Returns a `Blob` (browser) or `ReadableStream` (Node.js).

---

## License

AGPLv3
