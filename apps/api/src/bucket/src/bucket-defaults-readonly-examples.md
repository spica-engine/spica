# BucketDataController: Defaults and Readonly Fields Examples

This document provides example use cases, requests, and responses for the handling of default and readonly fields in the `BucketDataController`, based on the provided test scenarios.

---

## Use Case 1: Default and Readonly Field Behavior

### Scenario

- The `created_at` field uses a default value if not provided.
- The `created_at_readonly` field is always set to the creation date/time, regardless of what is sent in the request (readonly).

### Bucket Schema (Partial)

```json
{
  "title": "New Bucket",
  "description": "Describe your new bucket",
  "properties": {
    "created_at": {
      "type": "date",
      "default": ":created_at"
    },
    "created_at_readonly": {
      "type": "date",
      "default": ":created_at",
      "readOnly": true
    }
  }
}
```

### Example 1: Insert Document with Both Fields Provided

**Request:**

```http
POST /bucket/{bucketId}/data
Content-Type: application/json

{
  "created_at": "1980-01-01T00:00:00.000Z",
  "created_at_readonly": "1980-01-01T00:00:00.000Z"
}
```

**Response:**

```json
{
  "_id": "...",
  "created_at": "1980-01-01T00:00:00.000Z",
  "created_at_readonly": "2025-07-30T12:34:56.789Z" // actual creation time
}
```

_Note: `created_at_readonly` is set to the real creation time, not the value provided in the request._

---

### Example 2: Insert Document Without Either Field

**Request:**

```http
POST /bucket/{bucketId}/data
Content-Type: application/json

{}
```

**Response:**

```json
{
  "_id": "...",
  "created_at": "2025-07-30T12:34:56.789Z",
  "created_at_readonly": "2025-07-30T12:34:56.789Z"
}
```

_Note: Both fields are set to the creation time by default._

---

## Summary

- Fields with a `default` value are automatically set if not provided in the request.
- Fields marked as `readOnly: true` will always be set by the server, ignoring any value provided by the client.
- This ensures data integrity for audit fields like creation timestamps.

These examples are based on the tested behaviors and can be adapted for other default and readonly field scenarios in your bucket schemas.
