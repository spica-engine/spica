# React Development Instructions

> Apply to: `apps/web/**/*.tsx`, `apps/web/**/*.ts`, `apps/web/**/*.css`

Instructions for building with React 18, TypeScript, Vite, and tRPC following modern best practices.

## Project Context
- React 18 with TypeScript
- Vite as build tool
- Functional components with hooks as default
- tRPC + React Query for all server communication
- Feature-based folder organization under `apps/web/src/features/`

## Development Standards

### Architecture
- Use functional components with hooks as the primary pattern
- Implement component composition over inheritance
- Organize components by feature: `apps/web/src/features/<feature>/<Component>.tsx`
- Separate presentational and container components clearly
- Use custom hooks for reusable stateful logic

### TypeScript Integration
- Use TypeScript interfaces for props, state, and component definitions
- Define proper types for event handlers and refs
- Import shared types from `@repo/types` — never redefine them locally
- Use strict mode in tsconfig.json for type safety
- Create union types for component variants and states

### State Management
- Use `useState` for local component state
- Implement `useReducer` for complex state logic
- Leverage `useContext` for sharing state across component trees
- Use tRPC + React Query for all server state — never use raw fetch or axios
- Import `trpc` from `apps/web/src/providers/trpc.tsx`
- Usage pattern: `trpc.routerName.procedureName.useQuery()` / `.useMutation()`

### Hooks and Effects
- Use `useEffect` with proper dependency arrays to avoid infinite loops
- Implement cleanup functions in effects to prevent memory leaks
- Use `useMemo` and `useCallback` for performance optimization when needed
- Follow the rules of hooks (only call at the top level)

### Data Fetching
- Use tRPC React Query hooks for all API communication
- Implement proper loading, error, and success states
- Use optimistic updates for better user experience
- Auth token is stored in localStorage under the key `"auth-token"`
- API endpoint: `http://localhost:3000/trpc`

### Error Handling
- Implement Error Boundaries for component-level error handling
- Use proper error states in tRPC queries and mutations
- Implement fallback UI for error scenarios
- Handle async errors in effects and event handlers

### Security
- Sanitize user inputs to prevent XSS attacks
- Validate and escape data before rendering
- Use HTTPS for all external API calls
- Implement proper authentication and authorization patterns

### Accessibility
- Use semantic HTML elements appropriately
- Implement proper ARIA attributes and roles
- Ensure keyboard navigation works for all interactive elements
- Provide alt text for images and descriptive text for icons

## Common Patterns
- Provider pattern for context-based state sharing (see `apps/web/src/providers/`)
- Custom hooks for reusable logic extraction
- Feature-folder organization for scalability
- tRPC React Query hooks for all server communication
