# BucketDataController Field-Level Authorization Examples

This document provides example use cases, requests, and responses for field-level authorization in the `BucketDataController`, based on the provided test scenarios.

## Use Case 1: Hiding a Field Based on User Identity

### Scenario

The `name` field should be hidden for users with the identifier `noop`.

### Bucket Schema (Partial)

```json
{
  "title": "Persons",
  "description": "Person bucket",
  "properties": {
    "name": {
      "type": "string",
      "acl": "auth.identifier != 'noop'"
    },
    "age": {"type": "number"}
  }
}
```

### Example Request

```http
GET /bucket/{bucketId}/data
Authorization: Bearer <token-for-noop-user>
```

### Example Response

```json
[
  {"_id": "1", "age": 20},
  {"_id": "2", "age": 22},
  {"_id": "3", "age": 25},
  {"_id": "4", "age": 38},
  {"_id": "5", "age": 30}
]
```

_Note: The `name` field is not present in any document for this user._

---

## Use Case 2: Conditionally Showing a Field Based on Document Data

### Scenario

The `name` field should only be visible if `age > 24`.

### Bucket Schema (Partial)

```json
{
  "properties": {
    "name": {
      "type": "string",
      "acl": "document.age > 24"
    },
    "age": {"type": "number"}
  }
}
```

### Example Request

```http
GET /bucket/{bucketId}/data
```

### Example Response

```json
[
  {"_id": "1", "age": 20},
  {"_id": "2", "age": 22},
  {"_id": "3", "name": "Kevin", "age": 25},
  {"_id": "4", "name": "Dwight", "age": 38},
  {"_id": "5", "name": "Toby", "age": 30}
]
```

_Note: Only documents with `age > 24` include the `name` field._

---

## Use Case 3: Creating and Listing Documents

### Create Documents

```http
POST /bucket/{bucketId}/data
Content-Type: application/json

{"name": "Jim", "age": 20}
```

Response:

```json
{"_id": "1", "name": "Jim", "age": 20}
```

---

## Use Case 4: Updating Field-Level ACLs

### Update Bucket Schema to Change Field ACL

```http
PUT /bucket/{bucketId}
Content-Type: application/json

{
  ...,
  "properties": {
    "name": {
      "type": "string",
      "acl": "document.age > 24"
    },
    ...
  }
}
```

Response:

```json
{"_id": "bucketId", ...}
```

---

## Notes

- Field-level ACLs allow dynamic control over which fields are visible to which users or under which conditions.
- If a field is hidden by ACL, it will not appear in the API response for affected users or documents.
- These examples are based on the test cases and can be adapted for other field-level authorization scenarios.
