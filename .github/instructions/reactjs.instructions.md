---
description: 'React + TypeScript + tRPC development standards for web app'
applyTo: 'apps/web/**/*.tsx, apps/web/**/*.ts, apps/web/**/*.css'
---

# React Development Instructions

Instructions for building the web app with React 18, TypeScript, Vite, and tRPC following modern best practices.

## Project Context
- React 18 with TypeScript
- Vite as build tool
- Functional components with hooks as default
- tRPC + React Query for all server communication
- Feature-based folder organization under apps/web/src/features/

## Development Standards

### Architecture
- Use functional components with hooks as the primary pattern
- Implement component composition over inheritance
- Organize components by feature: apps/web/src/features/<feature>/<Component>.tsx
- Separate presentational and container components clearly
- Use custom hooks for reusable stateful logic
- Implement proper component hierarchies with clear data flow

### TypeScript Integration
- Use TypeScript interfaces for props, state, and component definitions
- Define proper types for event handlers and refs
- Implement generic components where appropriate
- Use strict mode in tsconfig.json for type safety
- Import shared types from @repo/types — never redefine them locally
- Create union types for component variants and states

### Component Design
- Follow the single responsibility principle for components
- Use descriptive and consistent naming conventions (PascalCase for components)
- Implement proper prop validation with TypeScript interfaces
- Design components to be testable and reusable
- Keep components small and focused on a single concern
- Use composition patterns (render props, children as functions)

### State Management
- Use `useState` for local component state
- Implement `useReducer` for complex state logic
- Leverage `useContext` for sharing state across component trees
- Use tRPC + React Query for all server state — never use raw fetch or axios
- Import `trpc` from apps/web/src/providers/trpc.tsx
- Usage pattern: trpc.routerName.procedureName.useQuery() / .useMutation()

### Hooks and Effects
- Use `useEffect` with proper dependency arrays to avoid infinite loops
- Implement cleanup functions in effects to prevent memory leaks
- Use `useMemo` and `useCallback` for performance optimization when needed
- Create custom hooks for reusable stateful logic
- Follow the rules of hooks (only call at the top level)
- Use `useRef` for accessing DOM elements and storing mutable values

### Styling
- Use inline styles with style={{ }} for simple components
- Implement responsive design with mobile-first approach
- Implement consistent spacing, typography, and color systems
- Ensure accessibility with proper ARIA attributes and semantic HTML

### Performance Optimization
- Use `React.memo` for component memoization when appropriate
- Implement code splitting with `React.lazy` and `Suspense`
- Optimize bundle size with tree shaking and dynamic imports
- Use `useMemo` and `useCallback` judiciously to prevent unnecessary re-renders
- Profile components with React DevTools to identify performance bottlenecks

### Data Fetching
- Use tRPC React Query hooks for all API communication
- Implement proper loading, error, and success states
- Handle race conditions and request cancellation
- Use optimistic updates for better user experience
- Auth token is stored in localStorage under the key "auth-token"
- API endpoint: http://localhost:3000/trpc

### Error Handling
- Implement Error Boundaries for component-level error handling
- Use proper error states in tRPC queries and mutations
- Implement fallback UI for error scenarios
- Log errors appropriately for debugging
- Handle async errors in effects and event handlers
- Provide meaningful error messages to users

### Forms and Validation
- Use controlled components for form inputs
- Handle form submission and error states appropriately
- Implement accessibility features for forms (labels, ARIA attributes)

### Testing
- Write unit tests for components using React Testing Library
- Test component behavior, not implementation details
- Mock tRPC calls appropriately in tests
- Test accessibility features and keyboard navigation

### Security
- Sanitize user inputs to prevent XSS attacks
- Validate and escape data before rendering
- Use HTTPS for all external API calls
- Implement proper authentication and authorization patterns
- Use Content Security Policy (CSP) headers

### Accessibility
- Use semantic HTML elements appropriately
- Implement proper ARIA attributes and roles
- Ensure keyboard navigation works for all interactive elements
- Provide alt text for images and descriptive text for icons
- Implement proper color contrast ratios

## Implementation Process
1. Plan component architecture and data flow
2. Define TypeScript interfaces and types in @repo/types
3. Implement core components in apps/web/src/features/<feature>/
4. Add tRPC hooks for data fetching
5. Implement error handling and loading states
6. Add testing coverage
7. Ensure accessibility compliance

## Common Patterns
- Provider pattern for context-based state sharing (see apps/web/src/providers/)
- Custom hooks for reusable logic extraction
- Feature-folder organization for scalability
- tRPC React Query hooks for all server communication
