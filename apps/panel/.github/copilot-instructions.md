# Spica Panel — Copilot Instructions

## Project Overview

Spica Panel is a React 19 admin dashboard for the Spica backend engine. It is part of an Nx monorepo (`apps/panel`), built with Vite, and uses TypeScript in strict mode. The UI layer is powered by `oziko-ui-kit` (an internal component library) and SCSS CSS Modules. State management uses Redux Toolkit with RTK Query for server state and Redux slices for client state. Routing uses React Router v6 with `createBrowserRouter`.

**Key dependencies:** React 19, React Router DOM 6, Redux Toolkit (RTK Query), Formik + Yup, react-dnd, react-grid-layout, Monaco Editor, oziko-ui-kit.

---

## Architecture

### Atomic Design (Component Hierarchy)

Components follow an atomic design system with an additional "prefabs" layer:

| Layer | Location | Purpose | Memoization |
|---|---|---|---|
| **Atoms** | `src/components/atoms/` | Small, reusable UI primitives (Toolbar, SearchBar, Loader, Logo, Button) | Wrapped with `React.memo` via `export default memo(Component)` |
| **Molecules** | `src/components/molecules/` | Composed atoms with local logic (BucketActionBar, Confirmation, BucketEntryForm) | Selectively memoized |
| **Organisms** | `src/components/organisms/` | Complex sections with business logic (BucketTable, Sidebar, PageLayout, Dashboard) | Not memoized |
| **Prefabs** | `src/components/prefabs/` | Reusable domain-specific compositions (DeleteBucket, FilePreview, Filter, Navigations, RelationPicker) | Not memoized |
| **Templates** | `src/components/templates/` | Full page templates reused across routes (CommitHistory, Terminal) | Memoized |

### Page Structure

Pages live in `src/pages/<page-name>/` with this convention:
```
pages/<page-name>/
  PageName.tsx              # Main component (PascalCase)
  PageName.module.scss      # CSS Module (PascalCase matching component)
  components/               # (optional) page-specific sub-components
  hooks/                    # (optional) page-specific hooks
  utils.ts                  # (optional) helper functions
```

Pages compose a toolbar/action-bar at the top + primary content area (table, editor, cards). Drawers (from `oziko-ui-kit`) are used for create/edit forms. The `Confirmation` molecule handles destructive-action dialogs.

### Layout

`src/layout/Layout.tsx` is the app shell wrapping authenticated routes via `<Outlet />`. It renders Sidebar (collapsible) + Toolbar + Content area. The sidebar is permanently visible at ≥1280px and collapses into a Drawer on narrower screens.

### Routing

`src/router.tsx` uses `createBrowserRouter`. Login is at `/passport/identify`. All other routes are wrapped in `<ProtectedRoute><Layout /></ProtectedRoute>`. Routes include: dashboard, bucket/:bucketId, passport/identity, passport/policy, passport/strategy, activity, diagram, storage, function/:functionId, webhook/:webhookId, version-control.

---

## State Management

### Redux Store (src/store/)

The store combines RTK Query's auto-generated reducer with three manual slices:

- **`authSlice`** — token management with localStorage persistence. Selectors: `selectToken`, `selectIsAuthenticated`, `selectParsedToken`.
- **`storageSlice`** — directory navigation state for the storage file browser. Complex folder-click logic with ancestor path resolution.
- **`entrySelectionSlice`** — multi-select state for bucket entries, keyed by bucketId → entryIds[].

Use typed hooks from `src/store/hook.ts`:
```ts
import { useAppDispatch, useAppSelector } from '../store/hook';
```

### RTK Query (src/store/api/)

All server state is managed via RTK Query. A single `baseApi` is defined in `baseApi.ts`, and feature APIs extend it via `injectEndpoints()`:

- `authApi` — login/logout, strategies
- `bucketApi` — CRUD buckets, fields, rules, history, limitations, entries
- `functionApi` — CRUD functions, triggers, dependencies, env, logs, executions
- `identityApi` — CRUD identities, policies, authentication
- `policyApi` — CRUD policies (with optimistic updates)
- `storageApi` — CRUD storage items, upload with progress
- `webhookApi` — CRUD webhooks
- `versionControlApi` — git operations (commit, push, branch, log, diff)
- `dashboardApi`, `activitiesApi`, `apiKeyApi`, `authenticationStrategyApi`, `batchApi`

