# BucketTableNew - Extensible Cell Architecture

## 📋 Overview

BucketTableNew is a sophisticated, extensible table component for displaying and editing bucket data. It uses a **Strategy Pattern + Registry Pattern** architecture to handle different cell types independently and efficiently.

## 🏗️ Architecture

### Core Principles

1. **Separation of Concerns**: Each cell type is completely independent
2. **Open/Closed Principle**: Easy to extend without modifying existing code
3. **Single Responsibility**: Each component has one clear job
4. **Type Safety**: Full TypeScript support with proper typing

### Component Hierarchy

```
BucketTableNew (Main Component)
    ↓
Table (Generic Table Component from oziko-ui-kit)
    ↓
EditableCell (Coordination Layer)
    ↓
Cell Registry (Factory/Router)
    ↓
Individual Cell Components (StringCell, NumberCell, etc.)
```

## 📁 File Structure

```
bucket-table-new/
├── BucketTableNew.tsx          # Main component
├── EditableCell.tsx             # Coordination wrapper
├── cellRegistry.ts              # Factory for cell types
├── types.ts                     # TypeScript definitions
├── cells/
│   ├── BaseCellRenderer.tsx     # Common wrapper
│   ├── StringCell.tsx           # String input cell
│   ├── NumberCell.tsx           # Number input cell
│   ├── TextareaCell.tsx         # Multiline text cell
│   ├── DateCell.tsx             # Date picker cell
│   ├── RelationCell.tsx         # Relation modal cell
│   ├── BooleanCell.tsx          # Checkbox cell
│   ├── DefaultCell.tsx          # Fallback for unknown types
│   └── index.ts                 # Cell exports
└── README.md                    # This file
```

## 🚀 How It Works

### 1. Column Generation

`BucketTableNew` reads the bucket schema and dynamically generates columns:

```typescript
// Bucket schema properties → Table columns
properties: {
  title: { type: "string", ... },
  age: { type: "number", ... }
}

// Becomes columns:
[
  { key: "title", header: "Title", renderCell: ... },
  { key: "age", header: "Age", renderCell: ... }
]
```

### 2. Cell Rendering

Each cell is wrapped in `EditableCell`, which:
- Manages focus state
- Handles keyboard events
- Routes to the correct cell component via the registry

### 3. Keyboard Handling

Each cell type defines its own keyboard behavior:

**String Cell:**
- Any typing → Enter edit mode
- Enter → Save and blur
- Escape → Cancel and blur

**Relation Cell:**
- Enter → Open modal
- Escape → Close modal/blur

**Boolean Cell:**
- Space/Enter → Toggle value

### 4. Data Saving

When a cell value changes:
1. Cell component calls `onChange`
2. `EditableCell` propagates to `onValueChange`
3. `BucketTableNew` calls `onDataChange` prop
4. Parent component (`Bucket.tsx`) sends PATCH request to backend

## 🎨 Adding a New Cell Type

To add support for a new property type (e.g., "color"):

### Step 1: Create Cell Component

Create `cells/ColorCell.tsx`:

```typescript
import React, { useState } from "react";
import type { CellRendererProps, CellKeyboardHandler } from "../types";
import { BaseCellRenderer } from "./BaseCellRenderer";

export const ColorCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur,
}) => {
  // Your color picker implementation
  return (
    <BaseCellRenderer isFocused={isFocused}>
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
      />
    </BaseCellRenderer>
  );
};

export const ColorCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    if (event.key === "Enter") {
      // Open color picker
      return true;
    }
    return false;
  }
};
```

### Step 2: Register in Cell Registry

Update `cellRegistry.ts`:

```typescript
import { ColorCell, ColorCellKeyboardHandler } from "./cells/ColorCell";

// In registerDefaults():
this.register("color", {
  component: ColorCell,
  keyboardHandler: ColorCellKeyboardHandler,
  defaultValue: "#000000",
});
```

### Step 3: Update Types (Optional)

Add to `types.ts`:

```typescript
export type BucketPropertyType = 
  | "string" 
  | "textarea" 
  | "number" 
  | "date" 
  | "relation"
  | "boolean"
  | "array"
  | "object"
  | "color"; // Add your new type
```

**That's it!** No changes to `BucketTableNew` or any other components needed.

## 🔑 Key Features

### 1. Keyboard Navigation
- Arrow keys navigate between cells
- Cell focus is visually indicated
- Each cell type handles its own input keys

### 2. Edit Modes
Cells have two modes:
- **View Mode**: Display value (default)
- **Edit Mode**: Active input (triggered by keyboard)

### 3. Data Persistence
- Changes are automatically saved to backend
- Optimistic UI updates
- Error handling (in parent component)

### 4. Column Resizing
- Users can resize columns
- Width preferences saved to localStorage
- Per-bucket storage key

## 📊 State Management

### Component State
- `BucketTableNew`: Manages columns generation
- `EditableCell`: Manages edit mode
- Individual Cells: Manage their internal state (e.g., input value)

### Focus Management
- Table component tracks focused cell
- `EditableCell` receives focus state as prop
- Cell components react to focus changes

## 🎯 Props API

### BucketTableNew Props

```typescript
interface BucketTableNewProps {
  bucket: BucketSchema;        // Bucket schema with properties
  data: BucketDataRow[];       // Array of data rows
  onDataChange?: (             // Callback for data changes
    rowId: string, 
    propertyKey: string, 
    newValue: any
  ) => void;
}
```

### CellRendererProps

```typescript
interface CellRendererProps {
  value: any;                  // Current cell value
  onChange: (newValue: any) => void;  // Value change handler
  property: BucketProperty;    // Property schema
  propertyKey: string;         // Property key
  rowId: string;               // Row identifier
  isFocused: boolean;          // Focus state
  onRequestBlur: () => void;   // Blur handler
}
```

## 🧪 Testing Strategy

### Unit Tests
- Test each cell component independently
- Test keyboard handlers in isolation
- Test cell registry operations

### Integration Tests
- Test column generation from schema
- Test keyboard navigation flow
- Test data save flow

### E2E Tests
- Test complete edit workflow
- Test different property types
- Test error scenarios

## 🔧 Troubleshooting

### Cell Not Responding to Keyboard
- Check if cell's keyboard handler is registered
- Verify focus state is passed correctly
- Check for event propagation issues

### Data Not Saving
- Verify `onDataChange` prop is passed
- Check backend API response
- Review console for errors

### Column Not Rendering
- Check bucket schema structure
- Verify property type is registered
- Check for type mismatches

## 📝 Best Practices

1. **Keep Cells Independent**: Don't share state between cell types
2. **Use BaseCellRenderer**: Provides consistent wrapper
3. **Handle Edge Cases**: Null values, empty strings, etc.
4. **Stop Event Propagation**: In input handlers to prevent table navigation
5. **Use TypeScript**: Leverage type safety
6. **Document Complex Logic**: Especially in keyboard handlers

## 🚦 Future Enhancements

Potential improvements:
- [ ] Cell validation
- [ ] Undo/redo functionality
- [ ] Bulk edit mode
- [ ] Copy/paste support
- [ ] Cell templates
- [ ] Async validation
- [ ] Rich text editor cell
- [ ] File upload cell
- [ ] Multi-select cell

## 📚 References

- **Design Patterns**: Strategy Pattern, Registry Pattern, Factory Pattern
- **React Patterns**: Composition, Render Props, Custom Hooks
- **SOLID Principles**: Especially Open/Closed and Single Responsibility

---

**Created by**: Senior Software Architecture Team
**Last Updated**: 2025

