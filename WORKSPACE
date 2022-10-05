workspace(
    name = "spica",
    managed_directories = {"@npm": ["node_modules"]},
)

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")

# Setup nodejs workspace
http_archive(
    name = "build_bazel_rules_nodejs",
    sha256 = "d63ecec7192394f5cc4ad95a115f8a6c9de55c60d56c1f08da79c306355e4654",
    urls = ["https://github.com/bazelbuild/rules_nodejs/releases/download/4.6.1/rules_nodejs-4.6.1.tar.gz"],
)

load("@build_bazel_rules_nodejs//:index.bzl", "node_repositories", "yarn_install")

node_repositories(
    node_version = "16.11.0",
)

yarn_install(
    name = "npm",
    package_json = "//:package.json",
    yarn_lock = "//:yarn.lock",
)

yarn_install(
    name = "npm_cli",
    package_json = "//stacks/cli:package.json",
    yarn_lock = "//stacks/cli:yarn.lock",
)

# Setup docker workspace
http_archive(
    name = "io_bazel_rules_docker",
    sha256 = "59536e6ae64359b716ba9c46c39183403b01eabfbd57578e84398b4829ca499a",
    strip_prefix = "rules_docker-0.22.0",
    urls = ["https://github.com/bazelbuild/rules_docker/releases/download/v0.22.0/rules_docker-v0.22.0.tar.gz"],
)

load(
    "@io_bazel_rules_docker//repositories:repositories.bzl",
    container_repositories = "repositories",
)

container_repositories()

load("@io_bazel_rules_docker//repositories:deps.bzl", container_deps = "deps")

container_deps()

# Download base images, etc
load("@io_bazel_rules_docker//container:container.bzl", "container_pull")

container_pull(
    name = "nginx_image",
    digest = "sha256:881169baf03885268b54eb07c673bc27f394b263cb728dfd86ff2b65b3450932",
    registry = "index.docker.io",
    repository = "library/nginx",
    tag = "alpine",
)

container_pull(
    name = "debian_image",
    digest = "sha256:1ceec96ca567c40500a2745728f7c19c0801785c8b10187b1d66bcd538694fc2",
    registry = "index.docker.io",
    repository = "library/debian",
    tag = "buster-slim",
)

load(
    "@io_bazel_rules_docker//nodejs:image.bzl",
    nodejs_image_repos = "repositories",
)

nodejs_image_repos()

# Prepare base image for mongoreplicationcontroller
load("@io_bazel_rules_docker//contrib:dockerfile_build.bzl", "dockerfile_image")

dockerfile_image(
    name = "mongoreplicationcontroller_base",
    dockerfile = "//tools/mongoreplicationcontroller:Dockerfile",
)

# Setup kubernetes workspace
git_repository(
    name = "io_bazel_rules_k8s",
    commit = "26b1b471b4c2af39c4e2fedb2b25a3940b531a99",
    remote = "https://github.com/bazelbuild/rules_k8s.git",
    shallow_since = "1581367747 -0500",
)

load("@io_bazel_rules_k8s//k8s:k8s.bzl", "k8s_defaults", "k8s_repositories")

k8s_repositories()

# Create a rule named as k8s_deploy

k8s_defaults(
    name = "k8s_deploy",
    cluster = "_".join([
        "gke",
        "spica-239113",
        "us-central1-a",
        "godfather",  # Change to "ssl-cluster", to deploy prod.
    ]),
    image_chroot = "index.docker.io",
    kind = "deployment",
)
