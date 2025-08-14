# Spica DevKit Documentation

## Overview

The Spica DevKit is a collection of JavaScript/TypeScript packages that provide programmatic access to Spica's backend services. These packages can be used in Spica Functions, web applications, Node.js servers, and any JavaScript environment to interact with data, manage storage, handle authentication, and perform database operations.

## Available Packages

- **@spica-devkit/bucket** - Data modeling and document management (Client & Server)
- **@spica-devkit/storage** - File storage and media management (Client & Server)
- **@spica-devkit/identity** - Authentication and user management (Client & Server)
- **@spica-devkit/database** - Direct MongoDB database access (Server only - Functions only)

## Installation

You need to install these packages manually in your project:

```bash
npm install @spica-devkit/bucket
npm install @spica-devkit/storage
npm install @spica-devkit/identity
npm install @spica-devkit/database
```

## Usage Context

- **Browser/Client Applications**: Use `@spica-devkit/bucket`, `@spica-devkit/storage`, and `@spica-devkit/identity`
- **Node.js/Server Applications**: Use all packages including `@spica-devkit/database`
- **Spica Functions**: All packages are available and pre-configured with environment variables

## Authentication & Initialization

All devkit packages require initialization with either an API key or identity token:

### API Key Authentication

```javascript
import * as Bucket from "@spica-devkit/bucket";

Bucket.initialize({
  apikey: "YOUR_API_KEY",
  publicUrl: "https://your-spica-instance.com"
});
```

### Identity Token Authentication

```javascript
import * as Bucket from "@spica-devkit/bucket";

Bucket.initialize({
  identity: "YOUR_IDENTITY_TOKEN",
  publicUrl: "https://your-spica-instance.com"
});
```

## @spica-devkit/bucket

The bucket package provides comprehensive data management capabilities including CRUD operations and real-time data synchronization. Works in both browser and server environments.

### Basic Usage

#### Initialize

```javascript
import * as Bucket from "@spica-devkit/bucket";

Bucket.initialize({
  apikey: "YOUR_API_KEY",
  publicUrl: "https://your-spica-instance.com"
});
```

### Bucket Management

#### Get All Buckets

```javascript
const buckets = await Bucket.getAll();
console.log(buckets);
```

#### Get Single Bucket

```javascript
const bucket = await Bucket.get("BUCKET_ID");
console.log(bucket.title, bucket.description);
```

#### Create Bucket

```javascript
const newBucket = await Bucket.insert({
  title: "Blog Posts",
  description: "Blog post entries",
  primary: "title",
  properties: {
    title: {
      type: "string",
      title: "Title",
      options: {position: "left"}
    },
    content: {
      type: "string",
      title: "Content",
      options: {position: "bottom"}
    },
    published: {
      type: "boolean",
      title: "Published",
      options: {position: "right"}
    }
  }
});
```

#### Update Bucket

```javascript
const updatedBucket = await Bucket.update("BUCKET_ID", {
  title: "Updated Blog Posts",
  description: "Updated description"
});
```

#### Delete Bucket

```javascript
await Bucket.remove("BUCKET_ID");
```

### Document Operations

#### Get All Documents

```javascript
// Define the document structure (optional with JSDoc)
/**
 * @typedef {Object} BlogPost
 * @property {string} [_id] - Document ID
 * @property {string} title - Post title
 * @property {string} content - Post content
 * @property {boolean} published - Publication status
 */

// Get all documents
const posts = await Bucket.data.getAll("BUCKET_ID");

// Get with pagination
const paginatedPosts = await Bucket.data.getAll("BUCKET_ID", {
  queryParams: {
    paginate: true,
    limit: 10,
    skip: 0
  }
});

// Get with filters
const publishedPosts = await Bucket.data.getAll("BUCKET_ID", {
  queryParams: {
    filter: {published: true}
  }
});
```

#### Get Single Document

```javascript
const post = await Bucket.data.get("BUCKET_ID", "DOCUMENT_ID");
```

#### Create Document

```javascript
const newPost = await Bucket.data.insert("BUCKET_ID", {
  title: "My First Post",
  content: "This is the content of my first post",
  published: true
});
```

#### Update Document

