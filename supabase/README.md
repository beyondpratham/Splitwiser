# Backend setup (Supabase)

Everything the app needs on the server. Do these once on your Supabase project, in order.

## 1. Database

Everything is in one file: **`schema.sql`**. In **SQL Editor → New query**, paste all of it and press **Run**.
It's safe to run again at any time: it only adds what's missing and refreshes the functions and access rules,
so use it for a new project and after every update. Then run `check.sql` the same way: every row should
say `true`. You don't need any other saved queries.

`schema.sql` is generated from the files in `migrations/` (`npm run db:schema`); the tests run it on an empty
database, a partly set-up one and a complete one. `npm run test:remote` checks the live project.

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

**Authentication → Providers → Email**: minimum password length 8, and turn **Confirm email** on once SMTP
works. This matters for safety: friends can add someone by email before they join, and that invite (with
its shared expenses) is handed to whoever signs up with the address. With confirmation on, only the real
owner of the email can get it. (`npm run test:remote` signs up throwaway accounts, so it only runs while
confirmation is off.)

## 3. Notifications

Every notification type can go by push, email, both or neither; each person picks in Settings →
Notifications. Events queue rows in `notification_outbox`; the `notify` edge function sends them.

1. **Deploy the function.** Edge Functions → Deploy a new function → name it `notify`. Paste
   `functions/notify/index.ts`, and add `functions/_shared/messages.ts` as a second file at
   `../_shared/messages.ts`, and switch **Verify JWT** off (the function checks its own secret instead).
   (Or from this folder: `npx supabase functions deploy notify`, which reads `config.toml`.)
2. **Secrets** (Edge Functions → Secrets):
   - `NOTIFY_SECRET`: any long random string (a password generator is fine). Only callers that send it
     can run the function, so nobody can trigger emails with the app's public key.
   - `RESEND_API_KEY`: from resend.com (free plan).
   - `EMAIL_FROM`: e.g. `SplitWiser <notifications@yourdomain.com>`. Resend only delivers to other
     people once you've verified a domain you own.
   - `EXPO_ACCESS_TOKEN`: optional, only if you turn on "enhanced push security" in Expo.
3. **Send on every new notification.** Database → Webhooks → Create:
   table `notification_outbox`, event `Insert`, type **Supabase Edge Functions**, function `notify`,
   method `POST`, and add an HTTP header `x-notify-secret` with your `NOTIFY_SECRET` value.
4. **Weekly summary.** Integrations → Cron → Create job: every Sunday 9:00 (`0 9 * * 0`), type
   **Supabase Edge Function**, `notify`, body `{"weekly": true}`, header `x-notify-secret` as above.
5. **Retry anything that failed (optional).** Another cron job every 10 minutes (`*/10 * * * *`) calling
   `notify` with body `{}` and the same header. Each notification is tried at most 5 times.

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
