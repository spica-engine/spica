# Open Source Build

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

### Create a User Bucket Schema

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

### Add entry to "Users" Bucket

Navigate to **Content** -> **Users**, in the left-hand menu.

- Click "+" icon on the top right toolbar.
- Type "John Doe" in the **Name** field.
- Type "john@doe.com" in the **Email** field.
- Click on **Birthday** field and select a date.
- Click **Save**

You will see a user named John Doe listed in the entries.

### Get the User Bucket entries via API

Our newly created User Bucket is ready with an entry. The list of **Users** is accessible at http://localhost:4500/api/bucket/{bucket_id}

> Note: The bucket id of the newly created **Users** bucket can be found by clicking on the "i" icon on the list view.

**Congratulations**
You have created your first Bucket and your first bucket entry on Spica and have accessed it both via Spica Client and the API.