```javascript
const updatedPost = await Bucket.data.update("BUCKET_ID", "DOCUMENT_ID", {
  title: "Updated Post Title",
  content: "Updated content",
  published: false
});
```

#### Patch Document (Partial Update)

```javascript
await Bucket.data.patch("BUCKET_ID", "DOCUMENT_ID", {
  published: true
});
```

#### Delete Document

```javascript
await Bucket.data.remove("BUCKET_ID", "DOCUMENT_ID");
```

### Batch Operations

#### Insert Many Documents

```javascript
const posts = [
  {title: "Post 1", content: "Content 1", published: true},
  {title: "Post 2", content: "Content 2", published: false}
];

const results = await Bucket.data.insertMany("BUCKET_ID", posts);
```

#### Delete Many Documents

```javascript
await Bucket.data.removeMany("BUCKET_ID", ["DOC_ID_1", "DOC_ID_2"]);
```

### Real-time Data

#### Listen to All Documents

```javascript
const connection = Bucket.data.realtime.getAll("BUCKET_ID");

connection.subscribe(posts => {
  console.log("Posts updated:", posts);
});

// Insert new document through real-time connection
connection.insert({
  title: "Real-time Post",
  content: "Added via real-time connection",
  published: true
});

// Update document
connection.replace({
  _id: "DOCUMENT_ID",
  title: "Updated via real-time",
  content: "Updated content",
  published: true
});

// Remove document
connection.remove({_id: "DOCUMENT_ID"});
```

#### Listen to Single Document

```javascript
const connection = Bucket.data.realtime.get("BUCKET_ID", "DOCUMENT_ID");

connection.subscribe(post => {
  console.log("Post updated:", post);
});

// Update the document
connection.replace({
  title: "Updated Title",
  content: "Updated Content",
  published: true
});

// Partially update
connection.patch({
  published: false
});

// Remove the document
connection.remove();
```

---

## @spica-devkit/storage

The storage package handles file upload, download, and management operations. Works in both browser and server environments.

### Initialize

```javascript
import * as Storage from "@spica-devkit/storage";

Storage.initialize({
  apikey: "YOUR_API_KEY",
  publicUrl: "https://your-spica-instance.com"
});
```

### File Upload

#### Single File Upload

```javascript
// Browser environment with File object
const file = document.getElementById("fileInput").files[0];
const uploadedFile = await Storage.insert(file, progress => {
  console.log(`Upload progress: ${(progress.loaded / progress.total) * 100}%`);
});

console.log("File uploaded:", uploadedFile.url);
```

#### Upload with Buffer (Node.js)

```javascript
import fs from "fs";

const fileBuffer = fs.readFileSync("path/to/file.jpg");
const fileWithMeta = {
  data: fileBuffer,
  name: "my-image.jpg",
  contentType: "image/jpeg"
};

const uploadedFile = await Storage.insert(fileWithMeta);
console.log("File URL:", uploadedFile.url);
```

#### Multiple File Upload

```javascript
const files = document.getElementById("fileInput").files;
const uploadedFiles = await Storage.insertMany(files, progress => {
  console.log(`Batch upload progress: ${(progress.loaded / progress.total) * 100}%`);
});

uploadedFiles.forEach(file => {
  console.log("Uploaded file:", file.name, file.url);
});
```

### File Management

#### Get File Info

```javascript
const fileInfo = await Storage.get("FILE_ID");
console.log("File name:", fileInfo.name);
console.log("File size:", fileInfo.content.size);
console.log("Content type:", fileInfo.content.type);
```

#### Get All Files

```javascript
// Get all files
const allFiles = await Storage.getAll();

// Get with pagination and filters
const filteredFiles = await Storage.getAll({
  paginate: true,
  limit: 20,
  skip: 0,
  filter: {"content.type": "image/jpeg"},
  sort: {_id: -1}
});
```

#### Download File

```javascript
// Download file content
const fileContent = await Storage.download("FILE_ID", {
  onDownloadProgress: progress => {
    console.log(`Download progress: ${(progress.loaded / progress.total) * 100}%`);
  }
});

// In browser, fileContent is a Blob
// In Node.js, fileContent is a ReadableStream
```

#### Update File

