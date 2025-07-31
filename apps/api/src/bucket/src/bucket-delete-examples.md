# BucketDataController: Delete Request Examples

This document provides example use cases, requests, and responses for the delete features of the `BucketDataController`, based on the provided test scenarios.

---

## Use Case 1: Deleting a Document

### Scenario

Delete a document from a bucket by its ID. After deletion, the document should no longer exist in the bucket.

### Example Request

```http
DELETE /bucket/{bucketId}/data/{documentId}
```

### Example Response

```
HTTP/1.1 204 No Content

// No response body
```

### Follow-up: List Remaining Documents

```http
GET /bucket/{bucketId}/data
```

**Response:**

```json
[
  {
    "_id": "...",
    "title": "first title",
    "description": "first description"
  }
]
```

---

## Use Case 2: Deleting a Non-Existent Document

### Scenario

Attempt to delete a document that does not exist. The API should return a 404 error with a descriptive message.

### Example Request

```http
DELETE /bucket/{bucketId}/data/000000000000000000000000
```

### Example Response

```json
{
  "statusCode": 404,
  "message": "Could not find the document with id 000000000000000000000000",
  "error": "Not Found"
}
```

---

## Notes

- A successful delete returns HTTP 204 with no content.
- Deleting a non-existent document returns HTTP 404 with a clear error message.
- After deletion, the document is no longer returned in subsequent GET requests for the bucket's data.

These examples are based on the tested behaviors and can be adapted for other delete scenarios in your bucket APIs.
