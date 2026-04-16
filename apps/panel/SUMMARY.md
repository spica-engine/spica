# apps/panel — Project Summary

## What It Is

`apps/panel` is the **admin UI** for the Spica backend engine. It is a fully client-rendered **Single Page Application (SPA)** that serves as the visual control plane for all Spica backend capabilities — data modeling, serverless functions, storage, access management, webhooks, dashboards, and more.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 5 + Nx (outputs to `/dist/panel`) |
| State | Redux Toolkit (slices) + RTK Query (server state) |
| Routing | React Router DOM v6 (`createBrowserRouter`) |
| UI Kit | `oziko-ui-kit` (proprietary component kit) |
| Styling | SCSS Modules + CSS custom properties |
| Forms | Formik + Yup |
| Code Editor | Monaco Editor (same as VS Code) |
| Image Editing | TUI Image Editor |
| Drag & Drop | `react-dnd` + `react-dnd-html5-backend` |
| Grid Layouts | `react-grid-layout` |
| Diagrams | `@projectstorm/react-diagrams` |
| Auth Parsing | `jwt-decode` |

---

## Architectural Design

### 1. Component Architecture — Atomic Design

The component tree follows a strict **Atomic Design** hierarchy:

- **Atoms** → smallest elements: `Toolbar`, `Logo`, `Loader`
- **Molecules** → composed atoms: `BucketActionBar`
- **Organisms** → full-featured components: `SideBar`, `SpicaTable`, `BucketTable`, `PageLayout`
- **Prefabs** → reusable templates, critically the **Navigation Registry** pattern
- **Templates** → full page-level layout wrappers

### 2. Navigation Registry Pattern

The sidebar is driven by a **plugin-style navigation registry**: each domain (bucket, function, storage, etc.) registers its own navigation component under a unique ID. `Layout.tsx` merges all registered navigators and injects them into the `SideBar`. This makes the sidebar dynamically extensible without modifying a central config.

### 3. State Management — Two-Layer Approach

- **Redux slices** manage local client state: auth tokens (`authSlice`), storage directory tree (`storageSlice`), bucket row selections (`entrySelectionSlice`)
- **RTK Query** manages all server state: every API domain (bucket, function, policy, webhook, etc.) has its own endpoint file injected into a single `baseApi`. Cache invalidation uses tag types per domain.
- **`baseApi`** auto-injects `Authorization: IDENTITY {token}` into every request header; on 401 it clears the token and redirects to login.

### 4. Authentication Flow

```
Login → authApi.login() → token stored in Redux + localStorage
→ All requests get auth header from baseQuery
→ 401 → clearToken() → navigate /passport/identify
```

JWT is decoded client-side via `jwt-decode` to extract the user identifier for display.

### 5. Routing — Protected Layout Shell

All authenticated routes are wrapped in a `ProtectedRoute` guard that renders `Layout`. `Layout` provides the persistent sidebar + responsive drawer (collapses for viewport < 1280px).

| Route | Purpose |
|---|---|
| `/passport/identify` | Login |
| `/dashboard`, `/dashboard/:id` | Home + custom dashboards |
| `/bucket/:bucketId` | Data table for a bucket |
| `/passport/identity` | User identity management |
| `/passport/user` | User profile |
| `/passport/policy` | RBAC policy editor |
| `/passport/strategy` | OAuth/SSO strategy config |
| `/passport/refresh-token` | Refresh token settings |
| `/passport/secrets-and-variables` | Env secrets management |
| `/function/:functionId` | Serverless function editor (Monaco) |
| `/function-logs` | Function execution logs |
| `/webhook/:webhookId` | Webhook configuration |
| `/storage` | File storage browser |
| `/storage-view/:storageId` | File detail/preview |
| `/activity` | User activity log |
| `/diagram` | Visual system diagram |
| `/version-control` | Schema version control |
| `/config` | System configuration |

---

## Domain Coverage (Pages)

The panel provides UI for **every backend domain** in Spica:

