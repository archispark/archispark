---
paths:
  - "apps/web/**"
  - "packages/ui/**"
---

# Frontend conventions (`apps/web`, `packages/ui`)

- **Never call `fetch` directly in a component.** Go through the typed
  wrappers in `apps/web/lib/api.ts` (`get`/`post`/`put`/`del` —
  `credentials: "include"`, errors parsed via `err.detail`), then wrap
  those in `apps/web/lib/queries.ts` as `useQuery`/`useMutation` hooks
  using the shared `queryKeys` object. State management is TanStack
  React Query — no Zustand/Redux/global context for server state.
- **Mutations give toast feedback.** Call `toast.success`/`toast.error`
  (sonner) in `onSuccess`/`onError` — a mutation without toast feedback
  looks unfinished in this codebase even though lint won't catch it.
- **Create/edit dialogs use the shared `useFormModal<T>()` hook**
  (`apps/web/hooks/use-form-modal.ts`), which standardizes `open`,
  `target`, `error`, `isPending` state and a `run(fn)` wrapper. Reuse
  it instead of hand-rolling modal state — it's already the pattern in
  6+ page components (settings, elements, relationships, views,
  workspace-settings).
- **Naming**: kebab-case filenames (`data-table.tsx`), colocated
  `*.test.tsx`, named function exports for components (not default
  exports).
- **Styling**: Tailwind only, no CSS modules. Always merge classes
  through `cn()` (`@workspace/ui/lib/utils`, `clsx` + `tailwind-merge`)
  rather than string concatenation; use `cva` (class-variance-authority)
  for variants.
- **UI primitives are built on `@base-ui/react`**, not Radix/shadcn
  defaults — components use `data-slot` attributes for styling hooks.
