# Atomic Design Instructions

> Apply to: `**/*.jsx`, `**/*.tsx`, `**/*.js`, `**/*.ts`, `**/*.css`, `**/*.scss`

This project follows the **Atomic Design** methodology for organizing React components. All new components must conform to this architecture.

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

Each component lives in its own folder:

```
components/atoms/Button/
├── index.jsx        # Component
├── styles.css       # Scoped CSS (CSS Modules + BEM)
└── stories.jsx      # Storybook stories
```

---

## The Five Levels

### 1. Atoms (`components/atoms/`)

The smallest, most primitive UI elements. Examples: `Button`, `Input`, `Label`, `Icon`, `Typography`, `Badge`

**Rules:**
- Must be completely **stateless** (no internal state, no side effects)
- **No margins or position styles** — layout is the responsibility of their parent
- Must accept all relevant HTML attributes via props
- Must handle all visual states (hover, focus, disabled, loading, error) via props

```jsx
// ✅ Correct — no margins, no positions, pure UI
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

### 2. Molecules (`components/molecules/`)

Compositions of atoms that form a functional unit. Examples: `SearchBar`, `FormField`, `UserCard`

**Rules:**
- Built **exclusively from atoms** (and other molecules if needed)
- May have **limited local state** only if it is purely UI-related (e.g., toggle open/closed)
- **Can set the position of atoms** within themselves, but must not apply external margins to themselves
- Must not be tied to any specific page or business domain

### 3. Organisms (`components/organisms/`)

Complex UI sections assembled from molecules and/or atoms. Examples: `Header`, `Footer`, `ProductGrid`

**Rules:**
- May connect to **application state** (e.g., Redux, Context, hooks) for data fetching
- Must still be **independent and portable** — work in any page context
- **Cannot set their own external margins or positions**

### 4. Templates (`components/templates/`)

Page-level layout definitions. Examples: `TwoColumnLayout`, `DashboardLayout`

**Rules:**
- Define **grid and layout structure** only — no real content, colors, or styles beyond positioning
- Accept organisms as **children or named slots (props)**
- Must have **no business logic** and **no data fetching**

### 5. Pages (`components/pages/`)

The actual route-level screens. Examples: `HomePage`, `ProductPage`, `LoginPage`

**Rules:**
- Render organisms inside a **template**
- Are the **only level** that should connect to routing, URL params, and global app state
- Responsible for passing real data down to organisms and molecules

---

## Shared Variables

A shared variables file must exist and be imported by every component that uses design tokens:

```
src/styles/variables.css
```

```css
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

## Rules Summary

| Level | Can use | Has margins/position | Business logic | Data fetching |
|---|---|---|---|---|
| Atom | HTML only | No | No | No |
| Molecule | Atoms | For children only | No | No |
| Organism | Molecules + Atoms | For children only | Limited | Yes |
| Template | Any component | Layout only | No | No |
| Page | Template + Organisms | Yes | Yes | Yes |

---

## Checklist Before Creating a New Component

- [ ] Have I identified the correct level (Atom / Molecule / Organism / Template / Page)?
- [ ] Is the component generic enough to be reused in other contexts?
- [ ] Does it avoid hardcoded margins or positions (unless it's a Template or Page)?
- [ ] Does it import from `variables.css` for all design tokens?
- [ ] Does it have a `stories.jsx` with all key states covered?
- [ ] Is it stateless or does it only hold UI-specific state?
