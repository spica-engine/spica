# Docs and Site

Docs and Spica site is together.

## Docs

We are generating our docs from markdown and typescript files through bazel rules. (Checkout `/tools/dgeni` directory.). The generated documents will be copied into assets directory under the hood.

You can generate document with running commands.

For API Docs, run: `yarn ibazel build //docs/content/api`

For Content Docs (guide, concept eg.), run: `yarn ibazel build //docs/content`

To Generate Them All run: `yarn docs` or `yarn docs:watch`

After you serve the site, if you can change anything that triggers document generation, then your browser will refresh the spica site.

## Site

To serve spica site locally run;

```sh
# Change directory to site
cd docs/site
# Server the site
ng serve
```

```sh
Example links;
http://localhost:4200/assets/docs/content/doc-list.json # Generated Concept & Guide docs
http://localhost:4200/assets/docs/api/doc-list.json # Generated API docs
```


### Publishing the site (next)

- Cd into site directory
- Run `ng build --prod`
- Cd back to root project directory
- Run `BUILD_SCM_VERSION_OVERRIDE=next yarn bazel run //docs/site:deploy.apply --config=release`