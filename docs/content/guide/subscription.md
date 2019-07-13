# Subscription

## Listing Subscriptions

### With Client

You can find the list of your Subscriptions by clicking on the **Subscription** from the side menu under the Developer section. If you've just initialized the Spica, the list would be empty.

### With API Call

Request URL:

> GET "{baseUrl}/subscriptions?{params}"

Params:  
All the params below are optional.

`"limit"`: Accepts number value. Limits the data count on listing array.

`"skip"`: Skips number of entries before listing.

Example request body:

```json
{
  "_id": "5d28479731c9df40396bc240",
  "trigger": {
    "type": "database",
    "options": {
      "fullDocument": true,
      "collection": "bucket_5cd185bdb6103e96f0dc9f0c",
      "type": "UPDATE"
    }
  },
  "url": "https://tburleson-layouts-demos.firebaseapp.com/#/grid"
}
```

## Create and Edit Subscription

### With Client

### With API Call

Request URL:

> POST "{baseUrl}/subscriptions/add"

Example :

```json
{
  "meta": {"total": 1},
  "data": [
    {
      "_id": "5d28479731c9df40396bc240",
      "trigger": {
        "type": "database",
        "options": {
          "fullDocument": true,
          "collection": "bucket_5cd185bdb6103e96f0dc9f0c",
          "type": "UPDATE"
        }
      },
      "url": "https://tburleson-layouts-demos.firebaseapp.com/#/grid"
    }
  ]
}
```

## Delete Subscription

### With Client

### With API Call

Request URL:

> DELETE "{baseUrl}/subscriptions/{subscription \_id}"
