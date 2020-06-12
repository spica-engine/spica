# Getting Started

## Introduction

These documents will take you from 0 to hero and helps you to discover advanced features of Spica Development Engine.

### What is Spica?

Spica (a.k.a. Spica Development Engine) is an open-source package that gives virtually everything a backend developer needs. It gives a pre-built administration panel and a fully manageable no-code REST API. It can be used as a backend service, a database layer, or as a headless CMS for managing content.

### Differences Between Spica API and Spica Client

Spica Development Engine divided into two parts because of principal differences.

Spica Client, is a user-friendly admin panel for those who like to manage their development process from a panel with a few clicks.

Spica API, on the other hand, is a fully controllable REST API.

As Spica has an API-first approach, any features of the engine are controllable via HTTP calls. Also, it’s suitable to integrate with any frontend application to free the product owners from backend development costs.

## Installation

This tutorial helps you to install Spica to different environments. We provide a few ways to install, so you can choose which one of them suits you.

### Using Spica CLI

Spica has a command-line interface for quick installation. To use it, you must have [Docker](https://www.docker.com/) and [NodeJs](https://nodejs.org) installed on your development environment.

Install CLI using the `npm` package manager:

```sh
$ npm install @spica/cli -g
```

To create and serve a new Spica instance on your computer, simply run:

```sh
$ spica serve my-spica-instance
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

## Contributing

We would love for you to contribute to Spica and help make it even better than it is
today! As a contributor, here are the guidelines we would like you to follow:

- [Code of Conduct](#coc)
- [Question or Problem?](#question)
- [Issues and Bugs](#issue)
- [Feature Requests](#feature)
- [Submission Guidelines](#submit)
- [Coding Rules](#rules)
- [Commit Message Guidelines](#commit)
- [Signing the CLA](#cla)

### <a name="coc"></a> Code of Conduct

Help us keep Spica open and inclusive. Please read and follow our [Code of Conduct][coc].

### <a name="question"></a> Got a Question or Problem?

Do not open issues for general support questions as we want to keep GitHub issues for bug reports and feature requests. You've got much better chances of getting your question answered on [Stack Overflow](https://stackoverflow.com/questions/tagged/spica) where the questions should be tagged with tag `spica`.

Stack Overflow is a much better place to ask questions since:

- there are thousands of people willing to help on Stack Overflow
- questions and answers stay available for public viewing so your question / answer might help someone else
- Stack Overflow's voting system assures that the best answers are prominently visible.

To save your and our time, we will systematically close all issues that are requests for general support and redirect people to Stack Overflow.

If you would like to chat about the question in real-time, you can reach out via [our slack channel][slack].

### <a name="issue"></a> Found a Bug?

If you find a bug in the source code, you can help us by
[submitting an issue](#submit-issue) to our [GitHub Repository][github]. Even better, you can
[submit a Pull Request](#submit-pr) with a fix.

### <a name="feature"></a> Missing a Feature?

You can _request_ a new feature by [submitting an issue](#submit-issue) to our GitHub
Repository. If you would like to _implement_ a new feature, please submit an issue with
a proposal for your work first, to be sure that we can use it.
Please consider what kind of change it is:

- For a **Major Feature**, first open an issue and outline your proposal so that it can be
  discussed. This will also allow us to better coordinate our efforts, prevent duplication of work,
  and help you to craft the change so that it is successfully accepted into the project.
- **Small Features** can be crafted and directly [submitted as a Pull Request](#submit-pr).

### <a name="submit"></a> Submission Guidelines

#### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker, maybe an issue for your problem already exists and the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. In order to reproduce bugs, we will systematically ask you to provide a minimal reproduction. Having a minimal reproducible scenario gives us a wealth of important information without going back & forth to you with additional questions.

A minimal reproduction allows us to quickly confirm a bug (or point out a coding problem) as well as confirm that we are fixing the right problem.

We will be insisting on a minimal reproduction scenario in order to save maintainers time and ultimately be able to fix more bugs. Interestingly, from our experience users often find coding problems themselves while preparing a minimal reproduction. We understand that sometimes it might be hard to extract essential bits of code from a larger code-base but we really need to isolate the problem before we can fix it.

Unfortunately, we are not able to investigate / fix bugs without a minimal reproduction, so if we don't hear back from you we are going to close an issue that doesn't have enough info to be reproduced.

You can file new issues by selecting from our [new issue templates](https://github.com/spica-engine/spica/issues/new/choose) and filling out the issue template.

#### <a name="submit-pr"></a> Submitting a Pull Request (PR)

Before you submit your Pull Request (PR) consider the following guidelines:

1. Search [GitHub](https://github.com/spica/spica-engine/pulls) for an open or closed PR
   that relates to your submission. You don't want to duplicate effort.
1. Be sure that an issue describes the problem you're fixing, or documents the design for the feature you'd like to add.
   Discussing the design up front helps to ensure that we're ready to accept your work.
1. Please read our [Contributor License Agreement (CLA)](#cla) before sending PRs.
1. Fork the spica-engine/spica repo.
1. Make your changes in a new git branch:

   ```shell
   git checkout -b my-fix-branch master
   ```

1. Create your patch, **including appropriate test cases**.
1. Follow our [Coding Rules](#rules).
1. Run the full Spica test suite and ensure that all tests pass.
1. Commit your changes using a descriptive commit message that follows our
   [commit message conventions](#commit). Adherence to these conventions
   is necessary because release notes are automatically generated from these messages.

   ```shell
   git commit -a
   ```

   Note: the optional commit `-a` command line option will automatically "add" and "rm" edited files.

1. Push your branch to GitHub:

   ```shell
   git push origin my-fix-branch
   ```

1. In GitHub, send a pull request to `spica:master`.

- If we suggest changes then:

  - Make the required updates.
  - Re-run the Spica test suites to ensure tests are still passing.
  - Rebase your branch and force push to your GitHub repository (this will update your Pull Request):

    ```shell
    git rebase master -i
    git push -f
    ```

That's it! Thank you for your contribution!

##### After your pull request is merged

After your pull request is merged, you can safely delete your branch and pull the changes
from the main (upstream) repository:

- Delete the remote branch on GitHub either through the GitHub web UI or your local shell as follows:

  ```shell
  git push origin --delete my-fix-branch
  ```

- Check out the master branch:

  ```shell
  git checkout master -f
  ```

- Delete the local branch:

  ```shell
  git branch -D my-fix-branch
  ```

- Update your master with the latest upstream version:

  ```shell
  git pull --ff upstream master
  ```

### <a name="rules"></a> Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

- All features or bug fixes **must be tested** by one or more specs (unit-tests).
- All public API methods **must be documented**. (Details TBC).

### <a name="commit"></a> Commit Message Guidelines

We have very precise rules over how our git commit messages can be formatted. This leads to **more
readable messages** that are easy to follow when looking through the **project history**. But also,
we use the git commit messages to **generate the Spica change log**.

#### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special
format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

Any line of the commit message cannot be longer 100 characters! This allows the message to be easier
to read on GitHub as well as in various git tools.

The footer should contain a [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages/) if any.

Samples: (even more [samples](https://github.com/spica-engine/spica/commits/master))

```
docs(changelog): update changelog to beta.5
```

```
fix(release): need to depend on latest rxjs and zone.js

The version in our package.json gets copied to the one we publish, and users need the latest of these.
```

#### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

#### Type

Must be one of the following:

- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts (example scopes: Circle)
- **docs**: Documentation only changes
- **feat**: A new feature
- **fix**: A bug fix
- **perf**: A code change that improves performance
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **test**: Adding missing tests or correcting existing tests

#### Scope

The scope should be the name of the npm package affected (as perceived by the person reading the changelog generated from commit messages.

The following is the list of supported scopes:

- **core**
- **common**
- **material**
- **bucket**
- **function**
- **passport**
- **preference**
- **storage**
- **composer**

There are currently a few exceptions to the "use package name" rule:

- **changelog**: used for updating the release notes in CHANGELOG.md
- **docs-infra**: used for site (spicaengine.com) related changes within the /docs/site directory of the
  repo
- none/empty string: useful for `style`, `test` and `refactor` changes that are done across all
  packages (e.g. `style: add missing semicolons`) and for docs changes that are not related to a
  specific package (e.g. `docs: fix typo in tutorial`).

#### Subject

The subject contains a succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize the first letter
- no dot (.) at the end

#### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with previous behavior.

#### Footer

The footer should contain any information about **Breaking Changes** and is also the place to
reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

A detailed explanation can be found in this [document][commit-message-format].

### <a name="cla"></a> Signing the CLA

Please read our Contributor License Agreement (CLA) before sending pull requests. For any code
changes to be accepted, the CLA must be read and accepted.

[coc]: https://github.com/spica-engine/spica/blob/master/CODE_OF_CONDUCT.md
[commit-message-format]: https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit#
[github]: https://github.com/spica-engine/spica
[individual-cla]: https://github.com/spica-engine/spica/blob/master/CLA.md
[stackoverflow]: http://stackoverflow.com/questions/tagged/spica

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
**Username**: _spica_
**Password**: _spica_

> Note: After the installation, you may want to change the credentials before going live.

### 2. Create a User Bucket Schema

Navigate to **Developer** -> **Bucket** (or [http://localhost:4500/spica/buckets](http://localhost:4500/spica)) in the left-hand menu.

- Click the "+" icon on the top right toolbar.
- Enter "Users" to "name" field and fill the "Description" field however you want
- Delete all "Properties" by clicking the "trash" icon on each property.
- Add the following properties: - Add a "name" field and set its type to "String", - Add a "email" field and set its type to "String", - Add a "birthday" field and set its type to "Date"
- Click the "cog" icon on "name" field and check the following options: - Primary field (which marks this field as primary) - Visible on list (which makes this field visible on list view) - Require (which marks this field a mandatory field to create an entry)
- Click the "cog" icon on "email" field and check the following options: - Visible on list (which makes this field visible on list view) - Require (which marks this field a mandatory field to create an entry)
- Click the "cog" icon on "birthday" field and check the following options: - Visible on list (which makes this field visible on list view)
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

Fundamentally, this module is used for authentication and authorization on Spica Client and API.

### Authentication

Out of the box, Spica supports two different authentication stretagies. This document will explain the fundemantals of those stretegies.

#### Identity

Fundemantally, Identities are the users of a Spica instance. It contains **identified** and **password** informations for login.

> Right after the installation, Spica creates a default identitiy to get you started. We suggest you to change at least its password before going live.

To create an Identitiy, navigate to **System** -> **Identities** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **Identifier** and **Password** field.
- Press **Save**

##### Adding Additional Properties

If you want to store additional informations on **Identities**, you can create custom fields. To create a custom field on Identities, navigate to **System** -> **Settings** in the left-hand menu.

#### API Key

Instead of Identity, API key is allows the machine to machine communication. The token, it provides doesn't have an expiration date so it can be used as long as it's intentionally deleted from Spica.

To create an API Key, navigate to **System** -> **API Keys** in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Fill the **name** and **description** field.
- Press **Save**

Once the saving completed, you can use the **API Key** value on your API calls on header section.

> For more informations about how to use API Key, please refer the API Documentations.

<!-- #### SSO Integration -->

### Policies

Policies are basically a set of rules which can be attached to your **Identities** and **API Keys** to encapsulate their behavior.

#### Using the Policies

Spica cames with various different built-in Policies to meet your needs on encapsulation, so you don't have to create each of them individually.

To attach Policies, enter either **Identity Edit Page** or **API Key Edit Page**. At the bottom, you will see `Owned Policies` section.

To attach the policy, click the `link` buttom. To detach click on `unlink` button.

#### Creating a Custom Policy

It is possible to create your own Custom Policy by clicking on the `+` button on Policies page to create from scratch or clone a Policy and start to work where it left off by clicking the `copy` button on Policies page next to each policy.

Here you can enter your Policy's `Name` and `Description`.

Click on `Add Statement` button to add new statement. You'll see a new statement added to list in that page. You'll see a new form to fill. Let's dig in.

`Effect`: If you want to restrict a certain sets of rules, set the Effect as `Deny`, otherwise select `Allow`.

`Service`: Select the scope of the Statement.

`Actions`: After selecting the scope, this input will show up. You'll see a list of actions on the selected scope. Select one or more actions to add them to your Statement.

`Add Resource`: Optional. If you want to allow/deny actions on resource based, add resource and enter the \_id of the resource. You can add infinite number of resources to a Statement.

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

##### Property Options

`Primary field`: Primary field is mainly used for building relations between data.

`Visible on list`: Effects the list view on Spica Client. Defines wether the field will be shown on list view by default.

`Translate`: Marks the field as translatable. For more information please check [Translation and Localization](###translation-and-localization) section.

`Read-only`: This one is used to prevent value changes on entry create and update.

`Required`: Makes the field required on entry create and update.

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

This module is essentially a file manager on your Spica instance. You can store, list and delete your files via this module.

### Online Image Editor

To edit image typed storage item, click the `three dots` next to the item to open the context menu. Clicking the `edit` button will takes you to the Image Editing page.

On that page you crop the image, scale by percentage and rotate the image as you wish. Click on the `tick` icon to save the image after editing.

### Google Cloud Storage Integaration

Spica supports Google Cloud Storage out-of-the-box.

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
- [Bucket](#bucket)
- [System](#system)
- [Firehose](#firehose)

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

In order to use these modules in a **function**, they need to be added to **dependencies** section on **Function Edit page**.

| Module                   | Description                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `@spica-devkit/database` | This module has a public API for making database operations like **update**, **delete**, **create**, **get** |

#### Database

The database module is an in-memory module that has public API for basic database operations like `FIND`, `INSERT`, `UPDATE`, `REPLACE`, `DELETE`, `DROP`.

> Database module imported from `@spica-devkit/database`.

##### Getting Database Service

You can get database instance with `database()` function exported from `@spica-devkit/database` module.

```typescript
import {database, Database} from "@spica-devkit/database";

const db: Database = database();
// Type of db variable is  Database which exported from `@spica-devkit/database`
```

##### Getting the reference to a Collection

To make changes in a collection you need to get it reference first. You can get reference for a specific collection with `Database.collection()` function exported by your database instance. For more information check [mongoDB API](https://mongodb.github.io/node-mongodb-native/3.2/api/Collection.html)

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

const db: Database = database();
const collection: Collection = db.collection("persistent_collection");
```

##### Operations

Here is some fundamental examples;

###### Insert

```typescript
import {database, Database, Collection} from "@spica-devkit/database";

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
import {database, Database, Collection} from "@spica-devkit/database";

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
import {database, Database, Collection} from "@spica-devkit/database";

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
import {database, Database, Collection} from "@spica-devkit/database";

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

Bucket trigger invokes your function before the selected operation for a specific bucket. For bucket trigger, all `INSERT`, `UPDATE`, `INDEX`, `GET`, `DELETE`, `STREAM` operations are available.

All required fields for a bucket trigger are listed below;

- **Bucket:** Bucket ID of the desired bucket
- **Event Type:** Type of the event that happens in the collection.

> IMPORTANT: `STREAM` operations are used for real-time bucket connections. If your client uses real-time data transfer, you can use `STREAM` operation to trigger a function before each websocket data transfer from client application to your Spica instance.

INSERT request object:

```typescript
 ActionParameters {
  bucket: '5ec7b22ea33b5f160008933f',
  document: undefined,
  type: 'INSERT',
  headers: {
    authorization: 'APIKEY 11bub47ka8al97p',
    'content-type': 'application/json',
    'user-agent': 'PostmanRuntime/7.24.1',
    accept: '*/*',
    'cache-control': 'no-cache',
    'postman-token': '546e8120-9ca2-4982-b0e2-ecb91ae64367',
    host: 'localhost:4300',
    'accept-encoding': 'gzip, deflate, br',
    connection: 'keep-alive',
    'content-length': '5',
    'strategy-type': 'APIKEY'
  }
}
```

INSERT example:

```typescript
export default function(req) {
  if (req.headers.authorization == "FORBIDDEN_APIKEY") return false;
  else true;
}
```

UPDATE request object:

```typescript
ActionParameters {
  bucket: '5ec7b22ea33b5f160008933f',
  document: '5ec7b39aa33b5f160008934f',
  type: 'UPDATE',
  headers: {
    authorization: 'APIKEY 11bub47ka8al97p',
    'content-type': 'application/json',
    'user-agent': 'PostmanRuntime/7.24.1',
    accept: '*/*',
    'cache-control': 'no-cache',
    'postman-token': 'b48d6195-c9ae-4cc5-bf63-25ee2728e1d6',
    host: 'localhost:4300',
    'accept-encoding': 'gzip, deflate, br',
    connection: 'keep-alive',
    'content-length': '5',
    'strategy-type': 'APIKEY'
  }
}
```

UPDATE example:

```typescript
export default function(req) {
  if (req.document == "MY_SECRET_DOCUMENT") return false;
  else true;
}
```

GET request object:

```typescript
 ActionParameters {
  bucket: '5ec7b22ea33b5f160008933f',
  document: '5ec7b39aa33b5f160008934f',
  type: 'GET',
  headers: {
    authorization: 'APIKEY 11bub47ka8al97p',
    'content-type': 'application/json',
    'user-agent': 'PostmanRuntime/7.24.1',
    accept: '*/*',
    'cache-control': 'no-cache',
    'postman-token': '296f149c-1d77-4ba7-83b9-b84cffca41a4',
    host: 'localhost:4300',
    'accept-encoding': 'gzip, deflate, br',
    connection: 'keep-alive',
    'content-length': '5',
    'strategy-type': 'APIKEY'
  }
}
```

GET example:

```typescript
export default function(req) {
  const aggregation = [];
  if (req.headers.authorization == "MY_SECRET_TOKEN") {
    aggregation.push({$unset: ["password"]});
    //which means hide password field
  }
  return aggregation;
}
```

INDEX request object:

```typescript
 ActionParameters {
  bucket: '5ec7b22ea33b5f160008933f',
  document: undefined,
  type: 'INDEX',
  headers: {
    authorization: 'APIKEY 11bub47ka8al97p',
    'content-type': 'application/json',
    'user-agent': 'PostmanRuntime/7.24.1',
    accept: '*/*',
    'cache-control': 'no-cache',
    'postman-token': '83bba0bf-85d4-43ef-ae39-9f0300c92115',
    host: 'localhost:4300',
    'accept-encoding': 'gzip, deflate, br',
    connection: 'keep-alive',
    'content-length': '5',
    'strategy-type': 'APIKEY'
  }
}
```

INDEX example:

```typescript
export default function(request) {
  return [{$match: {age: {$lt: 20}}}];
}
```

#### System

System trigger includes system related event data and invokes a function whenever the choosen event happens. System trigger is the best choice for using dashboard module, configurating the project or setting up a starting state of you data. `READY` event will be triggered when a server restarts and ready to use. For the current version system trigger is listening only `READY` event.

```typescript
export default function() {
  console.log("Spica is ready");
}
```

#### Firehose

You can invoke a function in real-time from yout client application. Firehose trigger does not interact with bucket or database. Instead, it listens the real-time port so you can interact with the function directly from your client application. Firehose trigger can listen a specific event, connection start or connection closed events.

As an example, if you are making a game and run a real-time serverside logic which will communicate with the client application such as real-time point calculating, you can calculate score and return via websocket using firehose trigger.

```typescript
export default function(message, {socket, pool}) {
  console.log(message.name); // Outputs: connection
  console.log(message.data.url); // Outputs: /firehose

  const isAuthorized = false; // Decide if the user has been authorized.

  if (isAuthorized) {
    // Write back to incoming socket that authorization has been successful.
    socket.send("authorization", {state: true});

    // Announce the new connection to firehose pool (aka all connected sockets)
    pool.send("connection", {
      id: socket.id,
      ip_address: socket.remoteAddress
    });
  } else {
    socket.send("authorization", {state: false, error: "Authorization has failed."});
    socket.close();
  }
}
```

### Environment Variables

You can define custom environment variables for your functions. If your team is a multi-disciplined team, you may need some roles to change just function variables. For this situtation, you can define environment variables which will be passed to function as a parameter. You can see an example of how environment variable works below:

// TODO: Example Code

### 3rd Party Dependencies

This feature allows you to import 3rd party dependiencies to your functions. Spica downloads 3rd party libraries from NPM (node package manager). To use a 3rd party library, you just need to import the library into your function after you download to you Spica environment. 

> IMPORTANT: Each functions are decoupled from the Spica environment. So, if you will use the same library for different functions, you need to download the library for each function.

### Debugging

An unhandled error will crash your function, when the error happens it will be logged to function logs.

#### Logging

A function code can have statements like `console.log`, `console.warn`, `console.dir`, when a code calls a console function the output of log will be written to function's log file.

You can see the logs in Logs tab in code edit page.

## Webhook

Webhook module is designed for the automation of flow. It listens events in Spica environment and send a hook call when a specific event happens. You can set a post-action trigger which will be one of the following collection triggers; `INSERT`, `UPDATE`, `DELETE`, `REPLACE`

As an example, to automate your marketing campaign you can use 3rd party email services with using webhook module. Once you attach an `INSERT` hook to registration bucket, the system will send a webhook call whenever you insert a data to your registration bucket via API or control panel.

To set up a webhook, you have to define a name, body and a trigger.

- Webhook name can be any string value
- Webhook body should be in JSON format. To take a value from your bucket, you can use three curly braces. So as an example you can set your webhook body like `{“text”: “{{{document.title}}}“}`
- Webhook trigger can be any of `INSERT`, `UPDATE`, `DELETE`, `REPLACE` values.

> IMPORTANT: Each webhook trigger works after the action happens. So, if you use `DELETE` trigger for a webhook, you can not reach `document` fields because `document` will be removed when the Spica sends webhook call.

Example webhook body:

```
{
  "title": “{{{document.title}}}“,
  "description": “Lorem ipsum“,
  "avatar": “{{{document.thumbnail}}}“
}
```

### Webhook Logs

You can see all webhook acitivites in `Webhook Logs` section. You can filter the logs by webhook ID, date or result (success/fail). In a standart build of Spica, there is no time limitation on webhook logs. So you can store all webhook logs forever.

> IMPORTANT: Because of no time limit on webhook logs, we suggest you to clear webhook logs in a time interval. Otherwise you should consider your server hardwares to use Spica instance with hight performance.

## User Activity Logs

User Activity module gives you access to control each passport identities' activity logs. You can filter actrivity logs by identity, action type, module, date or even document id. In a standart build of Spica, you can see all user activies without any time limitation.

> IMPORTANT: Because of no time limit on user acitivity logs, we suggest you to clear user activities in a time interval. Otherwise you should consider your server hardwares to use Spica instance with hight performance.

To list all Spica users' activity, simply navigate to **Primary** -> **User Activities**

## Dashboard

Dashboard module allows you to create a new custome dashboard including custom data charts or table. The only way to creating a custom dashboard is writing a function in your Spica instance. You have to import and use dashboard library provided by Spica instance in your function. You can seed the dashboard module with any data. So you can take data from buckets, database or even other 3rd party integration. You can create multiple dashboards and once you activated a new dashboard, you can see your dashboard on the left hand menu.

> IMPORTANT: We suggest you to initiate a dashboard with an `HTTP` trigger or `SYSTEM:READY` trigger. Otherwise your custom dashboard may be initiated multiple times. This may cause repeated dashboard on the left side menu. Dashboard module does not control how many times you initiated a dashboard.

Define a dashboard:

```typescript
export default function(req, res) {
  const linedata: Charts.Response = {
    linedata: {
      title:"line title",
      options: {legend: {display: true}, responsive: true},
      label: ["1", "2", "3", "4", "5", "6"],
      datasets: [{data: [65, 59, 90, 81, 56, 55, 40], label: "linedata"}],,
      legend: true,
      width:70,
      filters:[{key:'line_data_filter',title:'Please enter filter',type:"string"}]
    }
  };
  const radardata: Charts.Response = {
    radardata: {
      title:"radar title",
      options: {legend: {display: true}, responsive: true},
      label: ["Eating", "Drinking", "Sleeping", "Designing", "Coding", "Cycling", "Running"],
      datasets: [
        {data: [65, 59, 90, 81, 56, 55, 40], label: "radardata"},
        {data: [28, 48, 40, 19, 96, 27, 100], label: "Series B"}
      ],
      legend: true,
      width:30
    }
  };
  const bardata: Charts.Response = {
    bardata: {
      title:"bar title",
      options: {legend: {display: true}, responsive: true},
      label: ["2006", "2007", "2008", "2009", "2010", "2011", "2012"],
      datasets: [
        {data: [65, 59, 80, 81, 56, 55, 40], label: "bardata"},
        {data: [28, 48, 40, 19, 86, 27, 90], label: "Series B"}
      ],
      legend: true
    }
  };
  const piedata: Charts.Response = {
    piedata: {
      title:"pie title",
      options: {legend: {display: true}, responsive: true},
      label: [["piedata", "Sales"], ["In", "Store", "Sales"], "Mail Sales"],
      data: [300, 500, 100],
      legend: true
    }
  };
  const doughnutdata: Charts.Response = {
    doughnutdata: {
      title:"doughnot title",
      options: {legend: {display: true}, responsive: true},
      label: ["doughnutdata Sales", "In-Store Sales", "Mail-Order Sales"],
      data: [[350, 450, 100], [50, 150, 120], [250, 130, 70]],
      legend: true
    }
  };
  const bubbledata: Charts.Response = {
    bubbledata: {
      title:"buble title",
      options: {
        responsive: true,
        scales: {
          xAxes: [
            {
              ticks: {
                min: 0,
                max: 30
              }
            }
          ],
          yAxes: [
            {
              ticks: {
                min: 0,
                max: 30
              }
            }
          ]
        }
      },
      datasets: [
        {
          data: [
            {x: 10, y: 10, r: 10},
            {x: 15, y: 5, r: 15},
            {x: 26, y: 12, r: 23},
            {x: 7, y: 8, r: 8}
          ],
          label: "bubbledata"
        }
      ],
      legend: true
    }
  };
  const scatterdata: Charts.Response = {
    scatterdata: {
       title:"scatter title",
      options: {
        responsive: true
      },
      datasets: [
        {
          data: [{x: 1, y: 1}, {x: 2, y: 3}, {x: 3, y: -2}, {x: 4, y: 4}, {x: 5, y: -3, r: 20}],
          label: "scatterdata",
          pointRadius: 10
        }
      ],
      legend: true
    }
  };
  const polarAreadata: Charts.Response = {
    polarAreadata: {
       title:"polar title",
      options: {
        responsive: true
      },
      data: [300, 500, 100, 40, 120],
      legend: true
    }
  };
  const tabledata: Table.Response = {
    tabledata: {
       title:"table title",
      data: [
        {position: 1, name: "Hydrogen", weight: 1.0079, symbol: "H"},
        {position: 2, name: "Helium", weight: 4.0026, symbol: "He"},
        {position: 3, name: "Lithium", weight: 6.941, symbol: "Li"},
        {position: 4, name: "Beryllium", weight: 9.0122, symbol: "Be"},
        {position: 5, name: "Boron", weight: 10.811, symbol: "B"},
        {position: 6, name: "Carbon", weight: 12.0107, symbol: "C"},
        {position: 7, name: "Nitrogen", weight: 14.0067, symbol: "N"},
        {position: 8, name: "Oxygen", weight: 15.9994, symbol: "O"},
        {position: 9, name: "Fluorine", weight: 18.9984, symbol: "F"},
        {position: 10, name: "Neon", weight: 20.1797, symbol: "Ne"}
      ],
      displayedColumns: ["position", "name", "weight", "symbol"]
    }
  };
  response.send([
    bubbledata,
    scatterdata,
    linedata,
    piedata,
    radardata,
    doughnutdata,
    polarAreadata,
    bardata,
    tabledata
  ]);
}
```

And initialize dashboards on another function:

```typescript
// Add `@spica-devkit/dashboard` to your dependencies and import it
import * as Dashboard from "@spica-devkit/dashboard";
export default async function () {
  // Create an API key and initialize dashboards with it
  Dashboard.initialize(<APIKEY>);
  let dashboard = await Dashboard.create({
    key: "unique_key",
    name: "Line Chart", // This name will be shown on Spica Client
    icon: "none",
    components: [
      {
        type: "line",
        // Url of your dashobard function
        url: "http://localhost:4300/fn-execute/line",
        key: "linedata",
      },
    ],
  });
}
```

To see your custom dashboards, please navigate to **Primary** section on the menu.

## Spica CLI

Spica prodivdes CLI to manage your instances. To use CLI, simply enter the following command to your terminal:

```shell
npm install @spica/cli -g
```

Usage:

```shell
$ spica <command> [<args>] [--help] [options]
```

Commands:

### Run / List / Remove Local Spica Instance

Run a Spica instance on your local machine:

```shell
$ spica serve <instance name>
```

Stop and remove a spica instance:

```shell
$ spica rm
```

Shows a list of spica instances running on this machine:

```shell
$ spica ls
```

### Dependancy Install

Installs desired package to all available functions:

```shell
$ spica function dependency install <package name> --all
```

### Login

To login desired Spica instance:

```shell
$ spica login <username> <password> --server=<server url>
```

### Pull / Push Spica Functions

To pull functions to your directory from logged in Spica instance:

```shell
$ spica pull <directory>
```

After run `spica pull <directory>` command, Spica CLI will create a `package.yaml` file which contains all the assets you pull.

```yaml
- kind: Function
  spec:
    name: Example Function
    description: Example Function, created via CLI
    triggers:
      default:
        options:
          collection: bucket_5ed0c8eb10ee2e1f048fd397
          type: UPDATE
        type: database
        active: true
    env: {}
    memoryLimit: 100
    timeout: 100
    indexPath: 5ee3653c7072c581afb51b12/index.ts
    dependencies: []
```

Pushes functions from your directory to logged in Spica instance:

```shell
$ spica push <directory>
```

To push functions to logged in Spica instance, you have to provide `package.yaml` file under the directory
