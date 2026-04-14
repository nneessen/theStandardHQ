# Comprehensive UI Styling Guide

This guide consolidates all styling patterns for maintaining consistency across the application. **Read this before styling any component.**

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Typography & Sizing](#typography--sizing)
3. [Color System](#color-system)
4. [Page Layouts](#page-layouts)
5. [Tables](#tables)
6. [Dialogs & Modals](#dialogs--modals)
7. [Alerts & Notifications](#alerts--notifications)
8. [Forms & Inputs](#forms--inputs)
9. [Buttons](#buttons)
10. [Badges & Tags](#badges--tags)
11. [Cards & Containers](#cards--containers)
12. [Dropdown Menus](#dropdown-menus)
13. [Tabs](#tabs)
14. [Empty States](#empty-states)
15. [Component Variants](#component-variants)
16. [Reference Files](#reference-files)

---

## Core Philosophy

### COMPACT AND DATA-DENSE
This is a **professional business application**, not a consumer app. Think Bloomberg Terminal, Excel, IDE editors - every pixel should serve a purpose.

### Key Rules
- **GO SMALLER** when in doubt
- No wasted whitespace
- No nested cards (use divs with borders instead)
- No placeholder UI - everything must be functional
- Use tables for lists, not card grids
- Inline stats in headers instead of stat cards

---

## Typography & Sizing

### Text Sizes

| Context | Size | Usage |
|---------|------|-------|
| Page titles | `text-sm` (14px) | Main header text |
| Section headers | `text-[11px]` | Uppercase, tracking-wide |
| Body text | `text-[11px]` | Primary content |
| Secondary text | `text-[10px]` | Metadata, timestamps |
| Tiny labels | `text-[9px]` | Badge text, minor annotations |

### Component Heights

| Component | Height | Notes |
|-----------|--------|-------|
| Page header | `py-2` | Compact header bar |
| Table headers | `h-8` | Sticky headers |
| Table rows | `py-1.5` | Dense row spacing |
| Inputs | `h-7` | Compact input fields |
| Buttons (primary) | `h-6` or `h-7` | Small buttons |
| Icon buttons | `h-5 w-5` or `h-6 w-6` | Square icon buttons |
| Badges | `h-4` or `h-3.5` | Inline badges |

### Icons

| Context | Size |
|---------|------|
| In buttons | `h-3 w-3` |
| In headers | `h-4 w-4` |
| In tiny buttons | `h-2.5 w-2.5` |
| In badges | `h-2 w-2` |
| Empty states | `h-8 w-8` |

### Spacing

| Context | Value |
|---------|-------|
| Page padding | `p-3` |
| Section spacing | `space-y-2.5` |
| Grid gaps | `gap-2.5` |
| Card padding | `p-2` or `p-3` |
| Button groups | `gap-1` or `gap-1.5` |
| Form fields | `space-y-1.5` |

---

## Color System

### Zinc Palette (Primary)

Always use explicit zinc values for consistent dark mode support:

```tsx
// Backgrounds
bg-zinc-50 dark:bg-zinc-950     // Page background
bg-white dark:bg-zinc-900       // Card/panel backgrounds
bg-zinc-100 dark:bg-zinc-800    // Secondary backgrounds
bg-zinc-50 dark:bg-zinc-800/50  // Subtle backgrounds

// Text
text-zinc-900 dark:text-zinc-100   // Primary text
text-zinc-600 dark:text-zinc-400   // Secondary text
text-zinc-500 dark:text-zinc-400   // Muted text
text-zinc-400 dark:text-zinc-500   // Disabled/subtle text

// Borders
border-zinc-200 dark:border-zinc-800   // Primary borders
border-zinc-100 dark:border-zinc-800/50 // Subtle borders
border-zinc-300 dark:border-zinc-700   // Emphasized borders

// Dividers
bg-zinc-200 dark:bg-zinc-700  // Vertical/horizontal dividers
```

### Semantic Colors

```tsx
// Success (Green)
bg-emerald-50 dark:bg-emerald-950/30
text-emerald-700 dark:text-emerald-400
border-emerald-200 dark:border-emerald-800

// Warning (Amber)
bg-amber-50 dark:bg-amber-950/30
text-amber-700 dark:text-amber-400
border-amber-200 dark:border-amber-800

// Error/Destructive (Red)
bg-red-50 dark:bg-red-950/30
text-red-700 dark:text-red-400
border-red-200 dark:border-red-800

// Info (Blue)
bg-blue-50 dark:bg-blue-950/30
text-blue-700 dark:text-blue-400
border-blue-200 dark:border-blue-800
```

---

## Page Layouts

### Main Page Container

```tsx
<div className="h-[calc(100vh-4rem)] flex flex-col p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-950">
  {/* Header */}
  {/* Content */}
</div>
```

### Compact Header with Inline Stats

```tsx
<div className="flex items-center justify-between bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-800">
  <div className="flex items-center gap-5">
    {/* Title */}
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
      <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Page Title
      </h1>
    </div>

    {/* Inline Stats */}
    <div className="flex items-center gap-3 text-[11px]">
      <div className="flex items-center gap-1">
        <StatIcon className="h-3 w-3 text-emerald-500" />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">42</span>
        <span className="text-zinc-500 dark:text-zinc-400">items</span>
      </div>
      <div className="h-3 w-px bg-zinc-200 dark:bg-zinc-700" />
      <div className="flex items-center gap-1">
        <OtherIcon className="h-3 w-3 text-blue-500" />
        <span className="font-medium text-zinc-900 dark:text-zinc-100">8</span>
        <span className="text-zinc-500 dark:text-zinc-400">pending</span>
      </div>
    </div>
  </div>

  {/* Action Button */}
  <Button size="sm" className="h-6 px-2 text-[10px]">
    <Plus className="h-3 w-3 mr-1" />
    Add New
  </Button>
</div>
```

### Section Headers (Uppercase Label)

```tsx
<h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
  Section Title
</h2>
```

---

## Tables

### Complete Table Pattern

```tsx
<div className="flex-1 overflow-hidden bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
  <div className="h-full overflow-auto">
    <Table>
      <TableHeader className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/50 z-10">
        <TableRow className="border-b border-zinc-200 dark:border-zinc-800 hover:bg-transparent">
          <TableHead className="h-8 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
            Column Name
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800/50">
          <TableCell className="py-1.5">
            <span className="text-[11px] text-zinc-900 dark:text-zinc-100">
              Cell content
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</div>
```

### Table Cell Patterns

```tsx
// Primary text
<span className="text-[11px] text-zinc-900 dark:text-zinc-100">Content</span>

// Secondary/metadata
<span className="text-[10px] text-zinc-500 dark:text-zinc-400">Metadata</span>

// Cell with avatar
<div className="flex items-center gap-2">
  <Avatar className="h-6 w-6">
    <AvatarFallback className="text-[9px]">JD</AvatarFallback>
  </Avatar>
  <div>
    <p className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100">Name</p>
    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">email@example.com</p>
  </div>
</div>

// Action buttons cell
<div className="flex items-center gap-1">
  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]">
    <Edit className="h-2.5 w-2.5 mr-0.5" />
    Edit
  </Button>
</div>
```

---

## Dialogs & Modals

### Compact Dialog

```tsx
<Dialog>
  <DialogContent className="max-w-sm p-3">
    <DialogHeader className="space-y-1">
      <DialogTitle className="text-sm font-semibold">
        Dialog Title
      </DialogTitle>
      <DialogDescription className="text-[10px]">
        Brief description of what this dialog does.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-3 py-2">
      {/* Form content */}
    </div>

    <DialogFooter className="gap-1.5 pt-2">
      <Button variant="outline" size="sm" className="h-7 text-[11px]">
        Cancel
      </Button>
      <Button size="sm" className="h-7 text-[11px]">
        Save
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Dialog Widths

| Type | Width | Use Case |
|------|-------|----------|
| Small | `max-w-sm` | Simple forms, confirmations |
| Medium | `max-w-md` | Standard forms |
| Large | `max-w-lg` | Complex forms, multi-section |
| XL | `max-w-xl` | Tables, large content |

### Tabbed Dialog

```tsx
<DialogContent className="max-w-md p-3">
  <DialogHeader className="space-y-1">
    <DialogTitle className="text-sm font-semibold">Title</DialogTitle>
  </DialogHeader>

  <Tabs defaultValue="tab1" className="mt-2">
    <TabsList className="h-7 p-0.5 bg-zinc-100 dark:bg-zinc-800">
      <TabsTrigger value="tab1" className="h-6 text-[10px] px-2">
        Tab 1
      </TabsTrigger>
      <TabsTrigger value="tab2" className="h-6 text-[10px] px-2">
        Tab 2
      </TabsTrigger>
    </TabsList>

    <TabsContent value="tab1" className="mt-2 space-y-2">
      {/* Content */}
    </TabsContent>
  </Tabs>
</DialogContent>
```

---

## Alerts & Notifications

### Inline Alert

```tsx
// Success
<div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-md border border-emerald-200 dark:border-emerald-800">
  <div className="flex items-center gap-2">
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
      Success message here
    </p>
  </div>
</div>

// Warning
<div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800">
  <div className="flex items-center gap-2">
    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    <p className="text-[11px] text-amber-700 dark:text-amber-400">
      Warning message here
    </p>
  </div>
</div>

// Error
<div className="p-2 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
  <div className="flex items-center gap-2">
    <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
    <p className="text-[11px] text-red-700 dark:text-red-400">
      Error message here
    </p>
  </div>
</div>

// Info
<div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
  <div className="flex items-center gap-2">
    <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
    <p className="text-[11px] text-blue-700 dark:text-blue-400">
      Info message here
    </p>
  </div>
</div>
```

### Toast Notifications

Use the `showToast` utility:

```tsx
import { showToast } from "@/utils/toast";

showToast.success("Item saved successfully");
showToast.error("Failed to save item");
showToast.warning("This action cannot be undone");
showToast.info("New updates available");
```

---

## Forms & Inputs

### Standard Form Field

```tsx
<div className="space-y-1.5">
  <Label htmlFor="field" className="text-[11px] font-medium">
    Field Label *
  </Label>
  <Input
    id="field"
    placeholder="Enter value..."
    className="h-7 text-[11px]"
  />
</div>
```

### Select Field

```tsx
<div className="space-y-1.5">
  <Label className="text-[11px] font-medium">Select Option</Label>
  <Select>
    <SelectTrigger className="h-7 text-[11px]">
      <SelectValue placeholder="Choose..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="option1" className="text-[11px]">
        Option 1
      </SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Textarea

```tsx
<Textarea
  placeholder="Enter description..."
  className="text-[11px] resize-none min-h-[80px]"
/>
```

### Checkbox

```tsx
<div className="flex items-center gap-2">
  <Checkbox id="check" className="h-3.5 w-3.5" />
  <Label htmlFor="check" className="text-[11px] text-zinc-700 dark:text-zinc-300">
    Checkbox label
  </Label>
</div>
```

### Search Input

```tsx
<div className="relative w-56">
  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
  <Input
    type="text"
    placeholder="Search..."
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    className="h-7 pl-7 pr-7 text-[11px] bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
  />
  {query && (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6"
      onClick={() => setQuery("")}
    >
      <X className="h-3 w-3" />
    </Button>
  )}
</div>
```

---

## Buttons

### Size Reference

```tsx
// Primary (default)
<Button size="sm" className="h-7 text-[11px]">
  <Icon className="h-3 w-3 mr-1.5" />
  Button Text
</Button>

// Small
<Button size="sm" className="h-6 px-2 text-[10px]">
  <Icon className="h-3 w-3 mr-1" />
  Small
</Button>

// Tiny
<Button size="sm" className="h-5 px-1.5 text-[10px]">
  <Icon className="h-2.5 w-2.5 mr-0.5" />
  Tiny
</Button>

// Icon only
<Button variant="ghost" size="sm" className="h-6 w-6 p-0">
  <Icon className="h-3.5 w-3.5" />
</Button>
```

### Variants

```tsx
// Primary action
<Button size="sm" className="h-7 text-[11px]">Save</Button>

// Secondary action
<Button variant="outline" size="sm" className="h-7 text-[11px]">Cancel</Button>

// Danger action
<Button variant="destructive" size="sm" className="h-7 text-[11px]">Delete</Button>

// Ghost (toolbar)
<Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
  <Edit className="h-3 w-3 mr-1" />
  Edit
</Button>
```

---

## Badges & Tags

### Standard Badges

```tsx
// Default/neutral
<Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
  Label
</Badge>

// Outline
<Badge variant="outline" className="text-[9px] h-4 px-1 border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400">
  Label
</Badge>

// Success
<Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
  Active
</Badge>

// Warning
<Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
  Pending
</Badge>

// Error
<Badge className="text-[9px] h-4 px-1.5 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
  Failed
</Badge>
```

### Status Badges (with icon)

```tsx
<Badge className="text-[9px] h-3.5 px-1 bg-emerald-100 text-emerald-700">
  <CheckCircle2 className="h-2 w-2 mr-0.5" />
  Complete
</Badge>
```

---

## Cards & Containers

### Simple Container (No nested cards!)

```tsx
<div className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg">
  <h2 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
    Section Title
  </h2>
  {/* Content */}
</div>
```

### Info Box

```tsx
<div className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700">
  <p className="text-[11px] text-zinc-700 dark:text-zinc-300">
    Information text here
  </p>
</div>
```

### Contact Card

```tsx
<div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
  <Avatar className="h-7 w-7">
    <AvatarFallback className="text-[10px]">JD</AvatarFallback>
  </Avatar>
  <div className="flex-1 min-w-0">
    <div className="flex items-center gap-1.5">
      <p className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 truncate">
        John Doe
      </p>
      <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
        Role
      </Badge>
    </div>
    <div className="flex items-center gap-2 mt-0.5">
      <a href="mailto:email" className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline">
        <Mail className="h-2.5 w-2.5" />
        Email
      </a>
    </div>
  </div>
</div>
```

---

## Dropdown Menus

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
      <MoreVertical className="h-3.5 w-3.5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem className="text-[11px]">
      <Eye className="h-3.5 w-3.5 mr-1.5" />
      View
    </DropdownMenuItem>
    <DropdownMenuItem className="text-[11px]">
      <Edit className="h-3.5 w-3.5 mr-1.5" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem className="text-[11px] text-red-600">
      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Tabs

### Segment Tabs (Pill Style)

```tsx
<div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-md p-0.5">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-all ${
        activeTab === tab.id
          ? "bg-white dark:bg-zinc-900 shadow-sm text-zinc-900 dark:text-zinc-100"
          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
      }`}
    >
      <tab.icon className="h-3 w-3" />
      <span>{tab.label}</span>
    </button>
  ))}
</div>
```

---

## Empty States

```tsx
<div className="py-8 text-center">
  <FolderOpen className="h-8 w-8 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-0.5">
    No items found
  </p>
  <p className="text-[10px] text-zinc-500 dark:text-zinc-500">
    Click "Add New" to create one
  </p>
</div>
```

---

## Component Variants

### Standard Variant Names

Use consistently across Button, Badge, Alert:

| Variant | Purpose |
|---------|---------|
| `default` | Primary action |
| `secondary` | Secondary action |
| `destructive` | Dangerous action |
| `success` | Positive/confirm |
| `warning` | Caution |
| `outline` | Bordered, transparent |
| `ghost` | Minimal/toolbar |
| `muted` | Subtle background |
| `link` | Text link |

### Hover & Active States

```tsx
// Solid backgrounds
hover:bg-foreground/90
active:bg-foreground/80

// Ghost/transparent
hover:bg-accent hover:text-foreground
active:bg-accent/80

// Focus
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
```

---

## Reference Files

Use these as styling patterns:

| Component | Reference File |
|-----------|----------------|
| Page layouts | `src/features/training-hub/components/TrainingHubPage.tsx` |
| Tables | `src/features/admin/components/RoleManagementPage.tsx` |
| Dialogs | `src/features/admin/components/EditUserDialog.tsx` |
| Forms | `src/features/recruiting/components/UploadDocumentDialog.tsx` |
| Recruit pipeline | `src/features/recruiting/pages/MyRecruitingPipeline.tsx` |

---

## Common Mistakes to Avoid

1. **Large fonts** - Anything above `text-sm` (14px) for body elements
2. **Excessive padding** - More than `p-4` on containers
3. **Nested cards** - Never use `<Card>` inside another `<Card>`
4. **Default shadcn sizes** - Always override to be smaller
5. **Giant icons** - Icons should be `h-3` to `h-4` in most cases
6. **Missing dark mode** - Always add `dark:` variants
7. **Hardcoded colors** - Use zinc palette, not slate/gray

---

## Checklist Before Submitting

- [ ] All text is `text-[11px]` or smaller
- [ ] All buttons are `h-6` or `h-7`
- [ ] All inputs are `h-7`
- [ ] No nested Card components
- [ ] Dark mode variants for all colors
- [ ] Consistent icon sizes (`h-3 w-3` in buttons)
- [ ] Proper semantic colors for status badges
- [ ] Compact spacing (`p-3`, `gap-2`, `space-y-2`)