**API file structure:**
```ts
import { baseApi } from './baseApi';

// 1. Type definitions for request/response
export type FooType = { ... };

// 2. Tag constants
const FOO_TAG = 'Foo' as const;
const FOO_TAGS = { LIST: { type: FOO_TAG, id: 'LIST' } };

// 3. Inject endpoints
export const fooApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFoos: builder.query<FooType[], FooOptions>({
      query: (params) => { /* build URL with URLSearchParams */ },
      providesTags: (result) => [
        ...(result?.map(item => ({ type: FOO_TAG, id: item._id })) ?? []),
        FOO_TAGS.LIST,
      ],
    }),
    createFoo: builder.mutation<FooType, CreateFooRequest>({
      query: (body) => ({ url: '/foo', method: 'POST', body }),
      invalidatesTags: [FOO_TAGS.LIST],
    }),
    // ...
  }),
  overrideExisting: false,
});

// 4. Export hooks
export const { useGetFoosQuery, useCreateFooMutation } = fooApi;
```

**Tag invalidation pattern:**
- List queries provide per-item `{ type, id: _id }` tags + a `{ type, id: 'LIST' }` sentinel
- Create mutations invalidate `LIST`
- Update/Delete mutations invalidate `{ type, id }` + `LIST`
- Some APIs use optimistic updates via `onQueryStarted` + `util.updateQueryData` + `patchResult.undo()` on failure

**Auth header:** Automatically injected via `baseQueryWithReauth` → `Authorization: IDENTITY ${token}`. 401 responses trigger `clearToken()` and redirect to login.

### RTK Query barrel exports

`src/store/api/index.ts` re-exports all hooks, types, and API objects from all API files, plus domain hooks from `src/hooks/`. Import from here:
```ts
import { useGetBucketsQuery, useDeleteBucketMutation, type BucketType } from '../store/api';
```

---

## Custom Hooks

### Domain Hooks (src/hooks/)

Thin wrappers around RTK Query hooks that compose multiple queries/mutations and flatten loading/error states:

| Hook | Pattern | Returns |
|---|---|---|
| `useBucket` | Wraps bucket queries + mutations | `{ buckets, loading, createBucket, deleteBucket, ... }` |
| `useBucketData` | Wraps bucket data query with pagination | `{ data, isLoading, refetch, loadMore, ... }` |
| `useBucketColumns` | Pure computation (no API) | Column definitions for BucketTable |
| `useFunction` → `useFunctionList`, `useFunctionDetails`, `useFunctionManagement`, `useFunctionExecutions`, `useFunctionDevelopment` | Granular sub-hooks | Each returns `{ data, isLoading, error, action handlers }` |
| `useIdentity` → `useIdentityList`, `useIdentityDetails`, `useIdentityManagement`, `useAuthState` | Same granular pattern | Same shape |
| `useStorage`, `useStorageData` | Storage operations | `{ items, loading, upload, delete, ... }` |
| `useTerminal` | Version control terminal | `{ history, handleSubmit, isLoading }` |
| `useAuthService` | Login/logout | `{ login, logout, isLoading, error }` |

**Return convention:** All domain hooks return plain objects (never tuples). Exception: `useLocalStorage` returns `[value, setter, deleter]` tuple.

**Error handling in mutations:**
```ts
// Pattern: try/catch with .unwrap(), return result objects
const handleCreate = useCallback(async (data) => {
  try {
    const result = await createMutation(data).unwrap();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error };
  }
}, [createMutation]);
```

### Utility Hooks

| Hook | Purpose |
|---|---|
| `useLocalStorage` | Typed localStorage with `[value, set, delete]` tuple return |
| `useDebounce` | Returns a debounced callback |
| `usePopoverStack` | Manages nested popover z-index stacking |
| `useEntrySelection` | Dispatches to `entrySelectionSlice` for multi-select |
| `useNavigationRefetch` | Triggers data refetch on navigation |
| `useRequestTracker` | Global 401 interceptor (legacy — uses AuthContext) |

### Legacy Hooks (being migrated)

- `useApi` — generic axios wrapper; being replaced by RTK Query
- `useBucketService` — in `src/services/bucketService.ts`; being replaced by `bucketApi` + `useBucket`
- Context-based patterns (AuthContext, StorageContext, BucketContext) are being migrated to RTK Query

