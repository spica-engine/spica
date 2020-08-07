echo ""
echo "## Building spicaengine.com"
yarn --cwd=docs/site --silent install --frozen-lockfile
yarn --cwd=docs/site --silent ng build --prod --progress=false


echo ""
echo "## Deploying spicaengine.com"
$BAZEL run //docs/site:deploy.replace --platforms=@build_bazel_rules_nodejs//toolchains/node:linux_amd64 --config=release -- --force