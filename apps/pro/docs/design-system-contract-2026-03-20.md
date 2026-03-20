# Usan Design System Contract

Date: 2026-03-20  
Scope: `C:\Users\admin\Projects\usan\apps\pro`  
Related roadmap: `C:\Users\admin\Projects\usan\apps\pro\ROADMAP.md`

## 1. Purpose

This document defines the minimum design-system contract required before the product grows broader.

It exists to stop:

- token drift between screens
- inline styling becoming the default implementation model
- different teams inventing different visual languages inside one shell

## 2. Design System Goals

- one semantic token language
- one shell grammar
- one state grammar
- one motion budget
- one primitive inventory

The contract should support both:

- beginner-friendly clarity
- power-user density

## 3. Semantic Token Layers

### Surface tokens

- `bg-base`
- `bg-surface`
- `bg-elevated`
- `bg-overlay`
- `bg-hover`
- `bg-active`

### Text tokens

- `text-primary`
- `text-secondary`
- `text-tertiary`
- `text-muted`
- `text-inverse`

### Border tokens

- `border-subtle`
- `border-default`
- `border-strong`
- `border-focus`
- `border-danger`

### Action tokens

- `accent`
- `accent-soft`
- `success`
- `warning`
- `danger`
- `focus-ring`

### Shape tokens

- `radius-xs`
- `radius-sm`
- `radius-md`
- `radius-lg`
- `radius-xl`

### Elevation tokens

- `shadow-1`
- `shadow-2`
- `shadow-3`
- `shadow-4`

### Layout tokens

- `titlebar-height`
- `nav-rail-width`
- `sidebar-width`
- `context-panel-width`
- `utility-panel-height`
- `composer-min-height`
- `composer-max-height`

## 4. Spacing Scale

Use one shared spacing scale:

- `4`
- `8`
- `12`
- `16`
- `20`
- `24`
- `32`
- `40`

Rules:

- dense surfaces should still align to the same scale
- avoid one-off pixel values unless the shell contract requires it

## 5. Typography Contract

The type system should feel desktop-native and operational.

Recommended structure:

- title bar label
- navigation label
- section heading
- primary body
- secondary body
- metadata
- code and mono

Rules:

- metadata should stay readable at compact sizes
- long titles must truncate gracefully
- code, logs, and diffs use a stable mono face

## 6. Primitive Inventory

These primitives must exist before broader feature work expands:

- shell container
- title bar
- nav item
- list row
- command palette
- composer
- panel header
- panel tabs
- artifact card
- diff block
- terminal view
- approval card
- callout
- empty state
- error state
- skeleton state

## 7. State Matrix

Every primitive should support a shared state vocabulary:

- default
- hover
- selected
- focused
- active
- running
- success
- warning
- danger
- disabled

Rules:

- hover is never the only state signal
- focus must be keyboard-visible
- selected and active should not look identical

## 8. Motion Tokens

### Durations

- `dur-micro`: `80ms` to `140ms`
- `dur-panel`: `160ms` to `220ms`
- `dur-overlay`: `180ms` to `260ms`

### Easings

- `ease-standard`
- `ease-swift-enter`
- `ease-symmetric`

### Motion rules

- use opacity, translate, and subtle scale first
- no decorative loop in dense work surfaces
- reduced motion must disable non-essential animation

## 9. Theme Rules

The product must support both:

- dark theme
- light theme

Rules:

- token names stay the same across themes
- only values change
- state contrast must remain valid in both themes

## 10. Implementation Rules

- primitives first
- semantic tokens first
- avoid inline colors and ad hoc shadows
- avoid per-screen one-off component variants when a shared primitive should exist

Migration rule:

- current inline-styled shell components should be gradually replaced by tokenized primitives instead of being extended indefinitely

## 11. Visual QA Requirements

Each milestone should review:

- title bar
- nav
- workspace
- artifact view
- settings
- command palette
- error state
- empty state

Review these in:

- dark theme
- light theme
- reduced motion
- dense realistic content

## 12. Acceptance Checklist

- Every shell zone uses the same semantic token language
- New screens do not invent separate shadow or border systems
- Shared primitives are reused instead of copied
- Focus, selection, and running states are visually distinct
- Both themes remain coherent
- Reduced motion preserves clarity without breaking hierarchy

## 13. Research Inputs

External references:

- Microsoft Windows design:
  - `https://learn.microsoft.com/windows/apps/design/`

Local references:

- `D:\AI-Apps\_extracted\11-vercel-animations.css`
- `D:\AI-Apps\_extracted\13-supabase-animations.css`
- `D:\AI-Apps\_extracted\14-framer-effects.css`
- `D:\AI-Apps\_extracted\15-resend-effects.css`
