# Function

## Table of contents

## Overview

### What are functions?

Functions is an event-driven execution context for your spica. Simply, you can attach an event to your function from other modules and services. Your function will be triggered _when the event occurs_.

Within a function, you can do nearly everything that you do every day in node runtime.

> IMPORTANT: Currently the functions run under spica and not isolated from it. Which means your function may have state from the previous execution.

### Use cases

On-demand nature of functions makes it a perfect candidate for event-driven execution.

See the following table for additional common `functions` use cases:

| Use case        | Description                                                                                                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data processing | Listen and respond to storage events such as when a file is created, changed, or removed. Process images, perform video transcoding, validate and transform data, and invoke any service on the internet from your functions. |
| Webhooks        | Via a simple HTTP trigger, respond to events originating from 3rd party systems like GitHub, Slack, Stripe, or from anywhere that can send HTTP requests.                                                                     |
| APIs            | Compose applications from lightweight, loosely coupled bits of logic that are quick to build and that scale instantly. Your functions can be event-driven or invoked directly over HTTP/S.                                    |

### Events and triggers

Events are things that happen in your spica. These might be things like changes to data in a database, files added to a storage system or an HTTP request being received. If you attach a trigger to your function, your function will be executed by the time of the event happens.

Currently, Function supports following triggers:

- [HTTP](#http)
- [Database](#database)
- [Schedule](#schedule)

### Event Data

When an event triggers the execution of your function, data associated with the event is passed via the function's parameters. The type of event determines the parameters passed to your function.

For example your function that has http trigger will look like this:

```typescript
export default function(request: triggers.http.Request, response: triggers.http.Response) {
  // Send the response
  response.send({
    message: "Spica is awesome!"
  });
}
```

See [triggers](#triggers) section for parameter types by trigger.

### Modules

Modules are things provided by spica to your function in execution time. Modules may look like a usual module that appears in the node_modules directory in a typical node project but the fact is
they are not a usual module nor they appear in your function's node_modules directory.

> Also they are not published to a registry like npmjs.com, so they can not be installed/used outside of a spica.

Currently, there are few modules helps you to get information about your spica.

| Module               | Description                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@internal/database` | This module has a public API for making database operations like **update**, **delete**, **create**, **get** |

## Triggers

### Http

#### Overview

You can invoke your function with an HTTP request using the `POST`, `PUT`, `GET`, `DELETE`, `PATCH`, `HEAD` and `OPTIONS` http methods along with a path like `/books` or `/books/:id`.

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

The path will be used when provisioning the trigger URL for your function. When you save your function the trigger URL will be provisioned under **`{API_URL}/fn-execute`** URL.

For example;

**`/books`** will be served at **`/fn-execute/books`** path

Also, Path can have a _wildcard_ or a _parameter_ segment.

Example: **`/books/:bookId`** can match with these paths above:

- `/books/1`
- `/books/mybookid`
- `/books/getting started with spica`

Despite the **`/books/:bookId`** path **do not** match with these paths:

- `/books/1/author`
- `/books/1/update`

Because the path has only one parameter that can only match with a sub-segment.

##### Getting parameters in function code

The parameters in the trigger path will be passed through the `request` parameter of your function. It's the first parameter of your function.

Example:

For **`/books/:bookId`** path, the **bookId** parameter can be taken from **`request.params`**

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

The payload can be everything in practice despite they need to be parsed to be used by a function.

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

### Schedule


## Modules

### Database

## Errors