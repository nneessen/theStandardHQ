# User Creation Flow

This document describes the complete user creation flow, including database triggers, edge functions, and known failure modes.

## Flow Diagram

```
AddUserDialog.tsx
    |
    v (form data: email, first_name, last_name, roles, etc.)
AdminControlCenter.tsx (handleAddUser)
    |
    v (userData: NewUserData)
userService.create()
    |
    | 1. Validate email (lowercase, trim)
    | 2. Check for duplicate user
    | 3. Determine roles/status via determineUserRolesAndStatus()
    |
    v (POST request)
Edge Function: create-auth-user
    |
    | 1. Extract payload (email, fullName, roles, isAdmin)
    | 2. Check for duplicate in auth.users
    | 3. Call supabaseAdmin.auth.admin.createUser()
    |
    v (INSERT into auth.users)
Database Trigger: on_auth_user_created
    |
    v (AFTER INSERT on auth.users)
Function: handle_new_user()
    |
    | 1. Parse roles from raw_user_meta_data
    | 2. Parse first/last name from full_name
    | 3. INSERT into user_profiles
    |
    v (user_profiles record created)
Back to userService.create()
    |
    | 4. Update user_profiles with additional fields
    |    (phone, upline_id, contract_level, etc.)
    |
    v (complete)
```

## Database Trigger: handle_new_user()

### Location

- Defined in: `supabase/migrations/20260106_001_fix_handle_new_user_trigger.sql`
- Triggered by: `on_auth_user_created` (AFTER INSERT on auth.users)

### Required Fields in INSERT

The trigger MUST explicitly set these fields to prevent INSERT failures:

| Field               | Required Value     | Reason                                     |
| ------------------- | ------------------ | ------------------------------------------ |
| `agent_status`      | `'not_applicable'` | Enum type; must be valid value             |
| `onboarding_status` | `NULL`             | Service layer sets appropriate value later |
| `approval_status`   | `'pending'`        | All new users start as pending             |
| `is_admin`          | `false`            | Service layer updates if needed            |

### Exception Handling

The trigger has three levels of exception handling:

1. **Roles parsing block** - Defaults to `['agent']` on any error
2. **Name parsing block** - Defaults to email prefix on any error
3. **INSERT block** - Logs error and re-raises to rollback auth.users INSERT

## Edge Function: create-auth-user

### Location

`supabase/functions/create-auth-user/index.ts`

### Request Payload

```typescript
{
  email: string;          // Required
  fullName?: string;      // Optional - stored in user_metadata
  roles?: string[];       // Optional - defaults to []
  isAdmin?: boolean;      // Optional
  skipPipeline?: boolean; // Optional
}
```

### Response Codes

| Code | Meaning                         |
| ---- | ------------------------------- |
| 200  | User created successfully       |
| 400  | Database error (trigger failed) |
| 409  | User already exists             |
| 500  | Internal server error           |

## Known Failure Modes

### 1. "Database error creating new user" (400)

**Symptoms:** POST to `/functions/v1/create-auth-user` returns 400

**Cause:** The `handle_new_user()` trigger failed during INSERT into user_profiles

**Common root causes:**

- `agent_status` not explicitly set in trigger
- RLS policy blocking trigger INSERT
- CHECK constraint violation
- Required column missing from INSERT

**Fix:** Ensure trigger explicitly sets all required fields. See migration `20260106_001_fix_handle_new_user_trigger.sql`.

### 2. RLS Policy Blocking Trigger

**Symptoms:** Trigger INSERT fails silently

**Cause:** RLS policy requires `auth.uid() = id`, but trigger context has no auth.uid()

**Fix:** RLS policy must allow `auth.uid() IS NULL` for trigger context:

```sql
CREATE POLICY "allow_trigger_insert" ON user_profiles
FOR INSERT WITH CHECK (auth.uid() IS NULL OR auth.uid() = id);
```

### 3. Duplicate User

**Symptoms:** 409 response or confusing error

**Cause:** User with same email already exists

**Fix:** Frontend checks for duplicates before calling edge function.

## Testing Checklist

When modifying user creation flow:

- [ ] Create user via AddUserDialog
- [ ] Verify no console errors (especially 400s)
- [ ] Check user appears in user_profiles with:
  - `agent_status = 'not_applicable'`
  - `approval_status = 'pending'`
  - `is_admin = false`
- [ ] Verify roles array populated correctly
- [ ] Verify first_name/last_name parsed from full_name
- [ ] Test with different role combinations
- [ ] Test edge cases: long names, special characters, unicode

## Migration History

| Migration                                      | Description                                  |
| ---------------------------------------------- | -------------------------------------------- |
| `20260105_007_fix_rls_for_trigger.sql`         | Fixed RLS policy for trigger context         |
| `20260106_001_fix_handle_new_user_trigger.sql` | Restored proper trigger with explicit fields |

## Related Files

- `src/services/users/userService.ts` - Main user service
- `src/features/admin/components/AddUserDialog.tsx` - User creation dialog
- `src/features/admin/components/AdminControlCenter.tsx` - Admin panel
- `supabase/functions/create-auth-user/index.ts` - Edge function
