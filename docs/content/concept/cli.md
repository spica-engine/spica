# CLI

Spica prodivdes CLI to manage your instances. To use CLI, simply enter the following command to your terminal:

```shell
$ npm install @spica/cli -g
```

Usage:

```shell
$ spica <command> [<args>] [--help] [options]
```

> Important: To run `serve` command, you must have [Docker](https://www.docker.com/) and [NodeJs](https://nodejs.org) installed on your development environment.

## Commands

### Run / List / Remove Local Spica Instance

Run a Spica instance on your local machine:

```shell
$ spica project start <instance name>
```

Stop and remove a spica instance:

```shell
$ spica project remove <instance name>
```

Shows a list of spica instances running on this machine:

```shell
$ spica project ls
```

### Dependency Install

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

After a successful `spica pull <directory>` command, Spica CLI will create a `package.yaml` along with a directory that contains all the assets you have pulled.

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