```javascript
const newFile = document.getElementById("newFileInput").files[0];
const updatedFile = await Storage.update("FILE_ID", newFile);
```

#### Update File Metadata

```javascript
const updatedFile = await Storage.updateMeta("FILE_ID", {
  name: "new-filename.jpg"
});
```

#### Delete File

```javascript
await Storage.remove("FILE_ID");
```

#### Delete Multiple Files

```javascript
await Storage.removeMany(["FILE_ID_1", "FILE_ID_2", "FILE_ID_3"]);
```

---

## @spica-devkit/identity

The identity package provides authentication and user management capabilities. Works in both browser and server environments.

### Initialize

```javascript
import * as Identity from "@spica-devkit/identity";

Identity.initialize({
  apikey: "YOUR_API_KEY",
  publicUrl: "https://your-spica-instance.com"
});
```

### Authentication

#### Login with Username/Password

```javascript
// Simple login
const token = await Identity.login("user@example.com", "password");
console.log("Auth token:", token);

// Login with token lifespan (in seconds)
const tokenWithLifespan = await Identity.login("user@example.com", "password", 3600);
```

#### Login with Two-Factor Authentication

```javascript
const result = await Identity.login("user@example.com", "password");

if (Identity.isChallenge(result)) {
  // Handle 2FA challenge
  console.log("2FA Challenge:", result.show());

  // User provides the 2FA code
  const twoFactorCode = "123456"; // Get from user input
  const token = await result.answer(twoFactorCode);
  console.log("Auth token after 2FA:", token);
} else {
  console.log("Direct login token:", result);
}
```

#### Login with OAuth Strategy

```javascript
const strategyResult = await Identity.loginWithStrategy("STRATEGY_ID");

// Open the OAuth URL in browser
window.open(strategyResult.url, "_blank");

// Listen for the token
strategyResult.token.subscribe(tokenOrChallenge => {
  if (Identity.isChallenge(tokenOrChallenge)) {
    // Handle additional challenges if needed
    console.log("Challenge:", tokenOrChallenge.show());
  } else {
    console.log("OAuth token:", tokenOrChallenge);
  }
});
```

#### Verify Token

```javascript
const isValid = await Identity.verifyToken("AUTH_TOKEN");
console.log("Token is valid:", isValid);
```

### User Management

#### Get All Users

```javascript
// Get all identities
const users = await Identity.getAll();

// Get with pagination and filters
const paginatedUsers = await Identity.getAll({
  paginate: true,
  limit: 10,
  skip: 0,
  filter: {"attributes.role": "admin"}
});
```

#### Get Single User

```javascript
const user = await Identity.get("USER_ID");
console.log("User:", user.identifier, user.attributes);
```

#### Create User

```javascript
const newUser = await Identity.insert({
  identifier: "newuser@example.com",
  password: "securepassword",
  attributes: {
    firstName: "John",
    lastName: "Doe",
    role: "user"
  }
});
```

#### Update User

```javascript
const updatedUser = await Identity.update("USER_ID", {
  identifier: "updated@example.com",
  attributes: {
    firstName: "Jane",
    lastName: "Smith",
    role: "admin"
  }
});
```

#### Delete User

```javascript
await Identity.remove("USER_ID");
```

#### Batch Delete Users

```javascript
await Identity.removeMany(["USER_ID_1", "USER_ID_2"]);
```

### Policy Management

#### Attach Policies to User

```javascript
const attachedPolicies = await Identity.policy.attach("USER_ID", ["POLICY_ID_1", "POLICY_ID_2"]);
```

#### Detach Policies from User

```javascript
const detachedPolicies = await Identity.policy.detach("USER_ID", ["POLICY_ID_1"]);
```

### Authentication Strategies

#### Get Available Strategies

```javascript
const strategies = await Identity.getStrategies();
strategies.forEach(strategy => {
  console.log("Strategy:", strategy.name, strategy.title);
});
```

### Two-Factor Authentication

#### List Available 2FA Methods

```javascript
const factorSchemas = await Identity.authfactor.list();
factorSchemas.forEach(schema => {
  console.log("2FA Method:", schema.title, schema.description);
});
```

#### Register 2FA for User

