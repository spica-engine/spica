# UI Kit — Package Integration

## Current State

`apps/panel` now resolves `oziko-ui-kit` from the installed npm package again.

The panel no longer reads source files from the sibling `ui-kit` repository.

---

## Active Configuration

### `apps/panel/vite.config.ts`

- Uses the normal Vite React setup.
- Does not alias `oziko-ui-kit` or `oziko-ui-kit/dist/*` into `../../../ui-kit/src`.
- Does not add custom module resolution for ui-kit internals.
- Does not extend `server.fs.allow` for the sibling `ui-kit` folder.

### `apps/panel/tsconfig.json`

- Keeps only the panel-local `~/*` path mapping.
- Does not override TypeScript resolution for `oziko-ui-kit`.

### `apps/panel/package.json`

- `oziko-ui-kit` stays as a normal dependency.
- The installed workspace copy currently resolves to version `0.0.139`.

---

## Upgrade Flow

When a new ui-kit version is published, update the dependency and reinstall:

```bash
cd /Users/kardelenarslan/spica

# update apps/panel/package.json to the published version
yarn install
```

---

## Verification

```bash
cd /Users/kardelenarslan/spica
rm -rf node_modules/.vite/apps/panel
yarn nx build panel
```

If that build passes, panel is consuming the npm package successfully.

---

## If Local Source Linking Is Needed Again

Local source linking should be treated as a temporary override only.

If that workflow is needed again, reintroduce it explicitly in panel config instead of assuming the sibling `ui-kit` repo is part of the normal module resolution path.
