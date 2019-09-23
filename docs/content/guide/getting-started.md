# Getting Started

## Installing Spica

This tutorial helps you to install Spica to different environments. We provide a few ways to install, so you can choose which one of them suits you. 

### Using Spica Cli

> Note: This feature is currently unavailable. Continue with other installation ways. 

Spica has a command-line interface for quick installation. To use it, you must have [Docker](https://www.docker.com/) and [NodeJs](https://nodejs.org) installed on your development environment.

Install CLI using the `npm` package manager:

```sh
$ npm install @spicaengine/cli -g
```

To create and serve a new Spica instance on your computer, simply run:

```sh
$ spica run my-spica-instance 
```

When everything completed, you will get an output similar to below:

```console
✔ Pulling images (4/4)
✔ Creating a network named test-network.
✔ Creating database containers (3/3)
✔ Initiating replication between database containers.
✔ Waiting for the replica set to become ready.
✔ Creating spica containers (2/2)
✔ Creating an ingress to route traffic.
Spica my-first-spica-instance is serving on http://localhost:4500
Open your browser on http://localhost:4500/spica to login.
```

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
