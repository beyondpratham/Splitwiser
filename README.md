# SplitWiser

An ad-free Splitwise alternative for Android, built with Expo (React Native), Material 3 and Supabase.

- **Groups and friends.** Expenses can be inside a group or between friends directly. Friends can be added by email before they have an account.
- **Splits.** Equal (with people left out), exact amounts, percentages, or shares. Several people can pay for one expense.
- **Balances.** A running total per friend and per group, with optional debt simplification (fewest payments). Settle up in one tap.
- **Activity and comments.** A live activity feed, comments on each expense, full edit history, and undo or restore for deleted expenses.
- **Currencies and categories.** Each expense has its own currency, plus 20 categories that are guessed from the description. Insights show spending by month and by category.
- **Material 3 design.** A full color scheme generated from the brand green (light and dark), expressive grouped lists, a collapsing large top app bar, an extended FAB that shrinks on scroll, a navigation bar with a springy indicator, draggable bottom sheets, Material dialogs, snackbars and the Material date picker. Motion uses Reanimated springs throughout.

## Everything stays local to the project

Nothing is installed globally:

- **Node tools** (Expo CLI, Supabase CLI, ESLint, PGlite) are dev dependencies, and the npm cache lives in `./.npm-cache`.
- **The JDK 17, Android SDK and Gradle cache** are downloaded into `./.toolchain/` by `npm run android:setup`. That folder is git-ignored.

Requirements: Node 20+ and Git Bash (comes with Git for Windows).

## Build the APK

```bash
npm install
npm run android:apk      # first run downloads the toolchain; output: dist/SplitWiser.apk
```

Copy `dist/SplitWiser.apk` to your phone and open it (allow "Install unknown apps" for your file manager). The APK is signed with the debug key, which is fine for testing but not for the Play Store.

## Connect a backend

The app asks for a Supabase project on first launch, so no rebuild is needed:

1. Create a free project at [supabase.com](https://supabase.com).
2. Apply the schema. Either paste `supabase/migrations/20261010000000_init.sql` into the project's **SQL editor** and run it, or run `npm run db:login`, `npm run db:link` and `npm run db:push`.
3. In the app, enter the **Project URL** and **publishable key** (Project Settings → API).

While testing, you may want to turn off **Authentication → Providers → Email → Confirm email** so sign-up logs you straight in.

You can also bake a backend in at build time with a `.env` file (see `.env.example`).

## Develop

```bash
npm start                # then press "a" for an Android device/emulator with a dev build
```

## Checks

```bash
npm test          # money unit tests + full database tests (in-memory Postgres via PGlite)
npm run typecheck
npm run lint
npm run doctor
```

## Project layout

```
src/app/            screens (Expo Router; files are routes)
  (tabs)/           Groups · Friends · Activity · Account
  group/[id]/       group page, balances, settings
  friend/[id].tsx   friend page
  expense/[id].tsx  expense detail, comments, history
  add-expense.tsx   add / edit expense
  settle-up.tsx     record a payment
src/components/     Material UI kit (Page, lists, sheets, pickers, navigation bar…)
src/theme/          generated Material 3 palette + Paper themes + motion springs
src/lib/            data hooks (api.ts), money math, balances, categories
supabase/migrations schema, row-level security, RPCs
scripts/            toolchain + APK build, tests, icon and theme generators
```

### How money works

Each expense stores, per person, how much they **paid** and how much they **owe**. A settle-up is just an expense with `is_payment = true`. Balances are never stored; Postgres views (`pair_debts`, `my_balances`, `group_balances`) derive them. All writes go through transactional RPCs (`save_expense`, `delete_expense`, …), which validate that the totals add up and record activity. Client-side math uses integer minor units (cents) with largest-remainder rounding, so splits always add up exactly.

## Publishing to Google Play

Create an upload keystore, then build an Android App Bundle with `npx eas-cli build --platform android` or `./gradlew bundleRelease` using that keystore. The app icon comes from `npm run icons` and the color scheme from `npm run theme`.
