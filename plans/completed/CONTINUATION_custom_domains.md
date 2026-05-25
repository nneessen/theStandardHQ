# Continuation: Custom Domains Feature

**Date:** 2026-01-14
**Branch:** `feature/password-set-reminder-automation`
**Status:** FEATURE COMPLETE - READY FOR TESTING

---

## What Was Completed This Session

### 1. Edge Functions Deployed (All 6)

| Function | Status | Purpose |
|----------|--------|---------|
| `custom-domain-create` | ✅ Deployed | Creates domain record, generates verification token |
| `custom-domain-verify` | ✅ Deployed | Checks DNS TXT record for ownership proof |
| `custom-domain-provision` | ✅ Deployed | Adds domain to Vercel, triggers SSL provisioning |
| `custom-domain-status` | ✅ Deployed | Polls Vercel for SSL certificate status |
| `custom-domain-delete` | ✅ Deployed | Removes from Vercel and deletes record |
| `resolve-custom-domain` | ✅ Deployed | Public: hostname → recruiter_slug lookup |

### 2. Database Migrations Applied

| Migration | Status | Description |
|-----------|--------|-------------|
| `20260113_006_custom_domains.sql` | ✅ Applied | Main table, RLS, admin functions |
| `20260113_007_custom_domains_fixes.sql` | ✅ Applied | Policy fixes, verified column |

### 3. Supabase Secrets Configured

```
VERCEL_PROJECT_ID = prj_xVPibPI8kjX0IEnXFPwwxGOFgvyX  ✅ Set
VERCEL_API_TOKEN  = ZcIiNjSzIgQ64vWxobQH4TDF          ✅ Set
```

### 4. Frontend Integration Complete

| Component | Location | Status |
|-----------|----------|--------|
| `CustomDomainManager` | `src/features/settings/components/custom-domains/` | ✅ Created |
| `AddDomainForm` | `src/features/settings/components/custom-domains/` | ✅ Created |
| `DomainCard` | `src/features/settings/components/custom-domains/` | ✅ Created |
| `DnsInstructions` | `src/features/settings/components/custom-domains/` | ✅ Created |
| `CustomDomainContext` | `src/contexts/CustomDomainContext.tsx` | ✅ Created |
| `CustomDomainError` | `src/features/recruiting/components/` | ✅ Created |
| `useCustomDomains` hooks | `src/hooks/custom-domains/useCustomDomains.ts` | ✅ Created |

**UI Integration:**
- `CustomDomainProvider` wraps app in `src/index.tsx` ✅
- `CustomDomainManager` rendered in `UserProfile.tsx` (Settings page) ✅
- `PublicJoinPage` uses `CustomDomainContext` for resolution ✅

### 5. Documentation Created

- `docs/features/custom-domains.md` - Comprehensive guide ✅

### 6. Git Status

```
Branch: feature/password-set-reminder-automation
Commits:
  - c9fe9216: feat(custom-domains): add custom domain management for recruiting pages
  - 2fb8d15c: docs: add comprehensive custom domains feature documentation

All changes pushed to origin ✅
```

---

## How to Continue on Another Computer

### Step 1: Pull the Branch

```bash
cd /path/to/commissionTracker
git fetch origin
git checkout feature/password-set-reminder-automation
git pull origin feature/password-set-reminder-automation
npm install
```

### Step 2: Run the App

```bash
npm run dev
```

### Step 3: Test the Feature

1. **Navigate to Settings**
   - Log in as any user
   - Go to Settings (user profile page)
   - Scroll down to "Custom Domain" section

2. **Add a Test Domain**
   - Enter a subdomain you control (e.g., `join.yourdomain.com`)
   - Click "Add Domain"
   - You should see DNS instructions

3. **Configure DNS (at your registrar)**
   - Add CNAME record: `join` → `cname.vercel-dns.com`
   - Add TXT record: `_thestandardhq-verify.join` → `[token shown in UI]`

4. **Verify DNS**
   - Wait 5-15 minutes for DNS propagation
   - Click "Verify DNS" button
   - Should transition to "Verified" status

