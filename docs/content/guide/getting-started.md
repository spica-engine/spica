# Getting Started

## Introduction

These documents will take you from zero to hero and helps you to discover advanced features of the Spica Development Engine.

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

> IMPORTANT: There has to be at least one docker machine is up and running on your environment. To create a docker machine enter the following command to your terminal:
>
> ```shell
> $ docker-machine create <machine name>
> $ eval "$(docker-machine env <machine name>)"
> ```

Install CLI using the `npm` package manager:

```sh
$ npm install @spica/cli -g
```

To create and serve a new Spica instance on your computer, simply run:

```sh
$ spica serve <docker machine name>
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
[slack]: https://join.slack.com/t/spica-engine/shared_invite/zt-9qix07sg-BxiOW9tBi8elYRQWcMTOKg

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
