# Bucket

Buckets are the main foundation of Spica Development Engine. While creating a Bucket, the user defines a data schema. Once you create your bucket, Spica will generate Rest API endpoints automatically. So you can send HTTP request to get/update/insert a bucket data.

## Bucket Creation Steps

To create a bucket you need to define bucket name, description and fields. You can also customize your bucket view and add rules to apply security checks. On the top bar, you'll see an icon as default. You can click to change the icon of the Bucket. That icon will be shown on the sidebar next to the Bucket title. While the Title is limited to 15 characters, Description is limited with 250. Once you finish creating a new bucket, you will see it on navigator. Bucket ID will be assigned automatically so you can access your data via API. For more details visit API Reference.

> NOTE: Until you finalize bucket creation steps, everything will be in memory. So if you change page, your settings will be lost.

## Properties

Here, in this section, you will define what kind of data the Bucket will hold. By default, Description and Title properties are created. You can delete those properties by clicking the red trash icon to start with a blank Bucket.

To enter a new property, find the text-box with "Enter a property name" placeholder. Enter a unique, lowercase property name and then click the button next to it to save.

> Remember: Spica stores the property names as JSON keys. For this, special characters, spaces and such are forbidden.

You'll see the name of the newly created property is added to the list. Click on it to edit the property and its options.

> Warning: If you change a field type after the creation (e.g. changing a `string` field to `array`), that field's data on bucket entries will be **removed**.

### Property Options

`Primary field`: Primary field is mainly used for building relations between data.

`Visible on the list`: Effects the list view on Spica Client. Defines whether the field will be shown on list view by default.

`Translate`: Marks the field as translatable. For more information please check [Translation and Localization](###translation-and-localization) section.

`Read-only`: This one is used to prevent value changes on entry create and update.

`Required`: Makes the field required on entry create and update.

### Validations

[TODO]

#### General Validations

#### String

#### Number

#### Array

#### Object

### Some Examples

Agency name: `string`

Age: `number`

Project release date: `date` with predefined values.

Company address: `richtext` (if you want to enable HTML codes) or `textarea`.

Thumbnail image: `storage`

Phone: `string`

Product name: `string`

## View

You can customize the Bucket Data Create/Edit page from this section. Left, Right and Bottom represent the divisions of the layout on Bucket Data Create/Edit page.

You can drag and drop the Bucket Properties to the desired division.

> Remember: You can't save a Bucket if you left one or more Properties on No Position list.

## Rules

[TODO]

### Translation and Localization

**Bucket entries**, in Spica are translatable and localizable out-of-the-box.

To set up the supported language of the Spica instance, navigate to **Bucket list** and find the Bucket Settings button on the sidebar next to the **Add New Bucket**. Click on it and you will see the available languages of the Spica instance. To add a new one, select the language from the Language Selection menu and press **"+ Add new language"** button and click to **Save**.

To add translation and localization feature to a Bucket:

- Open the **Bucket schema edit page**.
- Find the field you would like to have translations
- Check **Translate** option and save the Bucket

> Warning: This action is irreversible which means, once you make a field to have translations, you can't take it back.

> Note: Only the following type of properties can have localization; `object`, `storage`, `string`, `textarea` and `richtext`

Once you save the Bucket, go to the Bucket Data Add page and you'll see a language selection next to the input of the multilingual property. You can select desired language code, entering a value and switch to another language and so on.

The final form of a multilingual property will be like this:

```json
{...
  "text": {
    "en_US": "This is some text in English.",
    "es_ES": "Este es un texto en Español."
  }
...}
```

## Auto-Publish

For scheduled publish, there is an auto-publish feature in the bucket module. So you can set a date for a specific entry and the system will make that particular entry available in that time. You can see all scheduled entries and published entries in different tabs. To get more details about accessing to scheduled entry, please see API reference.

## History / Revisions

Spica, optionally can track down the change history of bucket entries. To enable the history feature for the specific bucket, simply go to a Bucket Schema edit page and toggle the History option. Once it is toggled on, the changes made on the bucket's entries will be stored.

Navigate to one of the Bucket's entries, look for the **History** button on the top right toolbar. Clicking on it will reveal the last 10 versions of the entry. Clicking the version numbers will only show that version of the data. If you intend to revert the entry to a certain point, just click on the revision number then hit the save button.

## Real-time

This feature helps you to connect bucket collections and listen to the bucket data and their changes in real-time to handle constantly changing workloads. Unlike API calls, retrieved data will always be actual. You can skip some data row or limit the amount of data you'll get. Sorting and filtering are also supported. Real-time bucket system is mostly useful for chat applications, reservation systems and accounting.
