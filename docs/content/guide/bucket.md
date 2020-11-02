# Bucket

Buckets are the main foundation of Spica Development Engine. While creating a Bucket, the user defines a data schema.

### Outlining Data Schemas

To create a new Bucket, go to Bucket listing page and find the plus (+) icon. Clicking it will take you to Bucket creation page. Or if you want to edit one of your Buckets, on the listing page find the desired Bucket and click the pen icon next to it.
Bucket Create/Edit form divides into a few sections.

#### Top Bar and Describe

On the top bar, you'll see an icon as default. You can click to change the icon of the Bucket. That icon will be shown on the sidebar next to the Bucket title.

To save the Bucket, you have to enter a Title and a Description to explain the Bucket's purpose. While the Title is limited to 15 characters, Description is limited with 250.

#### Properties

Here, in this section, you will define what kind of data the Bucket will hold. By default, Description and Title properties are created. You can delete those properties by clicking the red trash icon to start with a blank Bucket.

To enter a new property, find the text-box with "Enter a property name" placeholder. Enter a unique, lowercase property name and then click the button next to it to save.

> Remember: Spica stores the property names as JSON keys. For this, special characters, spaces and such are forbidden.

You'll see the name of the newly created property is added to the list. Click on it to edit the property and its options.

> Warning: If you change a field type after the creation (e.g. changing a `string` field to `array`), that field's data on bucket entries will be **removed**.

#### View

You can customize the Bucket Data Create/Edit page from this section. Left, Right and Bottom represent the divisions of the layout on Bucket Data Create/Edit page.

You can drag and drop the Bucket Properties to the desired division.

> Remember: You can't save a Bucket if you left one or more Properties on No Position list.

##### Property Options

`Primary field`: Primary field is mainly used for building relations between data.

`Visible on the list`: Effects the list view on Spica Client. Defines whether the field will be shown on list view by default.

`Translate`: Marks the field as translatable. For more information please check [Translation and Localization](###translation-and-localization) section.

`Read-only`: This one is used to prevent value changes on entry create and update.

`Required`: Makes the field required on entry create and update.

### Translation and Localization

**Bucket entries**, in Spica are translatable and localizable out-of-the-box.

To set up the supported language of the Spica instance, navigate to **Developer** -> **Bucket** and find the Bucket Settings button represented by a **cog** icon on the top right toolbar. Click on it and you will see the available languages of the Spica instance. To add a new one, select the language from the Language Selection menu and press **"+ Add new language"** button and click to **Save**.

To add translation and localization feature to a Bucket:

- Open the **Bucket schema edit page**.
- Find the field you would like to have translations
- Click on the **cog** icon to open field options
- Check **Translate** option and save the Bucket

> Warning: This action is irreversible which means, once you make a field to have translations, you can't take it back.

> Note: Only the following type of properties can have localization; `string`, `textarea` and `richtext`

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

### Change History

> To listen bucket changes and use the **History** feature, Spica instance must have three MongoDB replica set. See the Installation section for more information.

Spica, optionally can track down the change history of bucket entries. To enable the history feature for the specific bucket, simply go to a Bucket Schema edit page and toggle the History option.

Once it is toggled on, the changes made on the bucket's entries will be stored.

Navigate to one of the Bucket's entries, look for the **History** button on the top right toolbar. Clicking on it will reveal the last 10 versions of the entry. Clicking the version numbers will only show that version of the data. If you intend to revert the entry to a certain point, just click on the revision number then hit the save button.
