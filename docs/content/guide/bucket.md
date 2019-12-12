# Bucket

## Table of contents

# Bucket

Buckets are schemas of your data. They keep all the necessary information about your data such as their structure, validations.

## List

### With Client

You can find the list of your Bucket by clicking on the **Bucket** from the side menu under the Developer section. If you've just initialized the Spica, the list would be empty.

### With API

URL of request:

> GET "{baseUrl}/bucket"

Example response:

```json
[
  {
    "_id": "5d1c60f9e3f4ee1a938c294c",
    "title": "Example Bucket",
    "description": "Example bucket for Documentation",
    "primary": "title",
    "properties": {
      "title": {
        "type": "string",
        "title": "string",
        "description": "Title of the row",
        "options": {
          "position": "left",
          "visible": true,
          "translate": true
        }
      },
      "description": {
        "type": "textarea",
        "title": "",
        "description": "Description of the row",
        "options": {"position": "right"}
      }
    }
  }
]
```

## Create and Edit

To define your data models on your application, you have to define your data models known as Buckets. You can create and edit directly from your Spica Client or via API calls.

### With Client

To create a new Bucket, go to Bucket listing page and find the plus (`+`) icon. Clicking it will take you to Bucket creation page. Or if you want to edit one of your Buckets, on listing page find the desired Bucket and click the `pen` icon next to it.

Bucket Create/Edit form divides into a few sections.

#### Top Bar and Describe

On top bar you'll see and icon as default. You can click to change the icon of the Bucket. That icon will be shown on the sidebar next to the Bucket title.

To save the Bucket, you have to enter a Title and a Description to explain the Bucket's purpose. While the Title is limited with 100 characters, Description is limited with 250.

#### Properties

Here, in this section, you will define what kind of data the Bucket will hold. By default, Description and Title properties are created. You can delete those properties by clicking the red `trash` icon to start with a blank Bucket.

To enter a new property, find the text-box with "Enter a property name" placeholder. Enter a unique, lowercase property name and then click the button next to it to save.

> Remember: Spica stores the property names as JSON keys. For this, special characters, spaces and such are forbidden.

You'll see the name of the newly created property is added to the list. Click on it to edit the property and its options.

#### View

You can customize the Bucket Data Create/Edit page from this section. `Left`, `Right` and `Bottom` represent the divisions of the layout on Bucket Data Create/Edit page.

You can drag and drop the Bucket Properties to desired division.

> Remember: You can't save a Bucket if you left one or more Properties on `No Position` list.

### With API

> Remember: If you want to create a new Bucket, don't include the `_id` property to the body of your request.

URL of the request:

> POST "{baseUrl}/bucket"

Example request body:

```json
{
  "_id": "5d1c60f9e3f4ee1a938c294c",
  "title": "Test",
  "description": "Test with History Props",
  "icon": "view_stream",
  "primary": "title",
  "properties": {
    "title": {
      "type": "string",
      "title": "Title",
      "description": "Title of the row",
      "options": {"position": "left", "visible": true, "translate": true}
    },
    "description": {
      "type": "textarea",
      "title": "Description",
      "description": "Description of the row",
      "options": {"position": "right"}
    }
  }
}
```

### Property Options

`"positions"`: This option determines the input position of the related property on Bucket Data edit and create page. In this version, Spica supports `left`, `right` and `bottom` positions.

`"required"`: Makes the related property required. If it's `true`, you can't create/edit Bucket's entries without its related property.

`"visible"`: Boolean value to show the related property in listing page on Spica Client.

> Remember: Only the primitive type properties can be shown on list. For example; `object`, `array` type properties can't be marked as `visible`.

`"translate"`: Boolean value to make the related Bucket property localizable.

> Remember: Once you set the this option as `true`, you can't change it later. Go to _Localization with Spica_ section to learn more.

`"readOnly"`: Also boolean. Makes its related property read only field. After it is set as `true`, you can't create/edit Bucket's that property.

## Delete

> Remember: This action is irreversible. Bucket entries and their histories will be deleted along with the Bucket.

### With Client

To delete Bucket; go to the Bucket listing page, find the Bucket you want to create and click on the red `trash` icon. A dialog will pop up to confirm this action. Follow the instruction on dialog and click on `Confirm` button.

### With API

URL of request:

> DELETE "{baseUrl}/bucket/{bucket \_id}"

## Localization

### Adding Language

As default, the newly created Spica instance has only a language, English. If you want to add another language, you can go the Bucket Preferences and select the language you want from the select box and click the `Add Language` button.

> Warning: You can't delete a language from a Spica instance.

### Making Translatable Fields

To add localization to a property, click the `cog` icon next to the property title in the Bucket Add or Edit page, check the `Translate` checkbox.

