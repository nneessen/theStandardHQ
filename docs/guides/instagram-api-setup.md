# Instagram Messaging API Setup Guide

**Last Updated:** January 2026
**Estimated Time:** 30-45 minutes

This guide walks you through setting up Instagram Messaging API from scratch. Follow every step exactly.

---

## Prerequisites Checklist

Before starting, you need:

- [ ] A personal Facebook account (create at facebook.com if you don't have one)
- [ ] A Facebook Page for your business
- [ ] An Instagram Business or Creator account (NOT a personal account)
- [ ] Your Instagram account connected to your Facebook Page

---

## Part 1: Create/Convert to Instagram Business Account

If you already have an Instagram Business account connected to a Facebook Page, skip to Part 2.

### Step 1.1: Download Instagram App

- Download the Instagram app on your phone (iOS or Android)
- Create an account or log in to your existing account

### Step 1.2: Convert to Professional Account

1. Open Instagram app
2. Tap your **profile picture** (bottom right)
3. Tap the **hamburger menu** (☰) top right
4. Tap **Settings and privacy**
5. Scroll down and tap **Account type and tools**
6. Tap **Switch to professional account**
7. Choose **Business** (not Creator - Business has more API features)
8. Select a category that describes your business
9. Tap **Done**

### Step 1.3: Create a Facebook Page (if you don't have one)

1. Go to **facebook.com/pages/create** in a browser
2. Choose **Business or Brand**
3. Enter your Page name (e.g., "Your Company Name")
4. Select a category
5. Click **Create Page**
6. Add a profile picture and cover photo (optional but recommended)

### Step 1.4: Connect Instagram to Facebook Page

1. Open Instagram app
2. Go to your **Profile** → tap **Edit profile**
3. Tap **Page** (under "Links")
4. Tap **Connect or create a Facebook Page**
5. Log in to Facebook if prompted
6. Select the Facebook Page you created
7. Tap **Done**

**Verification:** Your Instagram profile should now show "Professional dashboard" option.

---

## Part 2: Create a Meta Developer Account

### Step 2.1: Go to Meta for Developers

1. Open your browser
2. Go to: **https://developers.facebook.com/**
3. Click **Log In** (top right)
4. Log in with the **same Facebook account** that owns your Facebook Page

### Step 2.2: Register as a Developer

1. If this is your first time, you'll see a "Register" prompt
2. Click **Get Started**
3. Accept the Meta Platform Terms
4. Verify your account (you may need to add a phone number)
5. Choose **Developer** as your role
6. Click **Complete Registration**

**Verification:** You should now see the Meta for Developers dashboard.

---

## Part 3: Create a Meta App

### Step 3.1: Create New App

1. From the dashboard, click **Create App** (or **My Apps** → **Create App**)
2. You'll see "What do you want your app to do?"
3. Select **Other** → Click **Next**
4. Select **Business** as the app type → Click **Next**

### Step 3.2: Configure App Details

1. **App name:** Enter a name (e.g., "Commission Tracker Instagram")
2. **App contact email:** Enter your email
3. **Business Account:**
   - If you have a Meta Business Account, select it
   - If not, select "I don't want to connect a business portfolio yet"
4. Click **Create app**
5. Enter your Facebook password to confirm

**Verification:** You should now be on your new app's dashboard.

---

## Part 4: Add Instagram Graph API to Your App

### Step 4.1: Add the Instagram Product

1. On your app dashboard, scroll down to **Add products to your app**
2. Find **Instagram** (it should show "Instagram Graph API")
3. Click **Set up** on the Instagram card

### Step 4.2: Configure Instagram API Settings

1. In the left sidebar, click **Instagram** → **Basic Display** (or **Instagram Graph API**)
2. Click **Create New App** if prompted
3. Fill in the OAuth settings:

   **Valid OAuth Redirect URIs:**

   ```
   https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/instagram-oauth-callback
   ```

   **Deauthorize Callback URL:**

   ```
   https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/instagram-webhook
   ```

   **Data Deletion Request URL:**

   ```
   https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/instagram-webhook
   ```

4. Click **Save Changes**

---

## Part 5: Configure Messenger Platform for Instagram DMs

### Step 5.1: Add Messenger Product

1. Go back to your app dashboard
2. Click **Add Product**
3. Find **Messenger** and click **Set up**

### Step 5.2: Configure Instagram Messaging

1. In the left sidebar, click **Messenger** → **Instagram Settings**
2. Click **Add or Remove Pages**
3. Select the Facebook Page that's connected to your Instagram
4. Click **Done**
5. You should see your Instagram account listed

### Step 5.3: Generate Page Access Token

1. Under the Facebook Page listing, click **Generate Token**
2. **COPY THIS TOKEN AND SAVE IT** - you'll need it later
3. This is your Page Access Token

---

## Part 6: Configure Permissions

### Step 6.1: Request Required Permissions

1. In the left sidebar, click **App Review** → **Permissions and Features**
2. Search for and request these permissions:

   | Permission                  | Description                    |
   | --------------------------- | ------------------------------ |
   | `instagram_basic`           | Access Instagram profile info  |
   | `instagram_manage_messages` | Send and receive Instagram DMs |
   | `pages_manage_metadata`     | Access Page metadata           |
   | `pages_read_engagement`     | Read Page engagement data      |
   | `pages_messaging`           | Send messages from Page        |

3. For each permission, click **Request**
4. Some may require App Review (see Part 8)

### Step 6.2: Add Test Users (for development)

1. Go to **App Roles** → **Roles**
2. Click **Add People**
3. Add your own Facebook account as a **Tester** or **Developer**
4. Accept the invitation from your Facebook account

---

## Part 7: Get Your App Credentials

### Step 7.1: Find App ID and App Secret

1. In the left sidebar, click **Settings** → **Basic**
2. You'll see:
   - **App ID:** A number like `123456789012345`
   - **App Secret:** Click **Show** and enter your password

3. **COPY BOTH VALUES** and save them securely

### Step 7.2: Add Credentials to Supabase

Open your terminal and run these commands:

```bash
# Replace with YOUR actual values
npx supabase secrets set INSTAGRAM_APP_ID=YOUR_APP_ID_HERE
npx supabase secrets set INSTAGRAM_APP_SECRET=YOUR_APP_SECRET_HERE
```

**Example:**

```bash
npx supabase secrets set INSTAGRAM_APP_ID=123456789012345
npx supabase secrets set INSTAGRAM_APP_SECRET=abc123def456ghi789
```

### Step 7.3: Verify Secrets Were Set

```bash
npx supabase secrets list | grep INSTAGRAM
```

You should see both secrets listed.

---

## Part 8: App Review (For Production)

**Note:** For development/testing, you can skip this. Your app will work with your own account and any test users you add. For production with other users, you need App Review.

### Step 8.1: Submit for App Review

1. Go to **App Review** → **Requests**
2. For each permission you need, click **Request**
3. You'll need to:
   - Provide a detailed description of how you use each permission
   - Record a screencast demo showing the functionality
   - Submit business verification documents

### Step 8.2: Make App Live

1. Once approved, go to **Settings** → **Basic**
2. Toggle **App Mode** from **Development** to **Live**

---

## Part 9: Configure Webhooks (for Real-time Messages)

### Step 9.1: Set Up Webhook URL

1. Go to **Messenger** → **Instagram Settings**
2. Under **Webhooks**, click **Add Callback URL**
3. Enter:
   - **Callback URL:** `https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/instagram-webhook`
   - **Verify Token:** (create a random string, e.g., `my_verify_token_12345`)

4. Click **Verify and Save**

### Step 9.2: Subscribe to Events

After webhook is verified, subscribe to these events:

- [ ] `messages` - New message received
- [ ] `messaging_postbacks` - User clicked a button
- [ ] `messaging_optins` - User opted in

### Step 9.3: Add Verify Token to Supabase

```bash
npx supabase secrets set INSTAGRAM_WEBHOOK_VERIFY_TOKEN=my_verify_token_12345
```

---

## Part 10: Test the Integration

### Step 10.1: Restart Your App

```bash
npm run dev
```

### Step 10.2: Test Connection

1. Go to your app → Messages → Instagram tab
2. Click **Connect Instagram**
3. You should be redirected to Facebook/Instagram to authorize
4. Grant the permissions when prompted
5. You should be redirected back to your app

### Step 10.3: Verify Connection

- Your Instagram username should appear in the app
- Status should show "Connected"

---

## Troubleshooting

### Error: "Instagram integration not configured"

- Verify secrets are set: `npx supabase secrets list | grep INSTAGRAM`
- Redeploy functions: `npx supabase functions deploy instagram-oauth-init`

### Error: "Invalid redirect URI"

- Check that your OAuth Redirect URI in Meta exactly matches:
  `https://pcyaqwodnyrpkaiojnpz.supabase.co/functions/v1/instagram-oauth-callback`

### Error: "User is not a tester"

- Add yourself as a test user in App Roles
- Make sure you accepted the test user invitation

### Error: "App not authorized"

- Make sure your Instagram account is connected to a Facebook Page
- Make sure that Facebook Page is connected in Messenger → Instagram Settings

### Error: "Unsupported request - method type: get" (IGApiException code 100)

This error occurs in the profile fetch step of OAuth. The `/me` endpoint doesn't work reliably for all Instagram Business accounts.

**Solution:** Use `/{user_id}` endpoint instead of `/me`. The token response already includes the user_id, so we use it directly:

```typescript
// Use user_id from token response instead of /me
const igProfileUrl = new URL(
  `https://graph.instagram.com/v21.0/${instagramUserId}`,
);
igProfileUrl.searchParams.set("access_token", accessToken);
igProfileUrl.searchParams.set("fields", "id,username,name,account_type");
```

**Valid fields:** `id,username,name,account_type`
**Invalid fields:** `user_id` (use `id`), `profile_picture_url` (not supported)

**Fix location:** `supabase/functions/instagram-oauth-callback/index.ts` lines 194-198

### Error: "duplicate key value violates unique constraint"

This occurs when a user tries to reconnect their Instagram account.

**Root cause:** The unique constraint is on `(user_id, imo_id)`, but the code was only checking for existing records by `(instagram_user_id, imo_id)`.

**Fix:** The OAuth callback now checks for existing integrations by BOTH:
1. `user_id + imo_id` (same user reconnecting, possibly different Instagram)
2. `instagram_user_id + imo_id` (same Instagram account)

**Fix location:** `supabase/functions/instagram-oauth-callback/index.ts` lines 223-242

### Sidebar shows wrong usernames (owner's username for all conversations)

This occurs when the API returns participant IDs as numbers but the database stores them as strings.

**Root cause:** JavaScript type comparison: `12345 !== "12345"` is `true` (different types), causing the "other participant" detection to fail.

**Solution:** Use `String()` for comparisons:

```typescript
// Find the other participant - use String() for type-safe comparison
const otherParticipant = conv.participants.data.find(
  (p) => String(p.id) !== String(igUserId),
);

