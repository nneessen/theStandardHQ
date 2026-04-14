# Modern Guide: Constructing TanStack Query Hooks (2026)

This guide defines **current best practices** for building client-side hooks with **TanStack Query v5+** in modern React applications (React 19+), with an emphasis on correctness, maintainability, and long-term scalability.

This is intentionally opinionated and optimized for **production systems**, not demos.

---

## 1. Core Principle: A Hook Represents an Intent

A custom hook should represent **one user or system intent**, not an entire workflow.

Examples of good intent boundaries:

- `useCreateRecruit()`
- `useSendInvitation()`
- `useUpdateAgentProfile()`

Bad intent boundaries:

- `useCreateRecruitAndSendEmailAndFetchProfile()`
- `useHandleFullSignupFlow()`

If multiple steps must happen together, they belong **server-side**.

---

## 2. What a Mutation _Should_ Do

A mutation hook should:

- Call **one backend action**
- Accept a **typed input object**
- Return **raw backend output**
- Handle **cache invalidation**
- Handle **UI-only side effects** (toasts, navigation)

A mutation hook should _not_:

- Fetch authenticated user context
- Read from multiple tables
- Send emails or notifications
- Perform transactional logic

---

## 3. Always Use Object Syntax (TanStack Query v5)

Correct:

```ts
useMutation({
  mutationFn,
  onSuccess,
  onError,
});
```

Incorrect / legacy:

```ts
useMutation(mutationFn, options);
```

Object syntax is now the **only future-proof API**.

---

## 4. Define a Named Input Type

Never inline complex mutation inputs.

```ts
type CreateRecruitInput = {
  email: string;
  firstName?: string;
  lastName?: string;
  uplineId?: string;
  sendEmail?: boolean;
};
```

Benefits:

- Reuse across client/server
- Easier validation
- Cleaner mutation signatures
- Better testability

---

## 5. Keep `mutationFn` Pure

The `mutationFn` should:

- Accept input
- Call a service
- Throw on failure
- Return data

Nothing else.

```ts
mutationFn: async (input: CreateRecruitInput) => {
  const result = await recruitService.create(input);

  if (!result.success) {
    throw new Error(result.message);
  }

  return result;
};
```

No toasts. No logging. No cache logic.

---

## 6. Throw Errors — Do Not Return Them

Always throw errors inside `mutationFn`.

Correct:

```ts
throw new Error("Failed to create recruit");
```

Incorrect:

```ts
return { error: true };
```

Thrown errors:

- Trigger `onError`
- Enable retries
- Integrate with error boundaries

---

## 7. Handle Side Effects in Lifecycle Callbacks

UI-related side effects belong **outside** `mutationFn`.

```ts
onSuccess: () => {
  toast.success("Recruit created");
},

onError: (error) => {
  toast.error(error.message);
},
```

Allowed side effects:

- Toasts
- Navigation
- Analytics
- Cache invalidation

---

## 8. Cache Invalidation: Be Explicit

Use structured query keys.

```ts
queryClient.invalidateQueries({ queryKey: ["recruits"] });
queryClient.invalidateQueries({ queryKey: ["pending-invitations"] });
```

Rules:

- Never use string concatenation
- Never invalidate everything
- Invalidate **only what changed**

---

## 9. Prefer Server-Orchestrated Workflows

If a mutation requires:

- Multiple DB writes
- Auth context
- Email delivery
- Notifications
- Rollback logic

It belongs on the server.

Client mutation:

```ts
mutationFn: (input) => api.createRecruitWithInvitation(input);
```

Server function:

- Runs transaction
- Resolves user identity
- Sends email
- Returns final result

---

## 10. One Hook, One Export

Each hook should:

- Live in its own file
- Export a single hook
- Have no conditional logic at module scope

```ts
export function useCreateRecruit() { ... }
```

Avoid grouped exports or shared mutable state.

---

## 11. Avoid Dynamic Imports Inside Hooks

Do **not** dynamically import services inside `mutationFn`.

Bad:

```ts
await import("@/services/supabase");
```

Good:

```ts
import { supabase } from "@/services/supabase";
```

Dynamic imports inside hooks:

- Obscure stack traces
- Break tree-shaking assumptions
- Rarely provide real performance gains

---

## 12. Keep Hooks Framework-Agnostic

Hooks should not depend on:

- UI components
- Form libraries
- Router implementations

This allows reuse across:

- Pages
- Modals
- Wizards
- Background actions

---

## 13. Prefer Composition Over Mega-Hooks

Instead of:

```ts
useFullRecruitFlow();
```

Prefer:

```ts
useCreateRecruit();
useSendInvitation();
useAssignUpline();
```

Compose them at the component or server level.

---

## 14. Naming Conventions

Follow predictable naming:

- `useCreateX`
- `useUpdateX`
- `useDeleteX`
- `useSendX`

Avoid vague names:

- `useHandleX`
- `useManageX`
- `useProcessX`

Intent clarity > brevity.

---

## 15. Testing Implications

Well-structured hooks:

- Are trivial to mock
- Have deterministic inputs
- Contain no hidden side effects

This is impossible if hooks perform orchestration.

---

## 16. Final Mental Model

**Client hooks declare intent.**
**Servers perform work.**
**TanStack Query manages state.**

If you follow this separation, your hooks will:

- Scale cleanly
- Be easy to refactor
- Survive framework churn
- Remain readable years later

---

End of guide.