- **Bucket** — dynamic NoSQL-like data tables with configurable schemas, drag-reorderable in sidebar, infinite scroll, batch operations, column-based data entry
- **Dashboard** — custom dashboard builder powered by `react-grid-layout` for widget arrangement
- **Functions** — serverless function editor with Monaco code editor, dependency management, trigger configuration, log viewer
- **Storage** — S3-like file storage browser with folder navigation, preview, TUI image editor, docx preview
- **Passport (Access Management)** — full IAM: identities, policies (statement-based RBAC), authentication strategies (OAuth/SSO), API keys, refresh tokens, secrets, audit activity log
- **Webhooks** — HTTP webhook creation and management
- **Version Control** — schema versioning and synchronization UI
- **Diagram** — visual representation of system relationships
- **Config** — system-level settings

---

## Key Design Patterns

| Pattern | Description |
|---|---|
| Page-level Drawer | Create/Edit forms open as side drawers, keeping list context visible |
| Optimistic UI | Bucket reordering uses optimistic updates with server sync |
| Batch API | Dedicated `batchApi` endpoint for bulk delete/update operations |
| Custom Hooks | 30+ hooks encapsulate data-fetching and UI logic per domain |
| Context Providers | `AuthContext`, `BucketContext`, `DrawerContext`, `StorageContext` for cross-component state |
| Direct REST mapping | RTK Query endpoints map 1:1 to REST API endpoints |

---

## Directory Structure

```
apps/panel/src/
├── app/                  # App component (minimal root)
├── assets/               # Static icons and SVGs
├── components/           # Atomic Design pattern
│   ├── atoms/            # Small reusable elements (Toolbar, Logo, Loader)
│   ├── molecules/        # Composed atoms (BucketActionBar)
│   ├── organisms/        # Complex components (SideBar, SpicaTable, BucketTable)
│   ├── prefabs/          # Reusable templates
│   │   └── navigations/  # Navigation registry entries per domain
│   ├── templates/        # Full page templates
│   └── guards/           # ProtectedRoute.tsx
├── contexts/             # React Context providers
│   ├── AuthContext.tsx
│   ├── BucketContext.tsx
│   ├── BucketLookupContext.tsx
│   ├── DrawerContext.tsx
│   └── StorageContext.tsx
├── domain/               # Domain-specific business logic
├── hooks/                # 30+ custom React hooks
├── layout/
│   ├── Layout.tsx        # Main layout wrapper
│   └── components/       # BucketNavigatorPopupWrapper.tsx
├── pages/                # One component per route
│   ├── activities/
│   ├── bucket/
│   ├── config/
│   ├── dashboard/
│   ├── diagram/
│   ├── function/
│   ├── function-log/
│   ├── home/
│   ├── identity/
│   ├── login/
│   ├── policy/
│   ├── refresh-token/
│   ├── secrets-and-variables/
│   ├── storage/
│   ├── storage-view/
│   ├── strategy/
│   ├── user/
│   ├── version-control/
│   └── webhook/
├── router.tsx            # React Router config
├── services/             # API client wrappers
├── store/                # Redux store
│   ├── api/              # RTK Query endpoint definitions per domain
│   └── slices/           # Redux slice creators
├── styles/               # Global SCSS utilities
├── types/                # TypeScript interfaces per domain
└── utils/                # Shared utility functions
```

---

## Infrastructure Integration

- **Dev server**: Port 4200 (Vite), preview at 4300
- **Production**: Served via Nginx (`nginx.conf`, `gateway.conf`) inside a Docker container
- **Base URL**: Configurable via `BASE_URL` env var, enabling sub-path deployment (e.g., `/spica/`)
- **Monorepo**: Managed by Nx under `@spica/panel`, self-contained (does not consume `libs/`)

---

## One-Paragraph Summary

`apps/panel` is a modern React 19 SPA that acts as the full administrative interface for the Spica backend engine. It uses Redux Toolkit + RTK Query for all state and server communication, React Router v6 for client-side navigation, and `oziko-ui-kit` as its UI foundation. The codebase is organized according to Atomic Design principles, with a dynamic navigation registry making the sidebar extensible without central config changes. It covers every Spica backend domain — from NoSQL bucket management and serverless functions to IAM, file storage, webhooks, and system diagnostics — all protected behind JWT-based authentication with automatic token injection. Deployment is Docker/Nginx-based, outputting a static SPA that proxies API calls to the NestJS backend.