5. **Provision Domain**
   - Click "Provision Domain" button
   - Status changes to "Provisioning"
   - Wait 1-5 minutes for SSL certificate
   - Status should change to "Active"

6. **Test Public Access**
   - Visit `https://join.yourdomain.com`
   - Should show the user's recruiting page

---

## Testing Checklist

- [ ] Custom Domain section visible in Settings/User Profile
- [ ] Can add a domain with valid subdomain format
- [ ] Rejects invalid formats (apex domains, IPs, reserved domains)
- [ ] DNS instructions display correctly with copy buttons
- [ ] Verify DNS button works (test with valid TXT record)
- [ ] Verify DNS fails gracefully when TXT not found
- [ ] Provision button appears after verification
- [ ] Provisioning status shows spinner and polls
- [ ] Active status shows "Visit" and "Copy URL" links
- [ ] Delete works for non-active domains
- [ ] Delete works for active domains (removes from Vercel)
- [ ] Custom domain resolves to correct recruiter page
- [ ] Error page shows for unconfigured/invalid custom domains

---

## Known Issues / TODOs

1. **Not Tested Yet** - The full end-to-end flow hasn't been tested with a real domain

2. **Branch Contains Other Work** - This branch also has password reminder automation commits. May want to:
   - Create a PR for the full branch
   - Or cherry-pick custom domain commits to a clean branch

3. **Vercel Token Scope** - If provisioning fails, verify the Vercel token has "Full Account" scope

---

## Key Files Reference

### Edge Functions
```
supabase/functions/
├── _shared/
│   ├── cors.ts              # CORS headers
│   ├── dns-lookup.ts        # DNS TXT verification
│   └── vercel-api.ts        # Vercel API client
├── custom-domain-create/
├── custom-domain-verify/
├── custom-domain-provision/
├── custom-domain-status/
├── custom-domain-delete/
└── resolve-custom-domain/
```

### Frontend
```
src/
├── contexts/
│   └── CustomDomainContext.tsx    # Detection and resolution
├── hooks/custom-domains/
│   └── useCustomDomains.ts        # TanStack Query hooks
├── features/settings/components/custom-domains/
│   ├── index.ts
│   ├── CustomDomainManager.tsx    # Main UI
│   ├── AddDomainForm.tsx
│   ├── DomainCard.tsx
│   └── DnsInstructions.tsx
├── features/recruiting/components/
│   └── CustomDomainError.tsx      # Error page
└── types/
    └── custom-domain.types.ts
```

### Database
```
supabase/migrations/
├── 20260113_006_custom_domains.sql
└── 20260113_007_custom_domains_fixes.sql
```

### Documentation
```
docs/features/custom-domains.md    # Full documentation
```

---

## Troubleshooting Commands

**Check if Edge Function is deployed:**
```bash
curl -X OPTIONS 'https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/custom-domain-create' \
  -H 'Origin: http://localhost:3000' \
  -w "\nHTTP Status: %{http_code}"
# Should return 200
```

**Test DNS lookup:**
```bash
dig TXT _thestandardhq-verify.join.yourdomain.com +short
```

**Check Vercel secrets are set:**
```bash
supabase secrets list --project-ref pcyaqwodnyrpkaiojnpz | grep VERCEL
```

**Redeploy all Edge Functions:**
```bash
for fn in custom-domain-create custom-domain-verify custom-domain-provision custom-domain-status custom-domain-delete resolve-custom-domain; do
  npx supabase functions deploy $fn --project-ref pcyaqwodnyrpkaiojnpz
done
```

---

## Infrastructure Summary

| Service | Configuration |
|---------|--------------|
| **Supabase Project** | `pcyaqwodnyrpkaiojnpz` |
| **Vercel Project** | `prj_xVPibPI8kjX0IEnXFPwwxGOFgvyX` |
| **DNS Verification Prefix** | `_thestandardhq-verify` |
| **CNAME Target** | `cname.vercel-dns.com` |

---

## Next Steps

1. **Test the feature end-to-end** with a real domain you control
2. **Create PR** for the branch when ready
3. **Consider splitting** if you want custom domains separate from password reminder work
