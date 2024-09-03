# This is our base image with all necessary tooling that we need to test and release spica
# Run    docker build .buildkite -t spicaengine/buildkite-node-with-mongodb:12      from the workspace root
# and publish the image by running    docker push spicaengine/buildkite-node-with-mongodb:12  
# Note that the number 12 ought to be sync with node's version to keep us beware which version of node we are testing against
FROM node:12.22.0-buster

# Install essentials
RUN apt-get update && apt-get install apt-transport-https ca-certificates curl gnupg wget -y

# Install docker cli
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -
RUN echo "deb [arch=amd64] https://download.docker.com/linux/debian stretch stable" | tee /etc/apt/sources.list.d/docker-ce.list
RUN apt-get update && apt-get install docker-ce-cli -y

# Install mongodb
RUN curl -fsSL https://pgp.mongodb.com/server-4.2.asc | \
gpg -o /usr/share/keyrings/mongodb-server-4.2.gpg \
--dearmor
RUN echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-4.2.gpg ] http://repo.mongodb.org/apt/debian buster/mongodb-org/4.2 main" | tee /etc/apt/sources.list.d/mongodb-org-4.2.list
RUN apt-get update && apt-get install mongodb-org-server -y

# Install google cloud cli
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
RUN curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
RUN apt-get update && apt-get install google-cloud-sdk -y

# Install kubectl 
RUN mkdir -p -m 755 /etc/apt/keyrings
RUN curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.31/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
RUN chmod 644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg # allow unprivileged APT programs to read this keyring
RUN echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.31/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list
RUN chmod 644 /etc/apt/sources.list.d/kubernetes.list 
RUN apt-get update && apt-get install kubectl -y

# Install helm
RUN curl -fsSL https://helm.baltorepo.com/organization/signing.asc | apt-key add -
RUN echo "deb https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list
RUN apt-get update && apt-get install helm -y

# Install chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \ 
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list
RUN apt-get update && apt-get -y install google-chrome-stable
ENV CHROME_BIN=/usr/bin/google-chrome

# Smoke tests
RUN node --version
RUN google-chrome --version
RUN gcloud version
RUN kubectl version --client
RUN helm version