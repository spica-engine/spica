# @spica-devkit/database

Database package for Spica functions, providing a MongoDB client with additional safety checks and utilities for use in Spica serverless environments.

## Features

- MongoDB connection management tailored for Spica Functions.
- Automatic warnings for unsafe usage of `ObjectId` in documents.
- Utility for creating `ObjectId` instances.
- Safe collection methods with built-in document validation.
- Convenience method: `findById`.

## Installation

```bash
npm install @spica-devkit/database
```

## Usage

```typescript
import {database, close, isConnected, ObjectId, objectId} from "@spica-devkit/database";

async function main() {
  const db = await database();
  const collection = db.collection("myCollection");

  // Insert a document
  await collection.insertOne({name: "Alice", userId: new ObjectId()});

  // Find by id
  const doc = await collection["findById"]("60c72b2f9b1d8e6f88e7b0c1");

  // Close connection
  await close();
}

// Example: Insert many documents
async function insertManyExample() {
  const db = await database();
  const collection = db.collection("users");
  await collection.insertMany([{name: "Bob", age: 25}, {name: "Carol", age: 30}]);
}

// Example: Update a document
async function updateExample() {
  const db = await database();
  const collection = db.collection("users");
  await collection.updateOne({name: "Bob"}, {$set: {age: 26}});
}

// Example: Delete a document
async function deleteExample() {
  const db = await database();
  const collection = db.collection("users");
  await collection.deleteOne({name: "Carol"});
}

// Example: Using objectId utility (deprecated)
const id = objectId("60c72b2f9b1d8e6f88e7b0c1");

// Example: Check connection status
if (isConnected()) {
  console.log("Database is connected");
}
```

## API

### `database(): Promise<Db>`

Connects to the MongoDB database using environment variables:

- `__INTERNAL__SPICA__MONGOURL__`
- `__INTERNAL__SPICA__MONGODBNAME__`

Returns a connected `Db` instance.

### `close(force?: boolean): Promise<void> | void`

Closes the MongoDB connection.

### `isConnected(): boolean`

Returns `true` if the database connection is active.

### `ObjectId`

Re-export of MongoDB's `ObjectId` class.

### Collection Extensions

- `findById(id)`: Finds a document by its `_id`.

## Environment Variables

- `__INTERNAL__SPICA__MONGOURL__`: MongoDB connection URI.
- `__INTERNAL__SPICA__MONGODBNAME__`: Database name.
- `NO_DEVKIT_DATABASE_WARNING`: Suppress warnings about direct database usage.

## Warnings

This package emits warnings if you use `ObjectId` in document properties other than `_id`, as this may cause inconsistencies. It is recommended to use string representations for references.

## License

AGPLv3

---
