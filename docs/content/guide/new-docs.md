# Getting Started
## Introduction
These documents will take you from 0 to hero and helps you to discover advanced features of Spica Development Engine.
### What is Spica?
Spica (a.k.a. Spica Development Engine) is an open-source package that gives virtually everything a backend developer needs. It gives a pre-built administration panel and a fully manageable no-code REST API. It can be used as a backend service, a database layer, or as a headless CMS for managing content. 

### Differences Between Spica API and Spica Client
Spica Development Engine divided into two parts because of principal differences.

Spica Client, is a user-friendly admin panel for those who like to manage their development process from a panel with a few clicks.

Spica API, on the other hand, is a fully controllable REST API. As Spica has an API-first approach, any features of the engine are controllable via HTTP calls. Also, it’s suitable to integrate with any frontend application to free the product owners from backend development costs.

## Installation


This tutorial helps you to install Spica to different environments. We provide a few ways to install, so you can choose which one of them suits you. 

### Using Spica Cli

Spica has a command-line interface for quick installation. To use it, you must have [Docker](https://www.docker.com/) and [NodeJs](https://nodejs.org) installed on your development environment.

Install CLI using the `npm` package manager:

```sh
$ npm install @spica/cli -g
```

To create and serve a new Spica instance on your computer, simply run:

```sh
$ spica server my-spica-instance
```

By default, Spica is served under 4500 port. It can be changed by using `--port` parameter

### Using Kubernetes

- Install kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl/
- After you'll need a kubernetes environment it can be either a local or a cloud kubernetes environment.
- For local Kubernetes, you can use minikube: https://kubernetes.io/docs/tasks/tools/install-minikube/
- For AWS, you can create an EKS cluster: https://docs.aws.amazon.com/eks/latest/userguide/create-cluster.html
- For GCP, you can create a GKE cluster: https://cloud.google.com/kubernetes-engine/docs/how-to/creating-a-cluster
- For Azure, you can create an AKS cluster: https://docs.microsoft.com/en-us/azure/aks/kubernetes-walkthrough
- Ensure kubectl connected to the kubernetes cluster by running `kubectl get nodes` command.
- The Cluster must have Nginx ingress controller enabled. You can follow https://kubernetes.github.io/ingress-nginx/deploy/ to install Nginx ingress on the cluster.
- Just apply `kubectl apply -f https://raw.githubusercontent.com/spica-engine/spica/master/deployment.yaml`

### Using Docker

- Install docker on your environment and ensure that you have installed docker correctly by running "`docker ps`" command.
- For macOS: https://docs.docker.com/docker-for-mac/
- For Windows: https://docs.docker.com/docker-for-windows/install/
- For other platforms checkout docker webpage: https://docs.docker.com
- Create a docker network for communication between Spica services.

```sh
docker network create spica
```

- Setup **Three Replica Set** MongoDB

```sh
docker run --name mongo-1 --network spica -d mongo:4.2 --replSet "rs0" --bind_ip_all
docker run --name mongo-2 --network spica -d mongo:4.2 --replSet "rs0" --bind_ip_all
docker run --name mongo-3 --network spica -d mongo:4.2 --replSet "rs0" --bind_ip_all
```

- Ensure that all three of replica set members are up and running.

```sh
# Run the command below
docker ps --filter=Name=mongo
# If you get an output that similar to this, that means you are good to go.
CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS               NAMES
1c903c67f70e        mongo:4.2           "docker-entrypoint.s…"   4 seconds ago       Up 4 seconds        27017/tcp           mongo-2
0b51ab4e7909        mongo:4.2           "docker-entrypoint.s…"   4 seconds ago       Up 4 seconds        27017/tcp           mongo-1
2f315729758c        mongo:4.2           "docker-entrypoint.s…"   4 seconds ago       Up 4 seconds        27017/tcp           mongo-3
```

- Setup replication between members so they can elect a primary.

```sh
docker exec -it mongo-1 mongo admin --eval 'rs.initiate({
 _id: "rs0",
 members: [
 { _id: 0, host : "mongo-1" },
 { _id: 1, host : "mongo-2" },
 { _id: 2, host : "mongo-3", priority : 0, slaveDelay: 5, tags: { slaveDelay: "true" } }
 ]
})'
```

- Additionally, if you want to keep your files on every container update, you need to mount a docker volume to your **`api`** container and change `PERSISTENT_PATH` environment variable. For more info checkout: https://docs.docker.com/storage/volumes/
- Setup spica

```sh
# Start spica (API) on port 4400
docker run
    --name api
    --network spica
    -p 4400:80
    -e PORT=80
    -e DATABASE_URI="mongodb://mongo-1,mongo-2,mongo-3"
    -e REPLICA_SET="rs0"
    -e DATABASE_NAME=spica
    # Password of the default spica user
    -e DEFAULT_PASSWORD=spica
    # API will use this secret to sign login tokens.
    -e SECRET="$2b$10$shOzfYpDCy.RMgsVlwdQeONKGGzaBTfTQAjmXQNpMp4aKlLXrfZ/C"
    # This secret is important to keep your Spica secure.
    # Changing this secret to something different is strongly advised.
    -e PUBLIC_HOST=http://localhost:4400 # Publicly accesible url of the API.
    -e PERSISTENT_PATH=/tmp # The path that the storage files will be kept at.
    -d spicaengine/api

# Start spica (Client) on port 4500
docker run
    --name spica
    --network spica
    -e BASE_URL="/"
    -e API_URL="http://localhost:4400" # Publicly accesible url of the API for connection. In this case it is http://localhost:4400
    -p 4500:80
    -d spicaengine/spica
```

- Ensure you have setup everything correctly

```sh
# Run
docker ps
# And you will see an output like this
CONTAINER ID        IMAGE                       COMMAND                  CREATED             STATUS              PORTS                    NAMES
9c30befa326b        spicaengine/api             "/app/stacks/api_ima…"   4 seconds ago       Up 4 seconds        0.0.0.0:4300->4300/tcp   api
a973f9598ba2        spicaengine/spica           "nginx -g 'daemon of…"   4 seconds ago       Up 4 seconds        0.0.0.0:4500->80/tcp     spica
2f315729758c        mongo:4.2                   "docker-entrypoint.s…"   4 seconds ago       Up 4 seconds        27017/tcp                mongo-3
1c903c67f70e        mongo:4.2                   "docker-entrypoint.s…"   4 seconds ago       Up 4 seconds        27017/tcp                mongo-2
0b51ab4e7909        mongo:4.2                   "docker-entrypoint.s…"   4 seconds ago       Up 4 seconds        27017/tcp                mongo-1
# the first container (api) is our api service, core of our spica instance.
# the second container (spica) is our client which communicates with api container.
# the other ones (mongo-1, mongo-2, mongo-3) is our three-member replica set mongodb containers.
```

- Open your browser and navigate to http://localhost:4500
- The default `identifier` is `spica` and the password is `spica`.

### Contributing

## Quick Start Guide
### 1. Install Spica and Login
Install CLI using the `npm` package manager:

```sh
$ npm install @spica/cli -g
```

To create and serve a new Spica instance on your computer, simply run:

```sh
$ spica server my-spica-instance
```

By default, Spica is served under 4500 port. It can be changed by using `--port` parameter

After the installation, navigate to [http://localhost:4500/spica](http://localhost:4500/spica)

Fill the login form with the following credentials:
**Username**: *spica*
**Password**: *spica*

> Note: After the installation, you may want to change the credentials before going live. 

### 2. Create a User Bucket Schema

Navigate to **Developer** -> **Bucket** (or [http://localhost:4500/spica/buckets](http://localhost:4500/spica)) in the left-hand menu. 

- Click the "+" icon on the top right toolbar.
- Enter "Users" to "name" field and fill the "Description" field however you want
- Delete all "Properties" by clicking the "trash" icon on each property.
- Add the following properties: 
	- Add a "name" field and set its type to "String", 
	- Add a "email" field and set its type to "String", 
	- Add a "birthday" field and set its type to "Date"
- Click the "cog" icon on "name" field and check the following options: 
	- Primary field (which marks this field as primary)
	- Visible on list (which makes this field visible on list view)
	- Require (which marks this field a mandatory field to create an entry)
- Click the "cog" icon on "email" field and check the following options:
	- Visible on list (which makes this field visible on list view)
	- Require (which marks this field a mandatory field to create an entry)
- Click the "cog" icon on "birthday" field and check the following options:
	- Visible on list (which makes this field visible on list view)
- Move on to the "View" section of the form and arrange your entry form view by drag and drop
- Click **Save** and wait for the page refresh.

### 3. Add entry to "Users" Bucket
Navigate to **Content** -> **Users**, in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Type "John Doe" in the **Name** field.
- Type "john@doe.com" in the **Email** field.
- Click on **Birthday** field and select a date.
- Click **Save**

You will see a user named John Doe listed in the entries.

### 4. Get the User Bucket entries via API
Our newly created User Bucket is ready with an entry. The list of **Users** is accessible at http://localhost:4500/api/bucket/{bucket_id}

> Note: The bucket id of the newly created **Users** bucket can be found by clicking on the "i" icon on the list view.

**Congratulations**
You have created your first Bucket and your first bucket entry on Spica and have accessed it both via Spica Client and the API.   

<!-- ## Glossary
Explain the common terms of Spica eg. buckets, bucket data, functions, passport, etc.

### Bucket
A bucket is a data collection. They include all the metadata such as data structure, validations, customization.

### Passport
Passport is the user management module of Spica. It contains Identities, Policies, Strategies and API Keys. (see below for the detailed explanation)

#### Identities

#### Policies
A Policy is a collection of statements. A statement is an access level for an action.

#### Strategies
A strategy helps you to enable a single-sign on authentication to Spica. Once you create a strategy, your users will be able to login via a 3rd party service.

#### API Keys
A API key enables machine to machine communication. -->
 
# Guides
## Passport

### Authenticating and Authorizing on Spica

Out of the box, Spica supports two different authentication stretagies. This document will explain the fundemantals of those stretegies. 

#### Identity



#### API Key

Instead of Identity, API key is allows the machine to machine communication. The token, it provides doesn't have an expiration date so it can be used as long as it's intentionally deleted from Spica.

To create an API Key, navigate to **System** -> **API Keys** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **name** and **description** field.
- Press **Save** 

#### SSO Integration



## Buckets as Data Layer
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

Remember: Spica stores the property names as JSON keys. For this, special characters, spaces and such are forbidden.
You'll see the name of the newly created property is added to the list. Click on it to edit the property and its options.

#### View
You can customize the Bucket Data Create/Edit page from this section. Left, Right and Bottom represent the divisions of the layout on Bucket Data Create/Edit page.

You can drag and drop the Bucket Properties to the desired division.

> Remember: You can't save a Bucket if you left one or more Properties on No Position list.

### Creating a new Bucket Entry

// TODO: explain

### Translation and Localization

**Bucket entries**, in Spica are translatable and localizable out-of-the-box.

To setup the suppoted language of the Spica instance, navigate to **Developer** -> **Bucket** and find the Bucket Settings button represented by a **cog** icon on the top right toolbar. Click on it and you will see the available languages of the Spica instance. To add a new one, select the language from the Language Selection menu and press **"+ Add new language"** button. And click **Save**.

To add translation and localization feature to a Bucket:

- Open the **Bucket schema edit page**.
- Find the field you would like to make translatable
- Click on the **cog** icon to open field options
- Check **Translate** option and save the Bucket

> Warning: Once you add localization, you can't revert that change.

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

Spica, optionally can track down the change history of bucket entries. To enable the history feature for the spesific bucket, simple go to the Bucket Schema edit page and toggle on the History option.

Once it is toggled on, the changes made on the bucket's entries will be stored.

Navigate to one of the Bucket's entries, look for the **History** button on the top left toolbar. Clicking on it will reveal the last 10 versions of the entry. Clicking the version numbers will revert the data to that version.

## Storage

## Function

Functions are an event-driven execution context for your spica. Simply, you can attach an event to your function from other modules and services. Your function will be triggered _when the event occurs_.

Within a function, you can do almost everything you want to do.

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

#### Event Data

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


#### Database

The database module is an in-memory module that has public API for basic database operations like `FIND`, `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, `DROP`.

> Database module imported from `@internal/database`.

##### Getting Database Service

You can get database instance with `database()` function exported from `@internal/database` module.

```typescript
import {database, Database} from "@internal/database";

const db: Database = database();
// Type of db variable is  Database which exported from `@internal/database`
```

##### Getting the reference to a Collection

To make changes in a collection you need to get it reference first. You can get reference for a specific collection with `Database.collection()` function exported by your database instance. For more information check [mongoDB API](https://mongodb.github.io/node-mongodb-native/3.2/api/Collection.html)

```typescript
import {database, Database, Collection} from "@internal/database";

const db: Database = database();
const collection: Collection = db.collection("persistent_collection");
```

##### Operations

Here is some fundamental examples;

###### Insert

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

###### Find

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

###### Find One

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

###### Update

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


### Triggers

#### Http

You can invoke your function with an HTTP request using the `POST`, `PUT`, `GET`, `DELETE`, `PATCH`, `HEAD` and `OPTIONS` HTTP methods along with a path like `/books` or `/books/:id`.

To able to create a function with HTTP trigger, you need two information;
Path and Method, the method must be one of the specified HTTP methods above also you need a path like above.

> HINT: When you save your function the endpoint will be provisioned automatically.

> **IMPORTANT:** The path and method are not validated for any collision with another function's path and method. So make sure that the path and method not used by other functions otherwise you function may override other function's path.

##### Method

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

##### Path

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

##### Request Body

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

#### Database

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

#### Schedule

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

##### Cron Time expression

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

#### Bucket
//TODO: Explain

#### System
//TODO: Explain

#### Firehose
//TODO: Explain

### Debugging

An unhandled error will crash your function, when the error happens it will be logged to function logs.

#### Logging

A function code can have statements like `console.log`, `console.warn`, `console.dir`, when a code calls a console function the output of log will be written to function's log file.

You can see the logs in Logs tab in code edit page.


## Webhook
### Webhook Logs


## User Activity Logs
//TODO: Explain the concept

To list all Spica users' activity, simply navigate to **Acitivity** -> **User Activities**

## Dashboard
TBC