```javascript
const challenge = await Identity.authfactor.register("USER_ID", {
  type: "sms",
  config: {
    phoneNumber: "+1234567890"
  }
});

console.log("2FA Setup Challenge:", challenge.show());
const verificationCode = "123456"; // Get from user
await challenge.answer(verificationCode);
```

#### Unregister 2FA for User

```javascript
await Identity.authfactor.unregister("USER_ID");
```

---

## @spica-devkit/database

The database package provides direct MongoDB access for advanced operations. **Server-side only** - works exclusively in Spica Functions and Node.js environments.

⚠️ **Warning**: Direct database access bypasses Spica's validation and security layers. Use with caution.

### Initialize & Connect

```javascript
import * as Database from "@spica-devkit/database";

// Connect to database (uses environment variables automatically in Functions)
const db = await Database.database();
```

### Basic Operations

#### Insert Documents

```javascript
// Insert one
const insertResult = await db.collection("my_collection").insertOne({
  name: "John Doe",
  email: "john@example.com",
  createdAt: new Date()
});

// Insert many
const insertManyResult = await db.collection("my_collection").insertMany([
  {name: "Alice", email: "alice@example.com"},
  {name: "Bob", email: "bob@example.com"}
]);
```

#### Find Documents

```javascript
// Find all
const allDocs = await db.collection("users").find({}).toArray();

// Find one
const user = await db.collection("users").findOne({email: "john@example.com"});

// Find by ID (helper method)
const userById = await db.collection("users").findById("OBJECT_ID");

// Find with filter
const activeUsers = await db
  .collection("users")
  .find({
    status: "active",
    createdAt: {$gte: new Date("2024-01-01")}
  })
  .toArray();
```

#### Update Documents

```javascript
// Update one
await db
  .collection("users")
  .updateOne({email: "john@example.com"}, {$set: {lastLogin: new Date()}});

// Update many
await db.collection("users").updateMany({status: "inactive"}, {$set: {status: "archived"}});

// Find and update
const updatedDoc = await db
  .collection("users")
  .findOneAndUpdate(
    {_id: new Database.ObjectId("OBJECT_ID")},
    {$set: {name: "Updated Name"}},
    {returnDocument: "after"}
  );
```

#### Delete Documents

```javascript
// Delete one
await db.collection("users").deleteOne({email: "john@example.com"});

// Delete many
await db.collection("users").deleteMany({status: "archived"});

// Find and delete
const deletedDoc = await db.collection("users").findOneAndDelete({
  _id: new Database.ObjectId("OBJECT_ID")
});
```

### Advanced Queries

#### Aggregation Pipeline

```javascript
const pipeline = [
  {$match: {status: "active"}},
  {
    $group: {
      _id: "$department",
      count: {$sum: 1},
      averageAge: {$avg: "$age"}
    }
  },
  {$sort: {count: -1}}
];

const aggregationResult = await db.collection("employees").aggregate(pipeline).toArray();
```

#### Indexes

```javascript
// Create index
await db.collection("users").createIndex({email: 1}, {unique: true});

// Create compound index
await db.collection("users").createIndex({
  department: 1,
  createdAt: -1
});

// List indexes
const indexes = await db.collection("users").indexes();
```

### ObjectId Utilities

```javascript
import {ObjectId} from "@spica-devkit/database";

// Create ObjectId
const objectId = new ObjectId();

// Create from string
const objectIdFromString = new ObjectId("507f1f77bcf86cd799439011");

// Check if valid ObjectId
const isValid = ObjectId.isValid("507f1f77bcf86cd799439011");
```

### Connection Management

```javascript
// Check if connected
const connected = Database.isConnected();

// Close connection (automatically handled in Functions)
await Database.close();
```

---

## Error Handling

All devkit packages use Promises and can be used with async/await or .then()/.catch():

```javascript
try {
  const posts = await Bucket.data.getAll("BUCKET_ID");
  // Handle success
} catch (error) {
  console.error("Error fetching posts:", error);
  // Handle error
}
```

## Best Practices

### 1. Always Initialize

```javascript
// Initialize once at the beginning of your function/application
Bucket.initialize({apikey: process.env.SPICA_API_KEY});
```

### 2. Use JSDoc for Type Documentation

