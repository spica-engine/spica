# Function

## Table of contents

## Overview

### What is the "function"

Functions is an event-driven execution context for your spica. Simply, you can attach an event to your function from other modules and services. Your function will be triggered _when the event occurs_.

Within a function, you can do almost everything you want to do.

> IMPORTANT: Currently the functions, run under the spica and not isolated from it. Which means your function may have stated from the previous execution.

### Use cases

On-demand nature of functions makes it a perfect candidate for event-driven execution.

See the following table for common `functions` use cases:

| Use case        | Description                                                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data processing | Listen and respond to storage events when a file is created, changed, or removed. Process images, perform video transcoding, validate and transform data, and invoke any service on the internet from your functions. |
| Webhooks        | With a simple HTTP call, respond to events originating from 3rd party systems like GitHub, Slack, Stripe.                                                                                                             |
| APIs            | Compose applications from lightweight, quick and flexible.                                                                                                                                                            |

### Events and triggers

There are events in the Spica. As an example there is an event when there is a change in the database or receive an HTTP request

If you attach a trigger to your function, your function will be executed when the event raised.

Currently, the Functions supports following triggers:

- [HTTP](#http)
- [Database](#database)
- [Schedule](#schedule)

### Event Data

Event trigger will pass the data as parameters to the function when the event raised. The parameters will be different related to the type of event.

For example a function which has http trigger will look like this:

```typescript
export default function(request: triggers.http.Request, response: triggers.http.Response) {
  // Send the response
  response.send({
    message: "Spica is awesome!"
  });
}
```

See [triggers](#triggers) section for parameter types.

### Modules

Spica provides modules to your function in runtime. Modules work like a module in node_modules but not placed in node_modules directory.

> NOTE: Modules are not published in a registry like npmjs.com, so you can not install or use outside of a spica.

Currently, there are few modules helps you to get information about your spica.

| Module               | Description                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@internal/database` | This module has a public API for making database operations like **update**, **delete**, **create**, **get** |

## Triggers

### Http

#### Overview

You can invoke your function with an HTTP request using the `POST`, `PUT`, `GET`, `DELETE`, `PATCH`, `HEAD` and `OPTIONS` HTTP methods along with a path like `/books` or `/books/:id`.

To able to create a function with HTTP trigger, you need two information;
Path and Method, the method must be one of the specified HTTP methods above also you need a path like above.

> HINT: When you save your function the endpoint will be provisioned automatically.

> **IMPORTANT:** The path and method are not validated for any collision with another function's path and method. So make sure that the path and method not used by other functions otherwise you function may override other function's path.

#### Method

Http trigger needs an HTTP method to be able to triage requests properly. For more info check out [Http Methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)

Currently, these methods are valid for use;

- `GET`
- `POST`
- `PUT`
- `DELETE`
- `PATCH`
- `HEAD`
- `OPTIONS`

Also, you can use `ANY` method that covers all methods above which means your function will be executed regardless of the HTTP method of request that bein received.

#### Path

Spica will use the path will use when reserve a trigger URL for your function. When you save your function, the trigger URL will be attached to **`{API_URL}/fn-execute`** as suffix URL.

For example;

**`/books`** will be served at **`/fn-execute/books`** path

Also, Path can have a _wildcard_ or a _parameter_ segment.

Example: **`/books/:bookId`** can match with these paths above:

- `/books/1`
- `/books/mybookid`
- `/books/getting started with spica`

However the **`/books/:bookId`** path **will not** match with the paths below:

- `/books/1/author`
- `/books/1/update`

Because the path has only one parameter which can match with a sub-segment.

##### Getting parameters in function code

The parameters in the trigger path will be passed through the `request` parameter to your function. It's the first parameter of your function.

Example:

For **`/books/:bookId`** path, you can access the **bookId** parameter from **`request.params`** object.

```typescript
export default function(request: triggers.http.Request, response: triggers.http.Response) {
  // Print the bookId parameter
  console.log(request.params.bookId);
  // Send the response
  response.send({
    bookId: request.params.bookId
  });
}
```

When you execute this function on **`/fn-execute/books/1`** URL, the response will contain the following information

```json
{
  "bookId": 1
}
```

#### Request Body

Usually, every request contains a payload (body) along with the request. It can be either `Raw` or `Text` payload. You can access to the payload of the request with `request.body` property.

Example function;

```typescript
export default function(request: triggers.http.Request, response: triggers.http.Response) {
  // A entry will appear in function logs.
  console.dir(request.body);
  // Send body as response right away
  response.send(request.body);
}
```

If you send a `POST` request to this function with following `JSON` payload; You will get the exact payload to response back because we used `request.body` as a response payload.

```json
{
  "name": "The Fall Of Leaves",
  "description": " The Fall Of Leaves is a novel by Turkish author and playwright Resat Nuri Guntekin, written in 1930.",
  "translator": "W. D. Halsey",
  "author": "Resat Nuri Guntekin",
  "year": 1930
}
```

You need to parse payload to be able to use it in a function.

"Function" parses the following payload types by default:

| Origin | Content-Type                      | Supported | Description                                                                               |
| ------ | --------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| Text   | application/json                  | Yes       | Supported by default.                                                                     |
| Raw    | application/bson                  | Yes       | Supported by default.                                                                     |
| Text   | application/x-www-form-urlencoded | No        | Will be supported soon. See issue [#28](https://github.com/spica-engine/spica/issues/28). |
| Raw    | multipart/form-data               | No        | Will be supported soon. See issue [#28](https://github.com/spica-engine/spica/issues/28). |
| Text   | application/xml                   | No        | You need to install an appropriate module to handle request payload.                      |
| Text   | application/yaml                  | No        | You need to install an appropriate module to handle request payload.                      |

### Database

Database trigger, invokes your function when a specific database event raised in a collection of database. The database trigger can invoke your function with `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, `DROP` events in a specific database collection. When the event raised, your function will be invoked with the changes in the collection.

To be able to create a function that triggered by database event, you need two required and one optional information about the event

- **Collection:** Name of the collection where the set of documents stored
- **Event Type:** Type of the event that happens in the collection. It can be `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, `DROP`.
- **Full Document:** Whether you want only full document or changes on passed data.

> IMPORTANT: When a REPLACE/UPDATE event immediately followed by DELETE/DROP event, `fullDocument` property in the event will be `null`. 

A basic database function looks like this:

```typescript
export default function(changes: triggers.database.Changes) {
  console.log(changes);
  // Business logic here
}
```

In the example code above, changes variable which passed to our function on the first parameter contains all the information about the changes.

Content of `changes` variable with the `INSERT` event and `full document` option enabled will look like this;

```typescript
{
  "operationType": "insert", // Type of the event
  "clusterTime": 1563732441, // Time of the event occurrence
  "fullDocument": {
    // The newly inserted document
    "_id": "5d34a9d957b31b06390788ec",
    "wysiwyg": {"en_US": "dqwdwd"},
    "relation": "5d132772d5869d9fd24c5985"
  },
  "ns": {
    // database name and collection name
    "db": "spica",
    "coll": "bucket_5d15d8244a23f73a2a453770"
  },
  "documentKey": {
    // the id of the inserted document (ObjectId string)
    "_id": "5d34a9d957b31b06390788ec"
  }
}
```

### Schedule

Schedule trigger invokes your function in a specific time and specific timezone. Fundamentally, schedule trigger is a [CRON](https://en.wikipedia.org/wiki/Cron) based trigger that invokes your function in a specific interval based on your CRON expression. Also, when your function invoked, the first parameter of your function will contain a function which basically stops the scheduler in case you don't want your function to be invoked at next tick.

To create a scheduled function you need a CRON time expression and Time-zone because scheduler schedules your function regardless of the Time-zone of the host machine.

For example, if you want to run your function at every minute, you need a cron time expression like this [\* \* \* \* \*](https://crontab.guru/#*_*_*_*_*).

```typescript
export default function(stop: triggers.schedule.Stop) {
  // Also, note that you do not have to stop your function
  if (true) {
    // Scheduler will stop after first invocation by scheduler
    stop();
  }
  // Your business logic
}
```

In the example, we have stopped scheduler so our function won't be invoked next time when scheduler ticks.

#### Cron Time expression

Cron expression made of five-string separated with a whitespace character.

```
 ┌───────────── minute (0 - 59)
 │ ┌───────────── hour (0 - 23)
 │ │ ┌───────────── day of the month (1 - 31)
 │ │ │ ┌───────────── month (1 - 12)
 │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday)
 │ │ │ │ │
 │ │ │ │ │
 * * * * *
```

> Crontab is a good tool for learning cron expressions. Checkout [CronTab](https://crontab.guru)

Here is some example of CRON expressions

| Expression  | Description                                                |
| :---------: | ---------------------------------------------------------- |
| `0 0 1 1 *` | Run once a year at midnight of 1 January                   |
| `0 0 1 * *` | Run once a month at midnight of the first day of the month |
| `0 0 * * 0` | Run once a week at midnight on Sunday morning              |
| `0 0 * * *` | Run once a day at midnight                                 |
| `0 * * * *` | Run once an hour at the beginning of the hour              |
| `* * * * *` | Run every minute                                           |

## Modules

### Database

The database module is an in-memory module that has public API for basic database operations like `FIND`, `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, `DROP`.

> Database module imported from `@internal/database`.

#### Getting Database Service

You can get database instance with `database()` function exported from `@internal/database` module.

```typescript
import {database, Database} from "@internal/database";

const db: Database = database();
// Type of db variable is  Database which exported from `@internal/database`
```

#### Getting the reference to a Collection

To make changes in a collection you need to get it reference first. You can get reference for a specific collection with `Database.collection()` function exported by your database instance. For more information check [mongoDB API](https://mongodb.github.io/node-mongodb-native/3.2/api/Collection.html)

```typescript
import {database, Database, Collection} from "@internal/database";

const db: Database = database();
const collection: Collection = db.collection("persistent_collection");
```

#### Operations

Here is some fundamental examples;

#### Insert

```typescript
import {database, Database, Collection} from "@internal/database";

export default async function() {
  const db: Database = database();
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

#### Find

```typescript
import {database, Database, Collection} from "@internal/database";

export default async function() {
  const db: Database = database();
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

#### Find One

```typescript
import {database, Database, Collection} from "@internal/database";

export default async function() {
  const db: Database = database();
  const books: Collection = db.collection("books");

  // Find the book named The Fall Of Leaves
  const book = await books.findOne({name: "The Fall Of Leaves"});
  console.dir(book);
  // Result will be { name: "The Fall Of Leaves", ... }
}
```

#### Update

```typescript
import {database, Database, Collection} from "@internal/database";

export default async function() {
  const db: Database = database();
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

## Debugging

An unhandled error will crash your function, when the error happens it will be logged to function logs.

### Executing

A function can be executed standalone for testing. If your function saved, a button will appear above your function's code.

The Run button executes your function with stub parameters. Stub parameters contains all common properties and functions from trigger.

When you run a function, you will see whether the execution succeeded or failed. Also you will see all the logs from execution above your function editor.

### Logging

A function code can have statements like `console.log`, `console.warn`, `console.dir`, when a code calls a console function the output of log will be written to function's log file.

You can see the logs in Logs tab in code edit page.