// Same fix for message direction
const isInbound = lastMessage?.from?.id
  ? String(lastMessage.from.id) !== String(igUserId)
  : false;
```

**Fix location:** `supabase/functions/instagram-get-conversations/index.ts` lines 281-294

---

## Quick Reference

| Secret Name                      | Where to Find It                           |
| -------------------------------- | ------------------------------------------ |
| `INSTAGRAM_APP_ID`               | Settings → Basic → App ID                  |
| `INSTAGRAM_APP_SECRET`           | Settings → Basic → App Secret (click Show) |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | You create this (any random string)        |

---

## Important Notes for January 2026

1. **Instagram Basic Display API is deprecated** (as of Dec 2024) - We use Instagram Graph API instead
2. **Personal accounts don't work** - Must use Business or Creator account
3. **24-hour messaging window** - You can only respond to users within 24 hours of their last message
4. **Rate limits:** 200 DMs per hour maximum
5. **Requires Facebook Page** - Instagram Business accounts must be connected to a Facebook Page

---

## Sources

- [Instagram Graph API Guide](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2025/)
- [Instagram API for Businesses](https://tagembed.com/blog/instagram-api/)
- [Meta Graph API v21.0 Release](https://ppc.land/meta-releases-graph-api-v21-0-and-marketing-api-v21-0/)
