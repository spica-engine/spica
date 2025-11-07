# Spica Functions API Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [Function Structure](#function-structure)
3. [Trigger Types](#trigger-types)
4. [Function API Endpoints](#function-api-endpoints)
5. [CRUD Operations](#crud-operations)
6. [Examples](#examples)

## Introduction

Spica Functions are serverless functions that run in response to events. They can be triggered by HTTP requests, database changes, scheduled events, system events, or real-time connections. Functions are written in JavaScript or TypeScript and can be managed through the Function API.

## Function Structure

A Spica function consists of the following components:

```json
{
  "_id": "ObjectId",
  "name": "string",
  "description": "string (optional)",
  "triggers": {
    "handler_name": {
      "type": "trigger_type",
      "active": true,
      "options": {}
    }
  },
  "timeout": 60,
  "language": "typescript|javascript",
  "memoryLimit": 100,
  "order": 0,
  "category": "string (optional)"
}
```

### Properties

- **\_id**: Unique identifier of the function
- **name**: Display name of the function
- **description**: Optional description of the function's purpose
- **triggers**: Object containing trigger configurations keyed by handler name
- **timeout**: Maximum execution time in seconds
- **language**: Programming language (typescript or javascript)
- **memoryLimit**: Maximum memory usage in MB (default: 100)
- **order**: Display order in the UI
- **category**: Optional category for organizing functions

## Trigger Types

Functions can be triggered by various events. Each trigger type has specific options:

### 1. HTTP Trigger

Executes function in response to HTTP requests.

**Options:**

```json
{
  "method": "Get|Post|Put|Delete|Patch|Head|All",
  "path": "/api/endpoint",
  "preflight": true
}
```

**Path Parameters:**
HTTP triggers support URL parameters using the `:parameter` syntax:

- `/books/:id` - Single parameter
- `/users/:userId/posts/:postId` - Multiple parameters
- `/api/v1/books/:id` - Parameters with prefixes

**Example Function:**

```javascript
export default function (req, res) {
  // Access URL parameters
  const bookId = req.params.id;
  const userId = req.params.userId;

  // Access query parameters
  const limit = req.query.limit;

  return res.status(200).send({
    message: "Hello from Spica!",
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query
  });
}
```

### 2. Database Trigger

Executes function when database collections are modified.

**Options:**

```json
{
  "collection": "users",
  "type": "INSERT|UPDATE|REPLACE|DELETE"
}
```

**Example Function:**

```javascript
export default function (change) {
  console.log(`${change.kind} action performed on document ${change.documentKey}`);
  console.log("Collection:", change.collection);
  console.log("Document:", change.document);
}
```

### 3. Bucket Trigger

Executes function when bucket documents are modified.

**Options:**

```json
{
  "bucket": "bucket_id",
  "type": "INSERT|UPDATE|DELETE|ALL"
}
```

**Example Function:**

```javascript
export default function (change) {
  console.log(`${change.kind} action on document ${change.documentKey} in bucket ${change.bucket}`);
  console.log("Previous:", change.previous);
  console.log("Current:", change.current);
}
```

#### Difference Between Bucket Events and Database Events

**Database Events** trigger when a change happens on the Database layer, but **Bucket Events** listen to the API operations and trigger when the API processes the request.

**Key Differences:**

- **Database Events**: Triggered only when data is changed directly in the database (e.g., using `@spica-devkit/database`)
- **Bucket Events**: Triggered when data is changed through Spica Client or Bucket APIs

**When Both Trigger:**
When changes are made via Spica Client or Bucket APIs, both Bucket Events and Database Events will trigger.

**Use Case Example:**

Let's assume we want to send a notification to a 3rd party API when a Spica User changes data on Spica, but we also have a function that changes bucket data internally using `@spica-devkit/database`. In this case, it's correct to use **Bucket Events** for the 3rd party API communication instead of Database Events.

**Example Scenario:**

```javascript
// Function 1: Internal data processing (triggers only Database Events)
import * as Database from "@spica-devkit/database";

export default async function() {
  // This change will only trigger Database Events
  await Database.collection("orders").insertOne({
    status: "processed",
    timestamp: new Date()
  });
}

// Function 2: User notification (use Bucket Events)
export default function(change) {
  // This will trigger when users make changes via UI/API
  // but NOT when Function 1 makes database changes
  console.log("User action detected, sending notification...");
  sendNotificationToThirdParty(change.current);
}
```

In this scenario, use Bucket Events for user-facing notifications to avoid sending notifications for internal system operations.

### 4. Schedule Trigger

Executes function on a scheduled basis using cron expressions.

**Options:**

```json
{
  "frequency": "0 * * * *",
  "timezone": "UTC"
}
```

**Example Function:**

```javascript
export default function () {
  console.log("Scheduled function executed at:", new Date().toISOString());

  // Access environment variables
  const apiKey = process.env.API_KEY;
  const environment = process.env.NODE_ENV || "development";

  console.log(`Running in ${environment} environment`);
}
```

### 5. System Trigger

Executes function when the system starts up.

**Options:**

```json
{}
```

**Example Function:**

```javascript
export default function () {
  console.log("System is ready!");
}
```

### 6. Firehose Trigger

Executes function for real-time WebSocket connections.

**Options:**

```json
{
  "event": "connection|message|disconnect"
}
```

**Example Function:**

```javascript
export default function ({socket, pool}, message) {
  console.log("Event:", message.name);
  console.log("Data:", message.data);

  if (isAuthorized(message)) {
    socket.send("authorization", {state: true});
    pool.send("connection", {id: socket.id, ip: socket.remoteAddress});
  } else {
    socket.send("authorization", {state: false, error: "Unauthorized"});
    socket.close();
  }
}
```

## Function API Endpoints

The Function API provides endpoints for managing functions and their components.

### Base URL

```
/api/function
```

### Authentication

All endpoints require authentication and appropriate permissions:

- `function:index` - List functions
- `function:show` - View function details
- `function:create` - Create functions
- `function:update` - Update functions
- `function:delete` - Delete functions

## Logging

Spica Functions provide comprehensive logging capabilities through the standard JavaScript console object. When your function code calls console methods, the output is automatically written to the function's log.

### Supported Console Methods

Spica Functions support the following console methods with their corresponding log levels:

- **console.debug()** - Debug level (0) - Detailed debugging information
- **console.log()** - Log level (1) - General purpose logging
- **console.info()** - Info level (2) - Informational messages
- **console.warn()** - Warning level (3) - Warning messages for potential issues
- **console.error()** - Error level (4) - Error conditions and exceptions

**Additional Methods:**

- **console.table()** - Display data in table format
- **console.count()** - Count occurrences of specific labels
- **console.time()** / **console.timeEnd()** - Measure execution time
- **console.group()** / **console.groupEnd()** - Group related logs

### Basic Logging Examples

```javascript
export default function (req, res) {
  console.debug("Request details:", {method: req.method, path: req.path});
  console.log("Processing user request");
  console.info("Function execution started");
  console.warn("Rate limit approaching");
  console.error("Database connection failed:", error.message);

  return res.status(200).send({message: "Request processed"});
}
```

### Structured Logging

```javascript
export default function (req, res) {
  const correlationId = Math.random().toString(36).substr(2, 9);

  console.log(`[${correlationId}] Request received:`, {
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  });

  try {
    const result = processRequest(req.body);
    console.log(`[${correlationId}] Request processed successfully`);
    return res.status(200).send(result);
  } catch (error) {
    console.error(`[${correlationId}] Processing failed:`, {
      error: error.message,
      requestData: req.body
    });
    return res.status(500).send({error: "Internal server error"});
  }
}
```

### Performance Logging

```javascript
export default async function (req, res) {
  console.time("database-query");
  const users = await Database.collection("users").find({}).toArray();
  console.timeEnd("database-query"); // Shows: "database-query: 45.123ms"

  console.count("API calls"); // Shows: "API calls: 1"
  console.table(users); // Displays users in table format

  return res.status(200).send(users);
}
```

### Monitoring Logs via API

You can retrieve function logs programmatically using the Function Logs API:

**Endpoint:** `GET /api/function-logs`

**Query Parameters:**

- `functions` - Filter by function IDs (array)
- `levels` - Filter by log levels: 0=debug, 1=log, 2=info, 3=warn, 4=error (array)
- `begin` - Start date (ISO string)
- `end` - End date (ISO string)
- `content` - Search within log content (string)
- `limit` - Maximum number of logs to return
- `skip` - Number of logs to skip

**Example Request:**

```javascript
// Get error logs for the last hour
const response = await fetch(
  "/api/function-logs?" +
    new URLSearchParams({
      functions: ["64f1c2a8b1234567890abcde"],
      levels: ["4"], // Error level only
      begin: new Date(Date.now() - 3600000).toISOString(),
      limit: "50"
    })
);

const logs = await response.json();
console.log("Recent errors:", logs);
```

**Response Format:**

```json
[
  {
    "_id": "64f1c2a8b1234567890abcde",
    "function": "User API",
    "content": "Database connection failed: timeout",
    "level": 4,
    "channel": "stderr",
    "created_at": "2025-08-14T10:30:15.123Z"
  }
]
```

## Environment Variables

Environment variables in Spica are managed separately from functions and are accessible within function code via `process.env`. They provide a secure way to store configuration values, API keys, database connection strings, and other sensitive information.

### Environment Variable Structure

```json
{
  "_id": "ObjectId",
  "key": "string",
  "value": "string"
}
```

### Environment Variable API

**Base URL:** `/api/env-var`

**Required Permissions:**

- `env-var:index` - List environment variables
- `env-var:show` - View environment variable details
- `env-var:create` - Create environment variables
- `env-var:update` - Update environment variables
- `env-var:delete` - Delete environment variables

#### Create Environment Variable

```
POST /api/env-var
```

**Request Body:**

```json
{
  "key": "API_KEY",
  "value": "apikey123"
}
```

#### List Environment Variables

```
GET /api/env-var
```

#### Get Environment Variable

```
GET /api/env-var/:id
```

#### Update Environment Variable

```
PUT /api/env-var/:id
```

#### Delete Environment Variable

```
DELETE /api/env-var/:id
```

### Using Environment Variables in Functions

Environment variables are automatically injected into the function runtime and accessible via `process.env`:

```javascript
export default function () {
  // Access environment variables
  const databaseUrl = process.env.DATABASE_URL;
  const apiKey = process.env.API_KEY;
  const debugMode = process.env.DEBUG === "true";

  console.log("Database URL:", databaseUrl);
  console.log("Debug mode:", debugMode);
}
```

### Environment Variable Examples

**API Configuration:**

```json
{
  "key": "EXTERNAL_API_URL",
  "value": "https://api.example.com/v1"
}
```

**Database Connection:**

```json
{
  "key": "MONGODB_URI",
  "value": "mongodb://username:password@localhost:27017/production"
}
```

**Feature Flags:**

```json
{
  "key": "ENABLE_NOTIFICATIONS",
  "value": "true"
}
```

**Function Code Using Environment Variables:**

````javascript
export default function(req, res) {
  const externalApiUrl = process.env.EXTERNAL_API_URL;
  const enableNotifications = process.env.ENABLE_NOTIFICATIONS === 'true';

  if (enableNotifications) {
    console.log('Processing request');
  }

  // Use external API
  const apiResponse = await fetch(`${externalApiUrl}/data`);
  return res.status(200).send(await apiResponse.json());
}

## CRUD Operations

### Create Function

**Endpoint:** `POST /api/function`

**Request Body:**

```json
{
  "name": "My Function",
  "description": "Function description",
  "triggers": {
    "handler1": {
      "type": "http",
      "active": true,
      "options": {
        "method": "Post",
        "path": "/api/my-endpoint",
        "preflight": true
      }
    }
  },
  "timeout": 60,
  "language": "typescript"
}
````

**Response:**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "My Function",
  "description": "Function description",
  "triggers": {
    "handler1": {
      "type": "http",
      "active": true,
      "options": {
        "method": "Post",
        "path": "/api/my-endpoint",
        "preflight": true
      }
    }
  },
  "timeout": 60,
  "language": "typescript"
}
```

### Read Functions

**List All Functions:**

```
GET /api/function
```

**Get Single Function:**

```
GET /api/function/:id
```

**Response:**

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "My Function",
  "triggers": { ... },
  "timeout": 60,
  "language": "typescript"
}
```

### Update Function

**Replace Function:**

```
PUT /api/function/:id
```

**Partial Update (JSON Merge Patch):**

```
PATCH /api/function/:id
Content-Type: application/merge-patch+json

{
  "name": "Updated Function Name",
  "timeout": 120
}
```

### Delete Function

**Endpoint:** `DELETE /api/function/:id`

**Response:** `204 No Content`

### Function Index (Code) Operations

**Get Function Code:**

```
GET /api/function/:id/index
```

**Update Function Code:**

```
POST /api/function/:id/index
Content-Type: application/json

{
  "index": "export default function(req, res) { return res.send('Hello!'); }"
}
```

### Dependency Management

Dependencies in Spica Functions work like a `package.json` file for each function. You can install npm packages that your function code needs, such as external libraries, utility packages, or specific modules. Each function maintains its own dependency list and these packages are automatically installed when the function is deployed.

**Get Dependencies:**

```
GET /api/function/:id/dependencies
```

**Response:**

```json
{
  "dependencies": {
    "axios": "^1.4.0",
    "lodash": "^4.17.21",
    "moment": "^2.29.4"
  }
}
```

**Add Dependencies:**

```
POST /api/function/:id/dependencies
{
  "name": ["express", "lodash", "axios"]
}
```

You can install multiple packages at once by providing an array of package names. The system will automatically fetch the latest versions from npm.

**Add Specific Versions:**

```
POST /api/function/:id/dependencies
{
  "name": ["express@4.18.2", "lodash@4.17.21"]
}
```

**Remove Dependency:**

```
DELETE /api/function/:id/dependencies/:packageName
```

**Example Usage in Function Code:**

Once dependencies are installed, you can import and use them in your function:

```javascript
import express from "express";
import _ from "lodash";
import axios from "axios";

export default async function (req, res) {
  // Use lodash utility functions
  const users = _.uniqBy(await getUsers(), "email");

  // Make HTTP requests with axios
  const apiResponse = await axios.get("https://api.example.com/data");

  // Use any installed package functionality
  return res.status(200).send({
    users: users,
    externalData: apiResponse.data
  });
}
```

## Examples

### Complete HTTP API Function

**Step 1: Create Function**

```json
{
  "name": "User API",
  "description": "RESTful API for user management",
  "triggers": {
    "getUsers": {
      "type": "http",
      "active": true,
      "options": {
        "method": "Get",
        "path": "/api/users",
        "preflight": true
      }
    },
    "getUser": {
      "type": "http",
      "active": true,
      "options": {
        "method": "Get",
        "path": "/api/users/:id",
        "preflight": true
      }
    },
    "createUser": {
      "type": "http",
      "active": true,
      "options": {
        "method": "Post",
        "path": "/api/users",
        "preflight": true
      }
    },
    "updateUser": {
      "type": "http",
      "active": true,
      "options": {
        "method": "Put",
        "path": "/api/users/:id",
        "preflight": true
      }
    }
  },
  "timeout": 60,
  "language": "javascript"
}
```

**Step 2: Install Required Dependencies**

```
POST /api/function/:id/dependencies
{
  "name": ["@spica-devkit/bucket"]
}
```

**Step 3: Function Code**

```javascript
import * as Bucket from "@spica-devkit/bucket";

export default function (req, res) {
  const method = req.method.toLowerCase();
  const userId = req.params.id;

  switch (method) {
    case "get":
      return userId ? getUserById(req, res) : getUsers(req, res);
    case "post":
      return createUser(req, res);
    case "put":
      return updateUser(req, res);
    default:
      return res.status(405).send("Method not allowed");
  }
}

async function getUsers(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    // Use bucket ID instead of name
    const users = await Bucket.data.getAll("63b6a403ebfd83002c5e104e", {
      limit: limit,
      skip: skip
    });
    return res.status(200).send(users);
  } catch (error) {
    return res.status(500).send({error: error.message});
  }
}

async function getUserById(req, res) {
  try {
    // Use bucket ID instead of name
    const user = await Bucket.data.get("63b6a403ebfd83002c5e104e", req.params.id);
    if (!user) {
      return res.status(404).send({error: "User not found"});
    }
    return res.status(200).send(user);
  } catch (error) {
    return res.status(500).send({error: error.message});
  }
}

async function createUser(req, res) {
  try {
    // Use bucket ID instead of name
    const newUser = await Bucket.data.insert("63b6a403ebfd83002c5e104e", req.body);
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({error: error.message});
  }
}

async function updateUser(req, res) {
  try {
    // Use bucket ID instead of name
    const updatedUser = await Bucket.data.update(
      "63b6a403ebfd83002c5e104e",
      req.params.id,
      req.body
    );
    return res.status(200).send(updatedUser);
  } catch (error) {
    return res.status(400).send({error: error.message});
  }
}
```

### Database Trigger with Email Notification

**Step 1: Create Function**

```json
{
  "name": "User Registration Handler",
  "triggers": {
    "onUserCreate": {
      "type": "database",
      "active": true,
      "options": {
        "collection": "users",
        "type": "INSERT"
      }
    }
  },
  "timeout": 30,
  "language": "javascript"
}
```

**Step 2: Install Dependencies (if needed for email sending)**

```
POST /api/function/:id/dependencies
{
  "name": ["nodemailer", "axios"]
}
```

**Step 3: Function Code**

```javascript
export default function (change) {
  const newUser = change.document;

  console.log("New user registered:", newUser.email);

  // Send welcome email
  sendWelcomeEmail(newUser);

  // Log registration event
  console.log(`User ${newUser._id} registered at ${new Date()}`);
}

function sendWelcomeEmail(user) {
  // Email sending logic here
  console.log(`Sending welcome email to ${user.email}`);
}
```

### Scheduled Data Cleanup

**Step 1: Create Function**

```json
{
  "name": "Daily Cleanup",
  "triggers": {
    "cleanup": {
      "type": "schedule",
      "active": true,
      "options": {
        "frequency": "0 2 * * *",
        "timezone": "UTC"
      }
    }
  },
  "timeout": 300,
  "language": "javascript"
}
```

**Step 2: Install Required Dependencies**

```
POST /api/function/:id/dependencies
{
  "name": ["@spica-devkit/database"]
}
```

**Step 3: Function Code**

```javascript
import * as Database from "@spica-devkit/database";

export default async function () {
  console.log("Starting daily cleanup...");

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  // Access environment variables for configuration
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 30;
  const batchSize = parseInt(process.env.CLEANUP_BATCH_SIZE) || 1000;

  try {
    // Delete old logs in batches
    let totalDeleted = 0;
    let batch;

    do {
      batch = await Database.deleteMany(
        "logs",
        {
          created_at: {$lt: cutoffDate}
        },
        {limit: batchSize}
      );

      totalDeleted += batch.deletedCount;
      console.log(`Batch deleted: ${batch.deletedCount} entries`);
    } while (batch.deletedCount === batchSize);

    console.log(`Cleanup completed: ${totalDeleted} old log entries deleted`);
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}
```

### Creating Functions Programmatically

**Step 1: Create the Function Structure**

```javascript
const functionData = {
  name: "Book API",
  description: "API for managing books",
  triggers: {
    getBooks: {
      type: "http",
      active: true,
      options: {
        method: "Get",
        path: "/books",
        preflight: true
      }
    },
    getBook: {
      type: "http",
      active: true,
      options: {
        method: "Get",
        path: "/books/:id",
        preflight: true
      }
    },
    createBook: {
      type: "http",
      active: true,
      options: {
        method: "Post",
        path: "/books",
        preflight: true
      }
    }
  },
  timeout: 60,
  language: "javascript"
};

// POST to /api/function
```

**Step 2: Install Dependencies After Function Creation**

```javascript
// Install required packages
const dependencies = {
  name: ["@spica-devkit/bucket", "lodash", "axios"]
};

// POST to /api/function/:functionId/dependencies
```

**Step 3: Update Function Code**

**Step 3: Update Function Code**

```javascript
const functionCode = `
import * as Bucket from "@spica-devkit/bucket";
import _ from "lodash";

export default async function(req, res) {
  const method = req.method.toLowerCase();
  
  if (method === 'get') {
    // Get all books with lodash for data manipulation - use bucket ID
    const books = await Bucket.data.getAll("63b57559ebfd83002c5defe5");
    const sortedBooks = _.sortBy(books, 'title');
    
    return res.status(200).send(sortedBooks);
  }
  
  return res.status(200).send({ 
    message: 'Books API',
    timestamp: new Date().toISOString()
  });
}
`;

// POST to /api/function/:id/index with { index: functionCode }
```

### Importing Functions from Other Functions

Spica allows you to import and use functions from other functions within the same instance. This enables creating modular, reusable function libraries and building complex workflows by chaining functions together.

**Import Syntax:**

```javascript
import * as FunctionName from "../../{function_id}/.build";
```

**Example:**

> Main function

```javascript
// Import other functions by their IDs
import * as ApiHelpers from "../../63b57559ebfd83002c5defe5/.build";
import * as UserService from "../../63b6a403ebfd83002c5e104e/.build";

export default async function (req, res) {
  // Use imported function's exported methods
  const Bucket = ApiHelpers.useBucket();
  const db = await ApiHelpers.useDatabase();

  // Call functions from other functions - use bucket ID, not name
  const userData = await UserService.getUserById(req.params.id);

  // Get count using bucket collection name (bucket_bucketId)
  const userCount = await ApiHelpers.getCount("63b6a403ebfd83002c5e104e");

  return res.status(200).send({
    user: userData,
    totalUsers: userCount
  });
}
```

> Api Helpers function

```javascript
import * as Bucket from "@spica-devkit/bucket";
import {database} from "@spica-devkit/database";

const SECRET_API_KEY = process.env.SECRET_API_KEY;
let db;

export function useBucket(initializeParams = {apikey: SECRET_API_KEY}) {
  Bucket.initialize(initializeParams);
  return Bucket;
}

export async function useDatabase() {
  if (!db) db = await database();
  return db;
}

export async function getCount(bucketId) {
  if (!db) db = await useDatabase();
  return db.collection(`bucket_${bucketId}`).countDocuments({});
}
```

In this pattern, each function can export utilities, configurations, or business logic that other functions can import and use, creating a modular function architecture.

### Common Spica DevKit Dependencies

Here are the most commonly used Spica DevKit packages and their purposes:

**Core Packages:**

```javascript
// For bucket operations (CRUD on collections)
{ "name": ["@spica-devkit/bucket"] }

// For direct database operations
{ "name": ["@spica-devkit/database"] }

// For identity and authentication
{ "name": ["@spica-devkit/identity"] }

// For storage operations (file upload/download)
{ "name": ["@spica-devkit/storage"] }
```

> For more detail about spica packages checkout Spica Devkit Docs

**Managing Function Order and Categories:**

```javascript
// PATCH request for organizing functions
const update = {
  order: 10,
  category: "API Functions"
};

// PATCH to /api/function/:id with merge-patch content type
```
