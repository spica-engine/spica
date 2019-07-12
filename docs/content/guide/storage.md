# Storage

This module is essentially a file manager on your Spica instance. You can store, list and delete your files via this module.

## Listing Storages

#### With Client

You can find the list of your Storage by clicking on the **Storage** from the side menu or by going to the `/storage` URL. If you've just initialized the Spica, the list would be empty.

#### With API

Request URL:

> GET "{baseUrl}/storage/{params}"

Params:  
All the params below are optional.

`"limit"`: Accepts number value. Limits the data count on listing array.

`"skip"`: Skips number of entries before listing.

`"sort"`: Accepts mongoDb \$sort aggregation.

Example response:

```json
{
  "meta": {"total": 1},
  "data": [
    {
      "_id": "5d23021d9cab7f1be35b716f",
      "content": {"type": "image/png", "size": 52450},
      "name": "logo.png",
      "url": "https://example.com/storage/5d23021d9cab7f1be35b716f"
    }
  ]
}
```

## Getting Single Storage Item

Request URL:

> GET "{baseUrl}/storage/{storage _id}"

Above url will return the storage item itself. For example; if the item is an image, url shows image itself. 

To get the json data of a storage item, add `withMeta=true` query parameter to your request.


## Deleting Storage Item

#### With Client

Go to Storage Listing page and click on the `three dots` next to the item. Click `delete` button to delete the item.

#### With API Call

Request URL:

> DELETE "{baseUrl}/storage/{storage _id}"

## Online Image Editor

To edit image typed storage item, click the `three dots` next to the item to open the context menu. Clicking the `edit` button will takes you to the Image Editing page. 

On that page you crop the image, scale by percentage and rotate the image as you wish. Click on the `tick` icon to save the image after editing. 