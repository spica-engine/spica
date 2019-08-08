# Getting Started

This tutorial helps you to install Spica to different environments.
First, we will explain a few things as Spica has few requirements in order to work.

## Table of contents

## Requirements

- **mongoDB** 4.2-rc and above
- **nodeJS** 10 and above

As spica relies on **replica set** feature of MongoDB, you need to configure at least **3 members** of replica set.

> Important: One of the replica set members must have _slaveDelay_ enabled and delay time must be greater than 3 seconds. (5 seconds suggested.)

## Installation

As we are publishing Spica as container images, you need a container runtime in order to use official Spica images.

> Note: If you are not familiar with containers, we highly recommend you to get familiar with them.

### Kubernetes

- Install kubectl: https://kubernetes.io/docs/tasks/tools/install-kubectl/
- After, you'll need a kubernetes environment it can be either a local or a cloud kubernetes environment.
  - For local Kubernetes, you can use minikube: https://kubernetes.io/docs/tasks/tools/install-minikube/
  - For AWS, you can create an EKS cluster: https://docs.aws.amazon.com/eks/latest/userguide/create-cluster.html
  - For GCP, you can create a GKE cluster: https://cloud.google.com/kubernetes-engine/docs/how-to/creating-a-cluster
  - For Azure, you can create an AKS cluster: https://docs.microsoft.com/en-us/azure/aks/kubernetes-walkthrough
- Ensure kubectl connected to the kubernetes cluster by running `kubectl get nodes` command.
- The Cluster must have Nginx ingress controller enabled. You can follow https://kubernetes.github.io/ingress-nginx/deploy/ to install Nginx ingress on the cluster.
- Just apply `kubectl apply -f https://raw.githubusercontent.com/spica-engine/spica/master/deployment.yaml`

### Docker

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
  docker run --name mongo-1 --network spica -d mongo --replSet "rs0" --bind_ip_all
  docker run --name mongo-2 --network spica -d mongo --replSet "rs0" --bind_ip_all
  docker run --name mongo-3 --network spica -d mongo --replSet "rs0" --bind_ip_all
  ```
- Ensure that all three of replica set members are up and running.
  ```sh
  # Run the command below
  docker ps --filter=Name=mongo
  # If you get an output that similar to this, that means you are good to go.
  CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS               NAMES
  9183a4935e2d        mongo               "docker-entrypoint.s…"   10 minutes ago      Up 10 minutes       27017/tcp           mongo-3
  34920d7d9124        mongo               "docker-entrypoint.s…"   10 minutes ago      Up 10 minutes       27017/tcp           mongo-2
  e73c9107d53d        mongo               "docker-entrypoint.s…"   10 minutes ago      Up 10 minutes       27017/tcp           mongo-1
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
  # Start spica (client) on port 8080
  docker run --name spica --network spica -p 8080:80 -d gcr.io/spica-239113/spica
  # Start spica (api) on port 4300
  docker run
          --name api
          --network spica
          -p 4300:4300
          -e PORT=4300
          -e DATABASE_URI="mongodb://mongo-1,mongo-2,mongo-3"
          -e REPLICA_SET="rs0"
          -e DATABASE_NAME=spica
          -e PUBLIC_HOST=http://localhost:4300 # You can replace this with your domain name if you have any.
          -e PERSISTENT_PATH=/tmp # The path that the storage files will be kept at.
          -d gcr.io/spica-239113/api
  # Important: you need to apply these two commands until
  # https://github.com/spica-engine/spica/issues/20 resolves.
  docker exec -it spica sed -i "s/\/spica\//\//g" /usr/share/nginx/html/index.html
  # Basically, this replaces /api with http://localhost:4300 which is our accesible api url.
  docker exec -w /usr/share/nginx/html -it spica find . -type f -iname 'main-es*.js' -exec sed -i 's/\"\/api\"/\"http:\/\/localhost:4300\"/g' {} \;
  ```
- Ensure you have setup everything correctly
  ```sh
  # Run
  docker ps
  # And you will see an output like this
  CONTAINER ID        IMAGE                       COMMAND                  CREATED             STATUS              PORTS                    NAMES
  76211cf5d960        gcr.io/spica-239113/api     "/app/stacks/api_ima…"   6 seconds ago       Up 5 seconds        0.0.0.0:4300->4300/tcp   api
  66001a891855        gcr.io/spica-239113/spica   "nginx -g 'daemon of…"   17 seconds ago      Up 16 seconds       0.0.0.0:8080->80/tcp     spica
  49308ccfde23        mongo                       "docker-entrypoint.s…"   28 seconds ago      Up 27 seconds       27017/tcp                mongo-3
  07a4ec8a349d        mongo                       "docker-entrypoint.s…"   29 seconds ago      Up 27 seconds       27017/tcp                mongo-2
  a0ecdc3c6f68        mongo                       "docker-entrypoint.s…"   30 seconds ago      Up 28 seconds       27017/tcp                mongo-1
  # the first container (api) is our api service, core of our spica instance.
  # the second container (spica) is our client which communicates with api container.
  # the other ones (mongo-1, mongo-2, mongo-3) is our three-member replica set mongodb containers.
  ```
- Open your browser and navigate to http://localhost:8080
- The default `identifier` is `spica` and the password is `123`.

## More details

> You can skip this part if you don't want to know detailed explanation of requirements.

> TODO: Explain why do we need replica sets

> TODO: Explain how you can setup your default language and default users
