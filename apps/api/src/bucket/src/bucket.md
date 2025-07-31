# BucketDataController

The `BucketDataController` is a RESTful API controller for managing documents within a bucket in the Spica platform. It provides endpoints for CRUD operations, filtering, localization, and activity/history tracking on bucket data.

## Endpoints

### GET `/bucket/:bucketId/data`

- **Description:** Retrieve documents from a bucket.
- **Query Parameters:**
  - `relation` (boolean|string[]): Include related documents.
  - `paginate` (boolean): Include total count.
  - `localize` (boolean): Localize translations (default: true).
  - `filter` (string|object): Filter expression or JSON.
  - `limit` (number): Max documents to return.
  - `skip` (number): Documents to skip.
  - `sort` (object): Sort order.
- **Headers:**
  - `accept-language`: Language for translations.
- **Example Request:**
  ```http
  GET /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data?limit=2&sort={"name":1}
  Accept-Language: en_US
  ```
- **Example Response:**
  ```json
  [
    {
      "_id": "64b8c2e1f1a2b3c4d5e6f7b1",
      "name": "The Great Gatsby",
      "writer": "F. Scott Fitzgerald",
      "written_at": "1925"
    },
    {
      "_id": "64b8c2e1f1a2b3c4d5e6f7b2",
      "name": "To Kill a Mockingbird",
      "writer": "Harper Lee",
      "written_at": "1960"
    }
  ]
  ```

### GET `/bucket/:bucketId/data/profile`

- **Description:** Retrieve profile entries from a bucket.
- **Query Parameters:**
  - `filter`, `limit`, `skip`, `sort` (as above).
- **Example Request:**
  ```http
  GET /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data/profile?limit=1
  ```
- **Example Response:**
  ```json
  [
    {
      "_id": "64b8c2e1f1a2b3c4d5e6f7b1",
      "profile": "admin",
      "user": "jane.doe@example.com"
    }
  ]
  ```

### GET `/bucket/:bucketId/data/:documentId`

- **Description:** Retrieve a single document by ID.
- **Query Parameters:**
  - `localize`, `relation` (as above).
- **Headers:**
  - `accept-language`: Language for translations.
- **Example Request:**
  ```http
  GET /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data/64b8c2e1f1a2b3c4d5e6f7b1
  Accept-Language: en_US
  ```
- **Example Response:**
  ```json
  {
    "_id": "64b8c2e1f1a2b3c4d5e6f7b1",
    "name": "The Great Gatsby",
    "writer": "F. Scott Fitzgerald",
    "written_at": "1925"
  }
  ```

### POST `/bucket/:bucketId/data`

- **Description:** Insert a new document into the bucket.
- **Body:** JSON object matching the bucket schema.
- **Example Request:**

  ```http
  POST /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data
  Content-Type: application/json

  {
    "name": "The Great Gatsby",
    "writer": "F. Scott Fitzgerald",
    "written_at": "1925"
  }
  ```

- **Example Response:**
  ```json
  {
    "_id": "64b8c2e1f1a2b3c4d5e6f7b1",
    "name": "The Great Gatsby",
    "writer": "F. Scott Fitzgerald",
    "written_at": "1925"
  }
  ```
- **Example (Translated Field):**

  ```http
  POST /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data
  Content-Type: application/json

  {
    "name": {
      "tr_TR": "Muhteşem Gatsby",
      "en_US": "The Great Gatsby"
    },
    "writer": "F. Scott Fitzgerald",
    "written_at": "1925"
  }
  ```

### PUT `/bucket/:bucketId/data/:documentId`

- **Description:** Replace a document.
- **Body:** Full document object.
- **Example Request:**

  ```http
  PUT /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data/64b8c2e1f1a2b3c4d5e6f7b1
  Content-Type: application/json

  {
    "name": "Lucifer",
    "age": 35,
    "famous": true,
    "role": "Actor"
  }
  ```

- **Example Response:**
  ```json
  {
    "_id": "64b8c2e1f1a2b3c4d5e6f7b1",
    "name": "Lucifer",
    "age": 35,
    "famous": true,
    "role": "Actor"
  }
  ```

### PATCH `/bucket/:bucketId/data/:documentId`

- **Description:** Update a document using JSON merge patch.
- **Body:** Partial document object.
- **Example Request:**

  ```http
  PATCH /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data/64b8c2e1f1a2b3c4d5e6f7b1
  Content-Type: application/json

  {
    "name": "Daniel",
    "age": null
  }
  ```

- **Example Response:**
  ```json
  {
    "_id": "64b8c2e1f1a2b3c4d5e6f7b1",
    "name": "Daniel",
    "age": null,
    "famous": true,
    "role": "Actor"
  }
  ```

### DELETE `/bucket/:bucketId/data/:documentId`

- **Description:** Delete a document by ID.
- **Example Request:**
  ```http
  DELETE /bucket/64b8c2e1f1a2b3c4d5e6f7a8/data/64b8c2e1f1a2b3c4d5e6f7b1
  ```
- **Example Response:**
  HTTP 204 No Content

## Features

- **Localization:** Supports `accept-language` for translated fields.
- **Relations:** Can include related documents in responses.
- **Filtering:** Supports advanced filtering and sorting.
- **History:** Optionally tracks document history.
- **Activity:** Emits activity events for changes.
- **Validation:** Validates documents against the bucket schema.

## Schema

Bucket schemas are defined in JSON Schema format (`bucket.schema.json`). They specify required fields, field types, relations, and additional options like translation and history.

## Error Handling

- Returns `404 Not Found` if the bucket or document does not exist.
- Returns `400 Bad Request` for validation errors.

## Security

- Uses guards for authentication and authorization.
- Supports resource-based access control via ACL rules in the schema.

---

This documentation provides an overview for developers integrating with or maintaining the `BucketDataController`. For more details, refer to the code and schema files.
