# Branded Recruiting URLs

> **2026-06-06 — Simplified.** Two ways an agent gets a branded recruiting URL.
> Most agents need nothing more than **(A)**.

- **(A) Zero-config subdomain — the default.** Every approved agent with a
  `recruiter_slug` automatically has `https://{slug}.thestandardhq.com`. **No DNS
  setup, no provisioning, no per-user records.** `*.thestandardhq.com` is a wildcard
  domain on the Vercel project (Vercel manages the DNS zone → wildcard SSL cert
  auto-renews). The frontend detects the subdomain (`src/lib/hostname.ts` →
  `classifyHost`), extracts the slug from the label, and resolves the theme via the
  existing public `get_public_recruiting_theme` RPC — no edge function round-trip.
  The classic `thestandardhq.com/join-{slug}` path still works for shared links.

- **(B) Custom (white-label) domain — optional.** An agent connects their own
  subdomain (e.g. `join.theiragency.com`). Flow: **add → one CNAME → goes live
  automatically.** The domain is registered with Vercel at create time; the user
  adds a single CNAME; Vercel verifies ownership via that CNAME and auto-issues SSL.
  There is **no homegrown TXT verification** and **no manual Verify/Provision
  buttons** (removed 2026-06-06 — the TXT step was redundant and broken; the domain
  is added to Vercel once, at create). Requires a valid `VERCEL_API_TOKEN`.

**Custom-domain limitations:** subdomains only (not apex); one active per user;
Vercel-only. **Lifecycle:** `draft → pending_dns → [provisioning] → active` (+
`error`). `pending_dns` polls Vercel every 60s; when DNS is detected it advances to
`provisioning` (SSL issuing, 2h timeout), then `active` once configured.

> **Historical note:** earlier versions used a `_thestandardhq-verify` TXT record
> plus separate `custom-domain-verify` / `custom-domain-provision` edge functions
> and a `verified` status. All removed. `verification_token` is deprecated/nullable.
> `resolve-custom-domain` is a **public** (`verify_jwt=false`) endpoint.

---

## Admin Setup (One-Time)

### 1. Apply Database Migrations

The feature requires the `custom_domains` table and related functions. Apply these migrations:

```bash
# Option A: Via Supabase CLI
supabase db push --project-ref pcyaqwodnyrpkaiojnpz

# Option B: Run migrations manually in Supabase SQL Editor
# - supabase/migrations/20260113_006_custom_domains.sql
# - supabase/migrations/20260113_007_custom_domains_fixes.sql
```

### 2. Configure Vercel API Credentials

The Edge Functions need Vercel API access to add/remove domains from your project.

**Step 1: Get your Vercel Project ID**
1. Go to https://vercel.com/[your-team]/[your-project]/settings
2. Scroll to "Project ID" section
3. Copy the value (e.g., `prj_xxxxxxxxxxxxxxxx`)

