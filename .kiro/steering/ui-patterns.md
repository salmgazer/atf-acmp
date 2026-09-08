---
inclusion: fileMatch
fileMatchPattern: "**/*.tsx"
---

# UI Patterns & Components

## Design System Reference

See #[[file:../DESIGN_SYSTEM.md]] for colors, typography, and spacing.

## Component Library

Use **shadcn/ui** (new-york style) with Lucide icons:
- Import from `@/components/ui/*`
- Use `cn()` utility for conditional classes
- Follow existing component patterns

## Layout Patterns

### Desktop Layouts (Staff & Organization Portals)

```tsx
// Sidebar + Main content
<div className="flex min-h-screen">
  <Sidebar className="w-64 border-r" />
  <main className="flex-1 p-6">{children}</main>
</div>
```

### Mobile-First Layouts (Participant & Mentor Portals)

```tsx
// Main content + Bottom nav
<div className="flex min-h-screen flex-col">
  <header className="sticky top-0 z-10 border-b bg-background px-4 py-3">
    {/* Mobile header */}
  </header>
  <main className="flex-1 px-4 pb-20">{children}</main>
  <BottomNav className="fixed bottom-0 left-0 right-0" />
</div>
```

### Split-Screen Login (All Portals - Desktop)

```tsx
<div className="grid min-h-screen lg:grid-cols-2">
  {/* Left: Illustration (hidden on mobile) */}
  <div className="hidden lg:flex items-center justify-center bg-muted">
    <Image src="/illustrations/portal-specific.svg" />
  </div>
  {/* Right: Form */}
  <div className="flex items-center justify-center p-8">
    <Card className="w-full max-w-md">{/* Login form */}</Card>
  </div>
</div>
```

## Navigation Patterns

### Bottom Navigation (Mobile - Participant/Mentor)

```tsx
const navItems = [
  { icon: Home, label: "Home", href: "/app/dashboard" },
  { icon: FileText, label: "Briefs", href: "/app/briefs" },
  { icon: Users, label: "Team", href: "/app/team" },
  { icon: MessageSquare, label: "Chat", href: "/app/chat" },
  { icon: Menu, label: "More", href: "#more" },
];
```

### Sidebar Navigation (Desktop - Staff/Org)

- Use collapsible sidebar with icons
- Active state: `bg-accent text-accent-foreground`
- Hover state: `hover:bg-accent/50`

## Form Patterns

### Standard Form Layout

```tsx
<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="field">Field Label *</Label>
    <Input id="field" {...register("field")} />
    {errors.field && (
      <p className="text-sm text-destructive">{errors.field.message}</p>
    )}
  </div>
  <Button type="submit" className="w-full">Submit</Button>
</form>
```

### Mobile Form Considerations

- Full-width inputs on mobile
- Larger touch targets (min 44px height)
- Sticky submit button at bottom for long forms

## Card Patterns

### Team/Brief Card

```tsx
<Card className="hover:shadow-md transition-shadow">
  <CardHeader className="pb-2">
    <CardTitle className="text-lg">{title}</CardTitle>
    <CardDescription>{subtitle}</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter className="justify-end gap-2">
    <Button variant="ghost" size="sm">View</Button>
    <Button size="sm">Action</Button>
  </CardFooter>
</Card>
```

## Status Badges

```tsx
const statusColors = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
};

<Badge className={statusColors[status]}>{status}</Badge>
```

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |

## Accessibility

- All interactive elements must have visible focus states
- Use `sr-only` for screen reader text
- Ensure 4.5:1 contrast ratio minimum
- Touch targets: 44x44px minimum on mobile
