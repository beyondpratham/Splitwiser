# SplitWiser

An ad-free Splitwise alternative for iOS, built with Expo (React Native) and Supabase.

- **Groups and friends.** Expenses can be inside a group or between friends directly. Friends can be added by email before they have an account.
- **Splits.** Equal (with people left out), exact amounts, percentages, or shares. Several people can pay for one expense.
- **Balances.** A running total per friend and per group, with optional debt simplification (fewest payments). Settle up in one tap.
- **Activity and comments.** A live activity feed, comments on each expense, full edit history, and restoring deleted expenses.
- **Currencies and categories.** Each expense has its own currency, plus 20 categories that are guessed from the description. Insights show spending by month and by category.
- **iOS-native UI.** SF Symbols, large titles, native tabs, page sheets, haptics, and light and dark mode.

## Everything stays local to the project

Nothing is installed globally. All tools (Expo CLI, Supabase CLI, ESLint, PGlite) are dev dependencies in `node_modules`. The npm cache lives in `./.npm-cache` (set in `.npmrc`). The EAS CLI runs through `npx eas-cli`, so it's cached there too.

Requirements: Node 20+ and an iPhone with **Expo Go** from the App Store.

## Setup

```bash
npm install

# 1. Create a free project at https://supabase.com, then:
npm run db:login          # opens the browser once
npm run db:link           # pick your project
npm run db:push           # applies supabase/migrations

# 2. Configure the app
cp .env.example .env      # fill in URL + publishable key (Project Settings → API)

# 3. Run it
npm start                 # scan the QR code with your iPhone camera
```

In the Supabase dashboard you may want to turn off **Authentication → Providers → Email → Confirm email** while testing, so sign-up logs you straight in.

## Checks

```bash
npm test          # money unit tests + full database tests (in-memory Postgres via PGlite)
npm run typecheck
npm run lint
npm run doctor
```

The database tests run the real migration and exercise sign-ups, placeholder friends, every split type, settle-up, edit history, comments, delete/restore, and row-level-security denials.

## Shipping to the App Store (no Mac needed)

```bash
npm run build:ios    # EAS cloud build (needs an Apple Developer account)
npm run submit:ios   # upload to App Store Connect / TestFlight
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
src/components/     UI kit (lists, sheets, pickers, avatars…)
src/lib/            data hooks (api.ts), money math, balances, categories
supabase/migrations schema, row-level security, RPCs
scripts/            tests and the icon generator
```

### How money works

Each expense stores, per person, how much they **paid** and how much they **owe**. A settle-up is just an expense with `is_payment = true`. Balances are never stored; Postgres views (`pair_debts`, `my_balances`, `group_balances`) derive them. All writes go through transactional RPCs (`save_expense`, `delete_expense`, …), which validate that the totals add up and record activity. Client-side math uses integer minor units (cents) with largest-remainder rounding, so splits always add up exactly.

The app icon comes from `scripts/generate-icons.mjs` (`npm run icons`).