**Step 2: Create a Vercel Access Token**
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: `Custom Domains API` (or similar)
4. Scope: **Full Access** (required for domain management)
5. Copy the token immediately (it won't be shown again)

**Step 3: Set Supabase Secrets**

```bash
# Set the Vercel API token
supabase secrets set VERCEL_API_TOKEN=your_token_here --project-ref pcyaqwodnyrpkaiojnpz

# Set the Vercel project ID
supabase secrets set VERCEL_PROJECT_ID=prj_xxxxxxxx --project-ref pcyaqwodnyrpkaiojnpz
```

> If the token is invalid/expired, `custom-domain-create` now fails loudly with
> "Custom domain service is misconfigured (invalid Vercel API token)" and rolls
> back the draft row — the old behavior silently left a half-created domain.

### 2b. Add the wildcard domain (for zero-config subdomains — Part A)

Add `*.thestandardhq.com` to the Vercel project so every `{slug}.thestandardhq.com`
resolves automatically:

1. Vercel → Project → **Domains → Add** → `*.thestandardhq.com`.
2. Add the DNS records Vercel shows. `thestandardhq.com`'s nameservers are already
   on Vercel (`ns1/ns2.vercel-dns.com`), so Vercel issues and **auto-renews** the
   wildcard SSL cert — no manual `_acme-challenge` rotation. One-time, no API token
   required.

### 3. Deploy Edge Functions

Custom domains use three edge functions (the old `custom-domain-verify` and
`custom-domain-provision` were removed 2026-06-06):

```bash
# verify_jwt defaults to TRUE (auth required) — do NOT pass --no-verify-jwt:
npx supabase functions deploy custom-domain-create --project-ref pcyaqwodnyrpkaiojnpz
npx supabase functions deploy custom-domain-status --project-ref pcyaqwodnyrpkaiojnpz
npx supabase functions deploy custom-domain-delete --project-ref pcyaqwodnyrpkaiojnpz

# resolve-custom-domain is PUBLIC — must be verify_jwt=false (browser calls it without auth):
npx supabase functions deploy resolve-custom-domain --project-ref pcyaqwodnyrpkaiojnpz --no-verify-jwt
```

### 4. Verify Setup

Test that the secrets are configured:

```bash
curl -X POST 'https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/custom-domain-create' \
  -H 'Content-Type: application/json' \
  -d '{"hostname":"test.example.com"}'
```

Expected response: `{"error":"Authorization required"}` (401) - this confirms the function is deployed and running.

---

## User Flow

### Step 1: Add Custom Domain

1. User navigates to **Settings > Custom Domain**
2. Enters their subdomain (e.g., `join.myagency.com`)
3. System validates format:
   - Must be a subdomain (at least 2 dots): `xxx.yyy.tld`
   - Cannot use reserved domains (thestandardhq.com, vercel.app, etc.)
   - Cannot be an IP address
4. System generates a cryptographically random verification token
5. Domain record created with status `pending_dns`

### Step 2: Configure DNS Records

User must add two DNS records at their domain registrar:

| Record Type | Name | Value | Purpose |
|-------------|------|-------|---------|
| **CNAME** | `join` (subdomain prefix) | `cname.vercel-dns.com` | Points domain to Vercel |
| **TXT** | `_thestandardhq-verify.join` | `[64-char hex token]` | Proves domain ownership |

**Note:** Some registrars require the full hostname for TXT records:
- GoDaddy, Namecheap: Use `_thestandardhq-verify.join`
- Cloudflare, Route53: May need `_thestandardhq-verify.join.myagency.com`

DNS propagation typically takes 5-15 minutes, but can take up to 48 hours.

### Step 3: Verify DNS

1. User clicks "Verify DNS" button
2. System performs DNS TXT lookup for `_thestandardhq-verify.{hostname}`
3. If token matches:
   - Status changes to `verified`
   - "Provision Domain" button appears
4. If token not found:
   - Error message displayed with troubleshooting tips
   - User can retry after fixing DNS

### Step 4: Provision Domain

1. User clicks "Provision Domain" button
2. System calls Vercel API to add domain to project
3. Vercel provisions SSL certificate (Let's Encrypt)
4. Status progression:
   - `verified` → `provisioning` (immediate)
   - `provisioning` → `active` (typically 1-5 minutes)
5. System polls for status every 10-60 seconds with backoff

### Step 5: Domain Active

Once status is `active`:
- Custom domain is fully functional
- Visitors to `https://join.myagency.com` see the user's recruiting page
- User can copy/share the URL
- User can delete the domain if needed

---

## Domain Lifecycle State Machine

```
                           ┌─────────────┐
                           │    draft    │ (initial)
                           └──────┬──────┘
                                  │ submit
                                  ▼
                           ┌─────────────┐
               ┌───────────│ pending_dns │◀──────────┐
               │           └──────┬──────┘           │
               │                  │ verify           │ retry
               │                  ▼                  │
               │           ┌─────────────┐           │
               │           │  verified   │           │
               │           └──────┬──────┘           │
               │                  │ provision        │
               │                  ▼                  │
               │           ┌─────────────┐           │
               │           │ provisioning│───────────│
               │           └──────┬──────┘           │
               │                  │ complete         │
               │                  ▼                  │
               │           ┌─────────────┐           │
               │           │   active    │           │
               │           └─────────────┘           │
               │                                     │
               │           ┌─────────────┐           │
               └──────────▶│    error    │───────────┘
                           └─────────────┘
```

**Valid Transitions:**
- `draft` → `pending_dns`
- `pending_dns` → `verified` | `error`
- `verified` → `provisioning` | `error`
- `provisioning` → `active` | `error`
- `error` → `pending_dns` (retry)

---

## Architecture

### Database Schema

**Table: `custom_domains`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `imo_id` | UUID | Tenant ID (FK to imos) |
| `user_id` | UUID | Owner (FK to auth.users) |
| `hostname` | TEXT | Normalized subdomain (unique) |
| `status` | ENUM | Lifecycle status |
| `verification_token` | TEXT | 64-char hex for DNS TXT |
| `verified_at` | TIMESTAMPTZ | When DNS was verified |
| `provider` | TEXT | Always 'vercel' in v1 |
| `provider_domain_id` | TEXT | Vercel's domain identifier |
| `provider_metadata` | JSONB | Vercel API response data |
| `last_error` | TEXT | Last error message |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Updated timestamp |

**Key Constraints:**
- `unique_hostname`: One domain can only be registered once globally
- `idx_one_active_domain_per_user`: One active domain per user
- `hostname_subdomain_format`: Must be valid subdomain format

### Edge Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `custom-domain-create` | Required | Create domain record, generate verification token |
| `custom-domain-verify` | Required | Check DNS TXT record, update status |
| `custom-domain-provision` | Required | Add domain to Vercel, start SSL provisioning |
| `custom-domain-status` | Required | Check Vercel provisioning status |
| `custom-domain-delete` | Required | Remove from Vercel, delete record |
| `resolve-custom-domain` | **None** | Public resolver: hostname → recruiter_slug |

### Frontend Components

| Component | Path | Purpose |
|-----------|------|---------|
| `CustomDomainManager` | `src/features/settings/components/custom-domains/` | Main management UI |
| `AddDomainForm` | `src/features/settings/components/custom-domains/` | Domain input form |
| `DomainCard` | `src/features/settings/components/custom-domains/` | Display domain status/actions |
| `DnsInstructions` | `src/features/settings/components/custom-domains/` | DNS setup guide |
| `CustomDomainContext` | `src/contexts/CustomDomainContext.tsx` | Detects and resolves custom domains |
| `CustomDomainError` | `src/features/recruiting/components/` | Error page for invalid domains |

### Public Resolution Flow

When a visitor hits a custom domain:

```
1. Browser loads https://join.myagency.com
2. Vercel serves the app (via CNAME)
3. App detects non-standard hostname
4. CustomDomainContext calls resolve-custom-domain Edge Function
5. Edge Function looks up hostname → returns recruiter_slug
6. PublicJoinPage uses slug to load recruiter's page
```

---

## Troubleshooting

### "DNS verification failed"

**Symptoms:** Verify button returns error about token not found

**Common Causes:**

1. **DNS not propagated yet**
   - Wait 15-30 minutes and retry
   - Check propagation at https://dnschecker.org

2. **Wrong TXT record name**
   - Should be `_thestandardhq-verify.{subdomain}` not `_thestandardhq-verify.{full hostname}`
   - Some registrars auto-append the domain

3. **TXT record has quotes**
   - Some registrars wrap values in quotes
   - Remove surrounding quotes if present

4. **Wrong subdomain prefix**
   - For `join.myagency.com`, the TXT name is `_thestandardhq-verify.join`
   - NOT `_thestandardhq-verify.join.myagency.com`

**Debug command:**
```bash
dig TXT _thestandardhq-verify.join.myagency.com +short
```

### "Vercel credentials not configured"

**Symptoms:** Provision fails with credentials error

**Fix:** Set the Supabase secrets (see Admin Setup section)

### "Domain already in use"

**Symptoms:** Vercel returns "domain_already_in_use" error

**Causes:**
- Domain is already added to another Vercel project
- Domain was previously added and not cleaned up

**Fix:**
1. Go to Vercel dashboard → your project → Settings → Domains
2. Remove the domain if it exists
3. Or check if another project has it and remove there

### "SSL certificate pending"

**Symptoms:** Domain stuck in `provisioning` status

**Causes:**
- CNAME not properly configured
- DNS propagation still in progress
- Vercel needs additional verification

**Check:**
1. Verify CNAME points to `cname.vercel-dns.com`
2. Check Vercel dashboard for domain status
3. Look at `provider_metadata` for Vercel's verification requirements

### Custom domain shows error page

**Symptoms:** Visiting custom domain shows "Link Not Found" error

**Causes:**
- Domain not in `active` status
- User's recruiter_slug not set
- resolve-custom-domain function not deployed

**Debug:**
```bash
curl 'https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/resolve-custom-domain?hostname=join.myagency.com'
```

Expected: `{"recruiter_slug":"some-slug"}` or 404 if not found

---

## Security Considerations

1. **DNS verification prevents hijacking**
   - Users must prove domain ownership via TXT record
   - Token is cryptographically random (32 bytes)

2. **No sensitive data in public resolver**
   - `resolve-custom-domain` only returns `recruiter_slug`
   - Never exposes user_id, imo_id, or status

3. **RLS enforced on custom_domains table**
   - Users can only see/modify their own domains
   - Status changes only via Edge Functions (service_role)

4. **Blocked patterns**
   - Cannot use localhost, reserved TLDs, or our own domains
   - Prevents resolver loops and security issues

---

## Related Files

### Edge Functions
- `supabase/functions/custom-domain-create/index.ts`
- `supabase/functions/custom-domain-verify/index.ts`
- `supabase/functions/custom-domain-provision/index.ts`
- `supabase/functions/custom-domain-status/index.ts`
- `supabase/functions/custom-domain-delete/index.ts`
- `supabase/functions/resolve-custom-domain/index.ts`

### Shared Utilities
- `supabase/functions/_shared/cors.ts` - CORS headers
- `supabase/functions/_shared/dns-lookup.ts` - DNS verification
- `supabase/functions/_shared/vercel-api.ts` - Vercel API client

### Frontend
- `src/contexts/CustomDomainContext.tsx` - Domain detection/resolution
- `src/hooks/custom-domains/useCustomDomains.ts` - TanStack Query hooks
- `src/features/settings/components/custom-domains/` - UI components
- `src/types/custom-domain.types.ts` - TypeScript types

### Migrations
- `supabase/migrations/20260113_006_custom_domains.sql` - Main schema
- `supabase/migrations/20260113_007_custom_domains_fixes.sql` - Fixes

---

## Testing Checklist

When modifying custom domain functionality:

- [ ] Add domain with valid subdomain format
- [ ] Verify format validation rejects:
  - Apex domains (`example.com`)
  - IP addresses
  - Reserved domains
- [ ] DNS instructions show correct values
- [ ] Copy buttons work for DNS values
- [ ] Verify DNS works when TXT record exists
- [ ] Verify DNS fails gracefully when TXT missing
- [ ] Provision creates domain on Vercel
- [ ] Status polling works during provisioning
- [ ] Active domain resolves correctly
- [ ] Delete removes from Vercel and database
- [ ] Public join page works on custom domain
- [ ] Error page shows for unconfigured domains
