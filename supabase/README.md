# Backend setup (Supabase)

Everything the app needs on the server. Do these once on your Supabase project, in order.

## 1. Database

In **SQL Editor → New query**, paste and run each file from `migrations/` that the project doesn't have yet,
oldest first:

1. `20261010000000_init.sql`
2. `20261011000000_account_deletion.sql`
3. `20261015000000_remove_friend.sql`
4. `20261017000000_profile_extras.sql`
5. `20261018000000_notifications.sql`

Then check with `npm run test:remote`.

## 2. Sign-in emails

**Authentication → Emails → SMTP settings**: connect a real email sender (for example Resend's free plan).
Supabase's built-in sender only sends a few emails per hour.

**Authentication → Emails → Templates → Reset password**: the app asks for a code, so the email must show
it. Replace the body with:

```html
<h2>Reset your SplitWiser password</h2>
<p>Enter this code in the app:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

**Authentication → Providers → Email**: minimum password length 8.

## 3. Notifications

Every notification type can go by push, email, both or neither; each person picks in Settings →
Notifications. Events queue rows in `notification_outbox`; the `notify` edge function sends them.

1. **Deploy the function.** Edge Functions → Deploy a new function → name it `notify`. Paste
   `functions/notify/index.ts`, and add `functions/_shared/messages.ts` as a second file at
   `../_shared/messages.ts`. (Or from this folder: `npx supabase functions deploy notify`.)
2. **Secrets** (Edge Functions → Secrets):
   - `RESEND_API_KEY`: from resend.com (free plan).
   - `EMAIL_FROM`: e.g. `SplitWiser <notifications@yourdomain.com>`. Resend only delivers to other
     people once you've verified a domain you own.
   - `EXPO_ACCESS_TOKEN`: optional, only if you turn on "enhanced push security" in Expo.
3. **Send on every new notification.** Database → Webhooks → Create:
   table `notification_outbox`, event `Insert`, type **Supabase Edge Functions**, function `notify`,
   method `POST`, and add the auth header with the service key (one click in that form).
4. **Weekly summary.** Integrations → Cron → Create job: every Sunday 9:00 (`0 9 * * 0`), type
   **Supabase Edge Function**, `notify`, body `{"weekly": true}`.
5. **Retry anything that failed (optional).** Another cron job every 10 minutes (`*/10 * * * *`) calling
   `notify` with body `{}`.

### Push on Android

Push needs a real build (not Expo Go) and Firebase Cloud Messaging:

1. Create a free Firebase project, add an Android app with package `com.splitwiser.app`, download
   `google-services.json` into the project root, and set `"googleServicesFile": "./google-services.json"`
   under `expo.android` in `app.json`.
2. In Firebase → Project settings → Service accounts, generate a private key, then upload it with
   `npx eas-cli credentials` → Android → production → Google Service Account → FCM V1.
3. `npx eas-cli init` once, so the build gets an EAS project id (the app needs it to get a push token).

## 4. Release builds

Release builds have the Supabase project built in, so people never see the server screen. Set the values
once as EAS environment variables (the publishable key only, never the secret key):

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_KEY --value sb_publishable_... --visibility plaintext
```

Then `npx eas-cli build -p android --profile production`.
