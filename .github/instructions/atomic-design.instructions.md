---
applyTo: '**/*.jsx, **/*.tsx, **/*.js, **/*.ts, **/*.css, **/*.scss'
description: 'Atomic Design methodology for organizing React components. Enforces strict rules for Atoms, Molecules, Organisms, Templates, and Pages — including what state, styling, and data-fetching each level is allowed.'
---

# Atomic Design Instructions for GitHub Copilot

## Overview

This project follows the **Atomic Design** methodology for organizing React components. All new components must conform to this architecture. The five levels of Atomic Design map directly to the folder structure and define strict rules about what each component can and cannot do.

---

## Folder Structure

```
src/
└── components/
    ├── atoms/
    ├── molecules/
    ├── organisms/
    ├── templates/
    └── pages/
```

Each component lives in its own folder with the following files:

```
components/atoms/Button/
├── index.jsx        # Component
├── styles.css       # Scoped CSS (CSS Modules + BEM)
└── stories.jsx      # Storybook stories
```

---

## The Five Levels

### 1. Atoms (`components/atoms/`)

The smallest, most primitive UI elements.

**Examples:** `Button`, `Input`, `Label`, `Icon`, `Typography`, `Badge`

**Rules:**
- Must be completely **stateless** (no internal state, no side effects)
- **No margins or position styles** — layout is the responsibility of their parent
- Must accept all relevant HTML attributes via props (e.g., `disabled`, `type`, `aria-*`)
- Must handle all visual states (hover, focus, disabled, loading, error) via props
- Must be usable in any context without modification

```jsx
// ✅ Correct atom — no margins, no positions, pure UI
const Button = ({ children, variant = 'primary', disabled, onClick }) => (
  <button className={`btn btn--${variant}`} disabled={disabled} onClick={onClick}>
    {children}
  </button>
);

// ❌ Wrong — atoms must not have margins or positions
const Button = ({ children }) => (
  <button style={{ marginTop: '16px' }}>{children}</button>
);
```

---

### 2. Molecules (`components/molecules/`)

Compositions of one or more atoms that form a functional unit.

**Examples:** `SearchBar`, `FormField`, `UserCard`, `NavLink`, `Notification`

**Rules:**
- Built **exclusively from atoms** (and other molecules if needed)
- May have **limited local state** only if it is purely UI-related (e.g., toggle open/closed)
- **Can set the position of atoms** within themselves, but must not apply external margins or positions to themselves
- Should be focused on a **single responsibility**
- Must not be tied to any specific page or business domain

```jsx
// ✅ Correct molecule — positions its atoms, no external positioning
const SearchBar = ({ onSearch }) => (
  <div className="search-bar">
    <Input placeholder="Search..." className="search-bar__input" />
    <Button onClick={onSearch} className="search-bar__button">Search</Button>
  </div>
);
```

---

### 3. Organisms (`components/organisms/`)

Complex UI sections assembled from molecules and/or atoms.

**Examples:** `Header`, `Footer`, `ProductGrid`, `CommentSection`, `Sidebar`

**Rules:**
- Composed of **molecules and/or atoms**
- May connect to **application state** (e.g., Redux, Context, hooks) for data fetching
- Must still be **independent and portable** — they should work in any page context
- **Cannot set their own external margins or positions**
- Should represent a distinct, self-contained section of the UI

```jsx
// ✅ Correct organism — uses molecules, may fetch or receive data
const Header = ({ user }) => (
  <header className="header">
    <Logo />
    <NavMenu links={navLinks} />
    <UserMenu user={user} />
  </header>
);
```

---

### 4. Templates (`components/templates/`)

Page-level layout definitions. They define **where** things go, not **what** they are.

**Examples:** `TwoColumnLayout`, `DashboardLayout`, `AuthLayout`

**Rules:**
- Define **grid and layout structure** only — no real content, colors, or styles beyond positioning
- Accept organisms and other components as **children or named slots (props)**
- Must have **no business logic** and **no data fetching**
- Think of them as wireframes — they only define the skeleton of a page

```jsx
// ✅ Correct template — pure layout, no content or business logic
const TwoColumnLayout = ({ sidebar, main }) => (
  <div className="layout layout--two-column">
    <aside className="layout__sidebar">{sidebar}</aside>
    <main className="layout__main">{main}</main>
  </div>
);
```

---

### 5. Pages (`components/pages/`)

The actual route-level screens of the application.

**Examples:** `HomePage`, `ProductPage`, `LoginPage`, `DashboardPage`

**Rules:**
- Render organisms inside a **template**
- Are the **only level** that should connect to routing, URL params, and global app state
- Responsible for passing real data down to organisms and molecules
- This is where Atomic Design meets the rest of the application (routing, API calls, auth)

```jsx
// ✅ Correct page — connects template, organisms, and real data
const ProductPage = () => {
  const { id } = useParams();
  const product = useProduct(id);

  return (
    <DefaultLayout
      header={<Header />}
      main={<ProductDetail product={product} />}
      sidebar={<RelatedProducts productId={id} />}
    />
  );
};
```

---

## Shared Variables

A shared variables file must exist and be imported by every component that uses design tokens.

```
src/
└── styles/
    └── variables.css   # or variables.js / tokens.js
```

```css
/* variables.css */
:root {
  --color-primary: #0070f3;
  --color-text: #111;
  --font-size-base: 16px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --border-radius: 4px;
}
```

---

## Storybook

Every component must have a `stories.jsx` file. Each story should represent a **single, distinct state** of the component. Do not combine multiple states into one story.

```jsx
// Button/stories.jsx
export default {
  title: 'Atoms/Button',
  component: Button,
};

export const Primary = () => <Button variant="primary">Click me</Button>;
export const Disabled = () => <Button variant="primary" disabled>Disabled</Button>;
export const Secondary = () => <Button variant="secondary">Secondary</Button>;
```

---

## Rules Summary

| Level | Can use | Has margins/position | Business logic | Data fetching |
|---|---|---|---|---|
| Atom | HTML only | ❌ No | ❌ No | ❌ No |
| Molecule | Atoms | ✅ For children only | ❌ No | ❌ No |
| Organism | Molecules + Atoms | ✅ For children only | ✅ Limited | ✅ Yes |
| Template | Any component | ✅ Layout only | ❌ No | ❌ No |
| Page | Template + Organisms | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Checklist Before Creating a New Component

- [ ] Have I identified the correct level (Atom / Molecule / Organism / Template / Page)?
- [ ] Is the component generic enough to be reused in other contexts?
- [ ] Does it avoid hardcoded margins or positions (unless it's a Template or Page)?
- [ ] Does it import from `variables.css` for all design tokens?
- [ ] Does it have a `stories.jsx` with all key states covered?
- [ ] Is it stateless or does it only hold UI-specific state?

---

## References

- [Atomic Web Design – Brad Frost](https://bradfrost.com/blog/post/atomic-web-design/)
- [React Atomic Design Boilerplate](https://github.com/danilowoz/react-atomic-design)
- [Storybook](https://storybook.js.org/)
