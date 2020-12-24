## Devkit Modules

## Table of contents

Spica provides modules to your function in runtime. Modules work like a module in node_modules but not placed in node_modules directory.

In order to use these modules in a **function**, they need to be added as **dependency** on **Function Edit page**.

| Module                    | Description                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@spica-devkit/database`  | This module has a public API for making database operations like **update**, **delete**, **create**, **get**                    |
| `@spica-devkit/bucket`    | This module has a public API for making both Bucket and Bucket Data operations like **update**, **delete**, **insert**, **get** |
| `@spica-devkit/dashboard` | This module has a public API for making Dashboard operations |

### Database

The database module is an in-memory module that has a public API for basic database operations like `FIND`, `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, `DROP`.

> Database module imported from `@spica-devkit/database`.

#### Connecting to the database

You can get the database instance with the `database()` function exported from `@spica-devkit/database` module.

```typescript
import {database, Database} from "@spica-devkit/database";

const db: Database = await database();
// Type of db variable is  Database which exported from `@spica-devkit/database`
```

#### Getting the reference to a Collection

To make changes in a collection you need to get it reference first. You can get the reference for a specific collection with `Database.collection()` function exported by your database instance. For more information check [mongoDB API](https://mongodb.github.io/node-mongodb-native/3.2/api/Collection.html)

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

const db: Database = await database();
const collection: Collection = db.collection("persistent_collection");
```

#### Operations

Here is some fundamental examples;

##### Insert

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

export default async function() {
  const db: Database = await database();
  const books: Collection = db.collection("books");

  // insertOne will return Promise<void>
  await books.insertOne({
    name: "The Fall Of Leaves",
    translator: "W. D. Halsey",
    available_in: ["English", "Turkish"]
    author: "Resat Nuri Guntekin",
    year: 1930
  });
}
```

##### Find

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

export default async function() {
  const db: Database = await database();
  const books: Collection = db.collection("books");

  // Get all books
  const allBooks = await books.find().toArray();
  console.dir(allBooks);
  // Above code will print [{ name: "The Fall Of Leaves", ... }]

  const writtenAfter19StCentury = await books.find({year: {$gte: 2000}}).toArray();
  console.dir(writtenAfter19StCentury);
  // Result will be empty array.
}
```

> NOTE: `find` method accepts [Query and Projection Operators](https://docs.mongodb.com/manual/reference/operator/query/)

##### Find One

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

export default async function() {
  const db: Database = await database();
  const books: Collection = db.collection("books");

  // Find the book named The Fall Of Leaves
  const book = await books.findOne({name: "The Fall Of Leaves"});
  console.dir(book);
  // Result will be { name: "The Fall Of Leaves", ... }
}
```

##### Update

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

export default async function() {
  const db: Database = await database();
  const books: Collection = db.collection("books");

  // Find the book named The Fall Of Leaves
  const book = await books.findOne({name: "The Fall Of Leaves"});

  // If the book found then update it's published year
  if (book) {
    book.year = 2000;
    // Update whole document with $set
    await books.update({name: book.name}, {$set: book});
  }
}
```

### Bucket

> Bucket module imported from `@spica-devkit/bucket`.

##### Initializing Bucket Module

To initialize a bucket, simply use `initialize` function exported from `@spica-devkit/bucket` module. Specify the APIKEY and optional API url.

```typescript
import * as Bucket from "@spica-devkit/bucket";

Bucket.initialize({apikey: "{APIKEY which as the needed policy}", publicUrl: ""});
```

##### Operations

###### Get

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});
  return Bucket.get("{BUCKET ID}");
}
```

###### Get All

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});
  return Bucket.getAll();
}
```

###### Insert

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});

  let bucket = {
    title: "Example Bucket",
    description: "User Bucket Description",
    primary: "name",
    properties: {
      name: {
        type: "string",
        title: "name",
        options: {position: "left", visible: true}
      },
      surname: {
        type: "string",
        title: "surname",
        options: {position: "right"}
      }
    }
  };

  return Bucket.insert(newBucket);
}
```

###### Update

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});

  let bucket = {
    title: "Example Bucket",
    description: "User Bucket Description",
    primary: "name",
    properties: {
      name: {
        type: "string",
        title: "name",
        options: {position: "left", visible: true}
      },
      surname: {
        type: "string",
        title: "surname",
        options: {position: "right"}
      }
    }
  };

  return Bucket.update("5f10302b4d858d1824e57e6d", {
    ...bucket,
    title: "UPDATED BUCKET TITLE"
  });
}
```

###### Delete

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});
  return Bucket.remove("5f10302b4d858d1824e57e6d");
}
```

###### Bucket Data Get

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});
  return Bucket.data.get("{BUCKET ID}", "{BUCKET DATA ID}");
}
```

Note: Additionally, `Bucket.data.get()` function accepts a third optional `options` parameter. The following is the structure of the `options` parameter:

```json
{
  headers: {
    {HTTP HEADER KEY}: "{VALUE}"
  },
  queryParams: {
    {SPICA QUERY PARAMS}: "{VALUE}",
    filter: "{Access Control Rules}"
  }
}
```

For more information about `Access Control Rules`, please visit [this page](https://spicaengine.com/docs/guide/bucket#rules).


###### Bucket Data Get with Parameters

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});
  return Bucket.data.getAll("{BUCKET ID}", {
    headers: {"accept-language": "TR"},
    queryParams: {paginate: true, skip: 1}
  });
}
```

Note: `Bucket.data.getAll()` function accepts a third optional `options` parameter. The following is the structure of the `options` parameter:

```json
{
  headers: {
    {HTTP HEADER KEY}: "{VALUE}"
  },
  queryParams: {
    {SPICA QUERY PARAMS}: "{VALUE}",
    filter: "{Access Control Rules}"
  }
}
```

For more information about Access Control Rules, please visit [this page](https://spicaengine.com/docs/guide/bucket#rules).

###### Bucket Data Insert

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});

  let document = {
    name: "123",
    surname: "321"
  };

  return Bucket.data.insert("{BUCKET ID}", document);
}
```

###### Bucket Data Update

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});

  let document = {
    name: "123",
    surname: "321"
  };

  return Bucket.data.update("{BUCKET ID}", "{BUCKET DATA ID}", {
    ...document,
    name: "updated_name"
  });
}
```

###### Bucket Data Remove

```typescript
import * as Bucket from "@spica-devkit/bucket";

export default function(req, res) {
  Bucket.initialize({apikey: "{APIKEY}"});
  return Bucket.data.remove("{BUCKET ID}", "{BUCKET DATA ID}");
}
```