---

## Component Conventions

### File Naming

| Item | Convention | Example |
|---|---|---|
| Folders | kebab-case | `bucket-action-bar/`, `search-bar/` |
| TSX components | PascalCase | `BucketActionBar.tsx`, `SearchBar.tsx` |
| SCSS modules | PascalCase matching component | `BucketActionBar.module.scss` |
| Pure TS files | camelCase | `cellRegistry.ts`, `filterUtils.ts` |
| Type-only files | `types.ts` | `types.ts` |

### Component Definition

Prefer arrow functions with explicit prop types. Two accepted patterns:

```tsx
// Pattern A — FC type (preferred for components with children/complex generics)
const SideBar: FC<TypeSideBar> = ({ toggleIconName, onNavigatorToggle }) => { ... };

// Pattern B — Inline destructured typing (preferred for most components)
const SearchBar = ({ inputProps, loading }: SearchBarProps) => { ... };
```

### Props/Types

- Define types **above the component** in the same file
- Use `type` keyword (not `interface`) for props
- Two naming conventions coexist: `Type` prefix (`TypeToolbar`) or `Props` suffix (`SearchBarProps`)
- For new code, prefer the `Props` suffix convention
- Complex domain types go in separate `types.ts` files
- Use `import type { ... }` for type-only imports

### Exports

- **Atoms/molecules/templates:** `export default memo(ComponentName)`
- **Organisms/prefabs/pages:** `export default ComponentName`
- **Barrel files (index.ts):** Rarely used — import components directly by path
- **RTK Query hooks/types:** Re-exported via `src/store/api/index.ts`

### Event Handlers

- **Internal handlers:** `handle*` prefix → `handleCopy`, `handleDelete`, `handleSearchChange`
- **Callback props:** `on*` prefix → `onRefresh`, `onSearch`, `onClose`, `onSave`
- Wrap handlers in `useCallback` in organisms and pages
- Use `lodash/debounce` + `useMemo` for search debouncing

### Memoization

- Atoms and templates: wrap with `memo()` on export
- `useMemo` for derived/computed values, debounced functions, filtered lists
- `useCallback` for all event handlers in organisms and pages
- Never memo organisms or prefabs

---

## Styling

### SCSS CSS Modules

Every component has a co-located `*.module.scss` file:
```tsx
import styles from "./ComponentName.module.scss";
// ...
<div className={styles.container}>
```

Dynamic classes use template literals:
```tsx
className={`${styles.modal} ${props.className || ""}`}
```

### CSS Custom Properties

All values reference design tokens defined in `src/styles.scss` root:

| Category | Pattern | Examples |
|---|---|---|
| Colors | `--color-{name}` | `--color-primary`, `--color-danger`, `--color-font-primary`, `--color-input-background` |
| Colors (RGB) | `--color-{name}-rgb` | `--color-primary-rgb` (for rgba() usage) |
| Font sizes | `--font-size-{size}` | `--font-size-xs` (10px), `--font-size-sm` (12px), `--font-size-md` (14px), `--font-size-lg` (16px) |
| Spacing | `--padding-{size}`, `--gap-{size}` | `--padding-md`, `--gap-md` |
| Borders | `--border-{variant}` | `--border-default`, `--border-radius-md` |

**T-shirt sizing scale:** `xs`, `sm`, `md`, `lg`, `xl`.

### Mixins

Import from shared file:
```scss
@use "../../../styles/mixins";
```

Available mixins include: `flexCenter`, `flexCol`, `flexRow`, `flexWrap`, `flexColCenter`, `textEllipsis($line, $important)`, `inputContainer`, `modalContentContainer`, `hideScrollbar`.

### Font

Inter is the primary font family, loaded from `src/assets/fonts/inter/`.

---

## oziko-ui-kit Usage

The UI kit provides base components. Import named exports:

```tsx
import { FlexElement, Button, Icon, Input, Modal, Popover, Table, Text, Spinner, Select, Checkbox } from "oziko-ui-kit";
import type { TypeButton, TypeInput, TypeModal, IconName, TypeFilterValue } from "oziko-ui-kit";
```

