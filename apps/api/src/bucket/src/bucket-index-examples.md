# BucketDataController: Index, Query, Filter, Sort, Pagination, and Localization Examples

This document provides example use cases, requests, and responses for the main data listing, filtering, sorting, pagination, and localization features of the `BucketDataController`, based on the provided test scenarios.

---

## Use Case 1: Basic Listing

**Request:**

```http
GET /bucket/{bucketId}/data
```

**Response:**

```json
[
  {"_id": "1", "name": "Jim", "age": 20},
  {"_id": "2", "name": "Michael", "age": 22},
  {"_id": "3", "name": "Kevin", "age": 25},
  {"_id": "4", "name": "Dwight", "age": 38},
  {"_id": "5", "name": "Toby", "age": 30}
]
```

---

## Use Case 2: Skip and Limit

**Request:**

```http
GET /bucket/{bucketId}/data?skip=2&limit=2
```

**Response:**

```json
[{"_id": "3", "name": "Kevin", "age": 25}, {"_id": "4", "name": "Dwight", "age": 38}]
```

---

## Use Case 3: Sorting

**Ascending by name:**

```http
GET /bucket/{bucketId}/data?sort={"name":1}
```

**Descending by age:**

```http
GET /bucket/{bucketId}/data?sort={"age":-1}
```

---

## Use Case 4: Pagination

**Request:**

```http
GET /bucket/{bucketId}/data?paginate=true&limit=2
```

**Response:**

```json
{
  "meta": {"total": 5},
  "data": [{"_id": "1", "name": "Jim", "age": 20}, {"_id": "2", "name": "Michael", "age": 22}]
}
```

---

## Use Case 5: Filtering

**By name:**

```http
GET /bucket/{bucketId}/data?filter={"name":"Jim"}
```

**By age greater than 22:**

```http
GET /bucket/{bucketId}/data?filter={"age":{"$gt":22}}
```

**By expression:**

```http
GET /bucket/{bucketId}/data?filter=age>22
```

---

## Use Case 6: Advanced Filtering (Date Ranges)

**Request:**

```http
GET /bucket/{bucketId}/data?filter={"created_at":{"$gte":"Date(2020-04-20T10:00:00.000Z)","$lt":"Date(2020-05-20T10:00:00.000Z)"}}
```

**Response:**

```json
[{"_id": "6", "name": "Sherlock", "age": 28, "created_at": "2020-04-20T10:00:00.000Z"}]
```

---

## Use Case 7: Localization

**Request (English):**

```http
GET /bucket/{bucketId}/data
Accept-Language: en_US
```

**Response:**

```json
[
  {"_id": "1", "title": "english words", "description": "description"},
  {"_id": "2", "title": "new english words", "description": "description"},
  {"_id": "3", "title": "only english words", "description": "description"}
]
```

**Request (Turkish):**

```http
GET /bucket/{bucketId}/data
Accept-Language: tr_TR
```

**Response:**

```json
[
  {"_id": "1", "title": "türkçe kelimeler", "description": "description"},
  {"_id": "2", "title": "yeni türkçe kelimeler", "description": "description"},
  {"_id": "3", "title": "only english words", "description": "description"}
]
```

**Request (No localization):**

```http
GET /bucket/{bucketId}/data?localize=false
Accept-Language: tr_TR
```

**Response:**

```json
[
  {
    "_id": "1",
    "title": {"en_US": "english words", "tr_TR": "türkçe kelimeler"},
    "description": "description"
  },
  {
    "_id": "2",
    "title": {"en_US": "new english words", "tr_TR": "yeni türkçe kelimeler"},
    "description": "description"
  },
  {"_id": "3", "title": {"en_US": "only english words"}, "description": "description"}
]
```

---

## Use Case 8: Error Handling (Invalid Filter Constructor)

**Request:**

```http
GET /bucket/{bucketId}/data?filter={"created_at":{"$gt":"Throw(2020-04-20T10:00:00.000Z)"}}
```

**Response:**

```json
{
  "statusCode": 400,
  "message": "Could not find the constructor Throw in {\"$gt\":\"Throw(2020-04-20T10:00:00.000Z)\"}"
}
```

---

---

## Use Case 9: Advanced Filtering with Regex

**Request:**

```http
GET /bucket/{bucketId}/data?filter={"name":{"$regex":"i"}}
```

**Response:**

```json
[
  {"_id": "1", "name": "Jim", "age": 20},
  {"_id": "2", "name": "Michael", "age": 22},
  {"_id": "3", "name": "Kevin", "age": 25},
  {"_id": "4", "name": "Dwight", "age": 38}
]
```

---

## Use Case 10: findOne with Localization

**Request:**

```http
GET /bucket/{bucketId}/data/{documentId}
Accept-Language: en_US
```

**Response:**

```json
{"_id": "1", "title": "english words", "description": "description"}
```

**Request:**

```http
GET /bucket/{bucketId}/data/{documentId}
Accept-Language: tr_TR
```

**Response:**

```json
{"_id": "1", "title": "türkçe kelimeler", "description": "description"}
```

---

## Use Case 11: Relations (One-to-One and One-to-Many)

### Example: User with Wallets (One-to-Many)

**Request:**

```http
GET /bucket/{usersBucketId}/data?relation=wallet
```

**Response:**

```json
[
  {
    "_id": "u1",
    "name": "wealthy user",
    "wallet": [{"_id": "w1", "name": "GNB"}, {"_id": "w2", "name": "FNB"}]
  }
]
```

### Example: Statistics with User and Achievement (One-to-One)

**Request:**

```http
GET /bucket/{statisticsBucketId}/data?relation=achievement,user
```

**Response:**

```json
[
  {
    "_id": "s1",
    "user": {"_id": "u1", "name": "user66"},
    "achievement": {"_id": "a1", "name": "do something until something else happens"}
  }
]
```

---

## Use Case 12: Filtering by Relation Field

**Request:**

```http
GET /bucket/{statisticsBucketId}/data?filter={"user":"u1"}
```

**Response:**

```json
[{"_id": "s1", "user": "u1", "achievement": "a1"}]
```

---

## Use Case 13: Documents with Unfilled Relation Field

**Request:**

```http
GET /bucket/{usersBucketId}/data
```

**Response:**

```json
[
  {"_id": "u1", "name": "user66"},
  {"_id": "u2", "name": "user33"},
  {"_id": "u3", "name": "wealthy user", "wallet": ["w1", "w2"]}
]
```

---

## Use Case 14: Multiple Relational Requests

**Request:**

```http
GET /bucket/{statisticsBucketId}/data?relation=achievement,user.wallet
```

**Response:**

```json
[
  {
    "_id": "s1",
    "user": {
      "_id": "u3",
      "name": "wealthy user",
      "wallet": [{"_id": "w1", "name": "GNB"}, {"_id": "w2", "name": "FNB"}]
    },
    "achievement": {"_id": "a1", "name": "do something until something else happens"}
  }
]
```

---

## Use Case 15: Error Handling - Validation

**Request:**

```http
POST /bucket/{bucketId}/data
Content-Type: application/json

{
  "title": "title",
  "description": [1,2,3]
}
```

**Response:**

```json
{
  "statusCode": 400,
  "error": "validation failed",
  "message": ".description must be string"
}
```

---

These examples are based on the tested behaviors and can be adapted for other query, filter, sort, pagination, localization, relation, and error scenarios in your bucket APIs.