> Warning: Think carefully before adding localization to a property. Once you add localization, you can't revert that change.

> Note: Only the following type of properties can have localization; `string`, `textarea` and `richtext`

Once you save the Bucket, go to the Bucket Data Add page and you'll see a language selection next to the input of the multilingual property. You can select desired language code, entering a value and switch to another language and so on.

The final form of a multilingual property will be like this:

```json
{
  "text": {
    "en_US": "This is some text in English.",
    "es_ES": "Este es un texto en Español."
  }
}
```

### Getting Locals

Getting the localized data from API call, add `Accept-Language` header and set its value to your desired language. If there isn't any data in that language or your Spica instance doesn't support that language, Spica gets the default language.

> Note: On the index of the client, Spica automatically takes your browser's language configuration and gets the data accordingly.

# Bucket Entries

## List

### With Client

You can find your Buckets on the side menu under `Content` section. Clicking any of Buckets under that section, takes you to the Bucket Data List page. Or alternatively, you can go to `/bucket/{Bucket _id}` URL.

On top bar of the List Page, you'll see the Title and the Description of the Bucket.

> Tips: `info` icon next to the title, helps you to copy `_id` of the Bucket.

Left side of the top bar contains some buttons to change listing. From left to right;

`Display`: Clicking it opens a checkbox menu. Each property can be hidden or shown via those checkboxes.

`Filter`: To filter list result, select a Bucket Property, enter a value and click `Apply` button. You can remove the filter anytime by clicking the `Clear` button.

> Remember: Only primitive type properties can be filtered. You can't search in `Array`, `Object`, `Storage` or `Relation` type properties.

`Refresh`: Refreshes the list.

`Add`: Opens Bucket Data Create page.

### With API

URL of request:

> GET "{baseUrl}/bucket/:bucketId/data?{params}"

Returns paginated `Bucket` array.

Params:  
All the params below are optional.

`"limit"`: Accepts number value. Limits the data count on listing array.

"{baseUrl}/bucket/{bucket \_id}?limit={number}"

`"skip"`: Skips number of entries before listing.

"{baseUrl}/bucket/{bucket \_id}?skip={number}"

`"sort"`: Accepts mongoDb \$sort aggregation. 

{sort order} can have one of the following values:
*1 to specify ascending order.
*-1 to specify descending order.

"{baseUrl}/bucket/{bucket \_id}?sort={ {fieldname}: {sort order} }"

`"prune"`: Accepts boolean. Ignores additional mappings on listing such as getting related Data etc. Returns the data as it is.

`"filter"`: Accepts any mongoDb aggregation stages [^[MongoDB Aggregation Pipeline Stages](https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline/)] excepts \$lookup.

Example response:

```json
{
  "meta": {"total": 2},
  "data": [
    {
      "_id": "5d1c9305c0258a312d83e19c",
      "title": "titvle1",
      "description": "description1"
    },
    {
      "_id": "5d1cabe049afec362c334c7e",
      "title": "title2",
      "description": "description2"
    }
  ]
}
```

## Create and Edit

> Remember: Spica analyzes the new data and validates it with main Bucket Properties. If the new data doesn't match with the schema, Spica won't save and returns validation error.

### With Client

To edit an existing data, go to the Bucket Data Listing page and click the `edit` button of the data you would like to edit. To create new, click on the `plus` icon on top of the listing page.

Spica Client will generate the needed form for you. Fill the form and click on `Save` button.

### With API

Request URL:

> POST "{baseUrl}/bucket/{bucket \_id}/data"

Example request body:

```json
{
  "_id": "5d16195a818b3b3f2d21c019",
  "bucketPropertyKey": "new property value"
}
```

To edit an existing data, put `_id` of the data you would like to edit. To create, don't send `_id` in your request.

## History

If you have followed the Installation guide and set your MongoDB replica sets correctly, your Spica instance keeps bucket data changes. It doesn't matter if you changed the data from the client, API calls or directly from the database as Spica listens to your database changes.

### With Client

To access your history, go to bucket data edit page and you'll see a `clock` icon on the top left of the screen. Click that icon to open the list of history. Numbers represent the change order. If you hover your mouse to any of the numbers on the list, you can see when the changes occur.

Clicking to any of the numbers will revert your data to that date. You can save it if you want, or click the `N` icon at top of the history list to get the latest.

> Note: Spica keeps ten latest history data. If you change the data more than that, oldest history data will be deleted.

#### With API

Listing Histories:

Request URL:

> GET "{baseUrl}/bucket/{bucket \_id}/history/{bucket data \_id}"

Getting single history:

Request URL:

> GET "{baseUrl}/bucket/{bucket \_id}/history/{bucket data \_id}/{history \_id}"

## Import & Export