**Key component APIs:**
- `FlexElement` — layout container with `dimensionX`, `dimensionY`, `alignment`, `direction` props
- `Button` — `variant` ("icon" | "text" | "outlined"), `color` ("default" | "danger")
- `Modal` — compound component: `Modal.Header`, `Modal.Body`, `Modal.Footer`
- `Table` — generic `TableColumn<T>` with `renderCell` callbacks
- `Popover` — positioned overlay used with popover stack hook

Import the UI kit CSS in `src/main.tsx`:
```tsx
import "oziko-ui-kit/dist/index.css";
```

---

## Domain Layer

### Field Registry (src/domain/fields/)

The bucket schema builder uses a Strategy/Registry pattern:

- `FieldKind` enum defines 14 field types (String, Number, Date, Boolean, Textarea, Multiselect, Relation, Location, Array, Object, File, Richtext, Json, Color)
- `FIELD_REGISTRY` maps each kind to a `FieldDefinition` object containing: display metadata, defaults, form builders, validation (Yup), transformers, and capability flags
- `initForm()` initializes field creation forms by deep-merging defaults
- Validation uses Yup schemas per field kind

---

## Data Fetching Patterns

### For new code, always use RTK Query:

```tsx
// Reading data
const { data, isLoading, isError, refetch } = useGetFoosQuery(params, {
  skip: !requiredParam,
  refetchOnMountOrArgChange: 10,
});

// Mutations
const [createFoo, { isLoading: isCreating }] = useCreateFooMutation();

const handleCreate = useCallback(async (data: CreateFooRequest) => {
  try {
    const result = await createFoo(data).unwrap();
    // success handling
  } catch (error) {
    console.error('Create failed:', error);
  }
}, [createFoo]);
```

### Loading states

- Full-page: `<Loader />` atom
- Table: `skeletonRowCount` prop on `SpicaTable`
- Inline: conditional text rendering

### Empty states

```tsx
{!isLoading && data?.length === 0 && <EmptyMessage />}
```

### Error states

RTK Query's `error` field is used. Mutation errors caught via `try/catch` on `.unwrap()`.

---

## Context Providers

Providers wrap the app in `src/main.tsx` in this order:
```
Provider (Redux) → DndProvider → DrawerProvider → AuthProvider → BucketProvider → StorageProvider → AppRouter
```

**Note:** BucketProvider and StorageProvider are legacy and being migrated to RTK Query (see TODO comment in main.tsx). For new code, use RTK Query hooks instead of context.

Active contexts:
- `DrawerContext` — global drawer management (`useDrawerController`)
- `BucketLookupContext` — cross-bucket relation resolution in Bucket page (`useBucketLookup`)

---

## Environment Variables

Defined in `.env`, accessed via `import.meta.env`:
- `VITE_BASE_URL` — API server URL (e.g., `http://localhost:4300`)
- `VITE_FILE_HOSTNAME` — Storage file host (e.g., `storage.googleapis.com`)

Static config in `environment.ts` exports documentation/GitHub URLs.

---

## Migration Status

The codebase is mid-migration from Context/useApi to RTK Query:

| Domain | Status |
|---|---|
| Auth | ✅ Migrated to RTK Query (`authApi` + `authSlice`) |
| Buckets | ⚠️ Partially migrated (both `bucketApi` and `BucketContext` exist) |
| Functions | ✅ Migrated to RTK Query |
| Identity | ✅ Migrated to RTK Query |
| Storage | ⚠️ Partially migrated (both `storageApi` and `StorageContext` exist) |
| Policies | ✅ Migrated to RTK Query |
| Webhooks | ✅ Migrated to RTK Query |
| Version Control | ✅ Migrated to RTK Query |
| Activities | ✅ Migrated to RTK Query |
| Dashboard | ✅ Migrated to RTK Query |

**For new features, always use the RTK Query pattern.** Never introduce new Context-based state management.

---

## Code Quality Rules

1. **TypeScript strict mode** — no `any` except in existing legacy code
2. **No inline styles** — use CSS Modules with SCSS
3. **No prop spreading to DOM** — pass props explicitly
4. **No `useEffect` for data fetching** — use RTK Query hooks
5. **Wrap handlers in `useCallback`** in organisms and pages
6. **Use `useMemo`** for derived computations
7. **Use `memo()`** when exporting atoms and templates
8. **Pure functions** outside component body for utilities
9. **`try/catch` with `.unwrap()`** for all mutations
10. **Import types with `import type`** syntax
