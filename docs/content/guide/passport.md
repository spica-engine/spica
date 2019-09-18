# Passport

Fundamentally, this module is used for authenticating and authorizing users (a.k.a. Indentities) on Spica Client and API.

## Identities

Identities are the main entities of your Spica. They are basically profiles with custom properties and login information. You can attach Policies (see below) and restrict their access to the Spica.

### Authentication With Spica

#### With API Call

Request URL:

> GET "{baseUrl}/passport/identify?password={password}&identifier={unique identifiier}"

If the credentials on request URL are correct, Spica returns the following response:

```json
{
  "issuer": "spica:passport",
  "token": "JWT {jwt token}",
  "schema": "JWT"
}
```

"`token`", created by your Spica instance, contains the following informations when decrypted on its payload:

```json
{
  "_id": "5d14f92e0617f15b1bc7d1b2", // Id string of the Identity
  "identifier": "spica",
  "policies": [...], // Array of the identitiy's Policy Ids
  "iat": 1562668335, // Creationg date of the token
  "exp": 1562841135, // Expiration date of the token
  "aud": "spica.io",
  "iss": "https://example.com" // Issuer domain of this JWT token. Mostly this will be the base url of your Spica instance
}
```

To authonticate every request to Spica API, attach the `token` to the `Authorization` header of your request. If you send request with empty `Authorization` header, Spica returns `401 Unauthorized` error.

### Define Identity Properties

Here in Spica, Identities are dynamic and changeable domains.

By default, an Identity object has these properties:

- Identifier: A unique, string type property which is used for logging in.
- Password: User-defined password for authentication.
- First and Last Name
- Email

If you want more properties, you can go the Settings page of Passport and add custom properties to your Identities.

Click the `+` icon on the Settings page. This will add a string type new property. You can customize the property by changing the `Title`, `Description` and even the `Type` of the property.

### List Identities

#### With Client

You can find the list of your Identities by clicking on the **Identities** from the side menu or by going to the `/passport/identity` URL. If you've just initialized the Spica, the list would be empty (or with a default `spica` identity depending on your setup configurations.).

Here, you can edit (`pen` button), create (`plus` button) and delete (`trash` button) your Identities.

#### With API Call

Request URL:

> GET "{baseUrl}/passport/identity?{params}"

Returns paginated `Identity` Array.

Params:  
All the params below are optional.

`"limit"`: Accepts number value. Limits the data count on listing array.

`"skip"`: Skips number of entries before listing.

Example response:

```json
{
  "meta": {"total": 1},
  "data": [
    {
      "_id": "5d137e13570fbca9e0e9ff42",
      "identifier": "spica",
      "password": "$2a$10$wibvsNsOxEVDj5Pl2EJnme.rhEV5vRIhOExhXvNCrCXIdRzr6F5TG",
      "policies": [
        "PassportFullAccess",
        "IdentityFullAccess",
        "StorageFullAccess",
        "PolicyFullAccess",
        "FunctionFullAccess",
        "SubscriptionFullAccess",
        "BucketFullAccess"
      ]
    }
  ]
}
```

### Create an Identity

#### With Client

To create a new Identity, click on the `+` button on Identities list page or go to `/passport/identity/add` url.

By filling the form on the page, you can create a new Identity. After the creation, you can access the Policies of the Identity. (See below)

#### With API Call

Request URL:

> POST "{baseUrl}/passport/identities?{params}"

Example request body:

## Policies

Policies are basically a set of rules which can be attached to your Identities to capsulate their behavior.

Policies made from `Statements`, the primitive rules.

First, let's check out the BucketFullAccess policy:

```json
{
  "$schema": "http://spica.internal/passport/policy",
  "_id": "BucketFullAccess",
  "name": "Bucket Full Access",
  "description": "Full access to bucket service.",
  "statement": [
    {
      "effect": "allow",
      "action": "bucket:*",
      "resource": "bucket/*",
      "service": "bucket"
    },
    {
      "effect": "allow",
      "action": "bucket:data:*",
      "resource": "bucket:data/*",
      "service": "bucket:data"
    }
  ]
}
```

This Policy lets the Identity to `index`, `show`, `update` and `delete` both Bucket and Bucket Data.

> Note: Asterisk (`*`) stands for every actions/resources under a scope.

### Managing Policies

### Creating Custom Policies

So, you want more control over your Identities? Well... you can. You can create your own Custom Policy by clicking on the `+` button on Policies page to create from scratch or clone a Policy and start to work where it left off by clicking the `copy` button on Policies page next to each policy.

Here you can enter your Policy's `Name` and `Description`.

Click on `Add Statement` button to add new statement. You'll see a new statement added to list in that page. You'll see a new form to fill. Let's dig in.

`Effect`: If you want to restrict a certain sets of rules, set the Effect as `Deny`, otherwise select `Allow`.

`Service`: Select the scope of the Statement.

`Actions`: After selecting the scope, this input will show up. You'll see a list of actions on the selected scope. Select one or more actions to add them to your Statement.

`Add Resource`: Optional. If you want to allow/deny actions on resource based, add resource and enter the \_id of the resource. You can add infinite number of resources to a Statement.

<!-- ### Understanding Statements

Statements are simple rules which allows/denies _actions_ such as `bucket:show`, `passport:identity:index` etc.

There are a few types of actions:

- `*:index`: Listing entries
- `*:show`: Getting single entry
- `*:update`: Updating or creating one entry
- `*:delete`: Deleting entry or entries -->