```javascript
/**
 * @typedef {Object} MyDocument
 * @property {string} [_id] - Document ID
 * @property {string} title - Document title
 * @property {string} content - Document content
 */

/** @type {MyDocument} */
const doc = await Bucket.data.get("bucket_id", "doc_id");
```

### 3. Handle Real-time Connections

```javascript
const connection = Bucket.data.realtime.getAll("BUCKET_ID");

connection.subscribe({
  next: data => console.log("Data updated:", data),
  error: error => console.error("Connection error:", error),
  complete: () => console.log("Connection closed")
});

// Don't forget to unsubscribe when done
// connection.unsubscribe();
```

### 4. Batch Operations for Performance

```javascript
// Instead of multiple single operations
// for (const item of items) {
//   await Bucket.data.remove("BUCKET_ID", item._id);
// }

// Use batch operations
const ids = items.map(item => item._id);
await Bucket.data.removeMany("BUCKET_ID", ids);
```

### 5. Use Database Package Sparingly

```javascript
// Prefer devkit packages over direct database access
// ✅ Good
const posts = await Bucket.data.getAll("posts");

// ⚠️ Use only when necessary (Functions only)
const db = await Database.database();
const posts = await db.collection("bucket_posts").find({}).toArray();
```

## Environment Variables

When running in Spica Functions, these environment variables are automatically available:

- `__INTERNAL__SPICA__PUBLIC_URL__` - The public URL of your Spica instance
- `__INTERNAL__SPICA__MONGOURL__` - MongoDB connection string (Functions only)
- `__INTERNAL__SPICA__MONGODBNAME__` - Database name (Functions only)
- `__INTERNAL__SPICA__MONGOREPL__` - MongoDB replica set name (Functions only)

For client applications, you need to provide the `publicUrl` parameter during initialization.

## Common Use Cases

### 1. Content Management Function

```javascript
import * as Bucket from "@spica-devkit/bucket";

export async function publishPost(request, response) {
  Bucket.initialize({apikey: process.env.SPICA_API_KEY});

  const postId = request.body.postId;

  await Bucket.data.patch("posts", postId, {
    published: true,
    publishedAt: new Date()
  });

  response.status(200).send({message: "Post published successfully"});
}
```

### 2. File Processing Function

```javascript
import * as Storage from "@spica-devkit/storage";

export async function processUpload(request, response) {
  Storage.initialize({apikey: process.env.SPICA_API_KEY});

  const fileId = request.body.fileId;
  const fileInfo = await Storage.get(fileId);

  // Process the file
  console.log(`Processing file: ${fileInfo.name}`);

  response.status(200).send({processed: true});
}
```

### 3. User Registration Function

```javascript
import * as Identity from "@spica-devkit/identity";

export async function registerUser(request, response) {
  Identity.initialize({apikey: process.env.SPICA_API_KEY});

  const {email, password, firstName, lastName} = request.body;

  const newUser = await Identity.insert({
    identifier: email,
    password: password,
    attributes: {firstName, lastName}
  });

  response.status(201).send({
    message: "User created successfully",
    userId: newUser._id
  });
}
```

### 4. Client-Side Web Application

```javascript
// In a web application
import * as Bucket from "@spica-devkit/bucket";
import * as Identity from "@spica-devkit/identity";

// Initialize with your Spica instance URL
Bucket.initialize({
  apikey: "YOUR_PUBLIC_API_KEY",
  publicUrl: "https://your-spica-instance.com"
});

Identity.initialize({
  apikey: "YOUR_PUBLIC_API_KEY",
  publicUrl: "https://your-spica-instance.com"
});

// Login user
async function loginUser(email, password) {
  try {
    const token = await Identity.login(email, password);
    localStorage.setItem("authToken", token);

    // Reinitialize with identity token for authenticated requests
    Bucket.initialize({
      identity: token,
      publicUrl: "https://your-spica-instance.com"
    });

    return token;
  } catch (error) {
    console.error("Login failed:", error);
  }
}

// Fetch user's posts
async function getUserPosts() {
  try {
    const posts = await Bucket.data.getAll("posts", {
      queryParams: {
        filter: {userId: currentUser.id}
      }
    });
    return posts;
  } catch (error) {
    console.error("Failed to fetch posts:", error);
  }
}
```
