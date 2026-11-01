# Fundly 🐷💚

A playful personal money manager for India, built with Expo (SDK 58) and Supabase.

- **Track** expenses, income and transfers across cash, bank, UPI and credit card accounts
- **Budgets** per category each month, with green/amber/red progress rings
- **Savings goals** with deadlines and suggested monthly amounts
- **Bills and reminders**: local notifications before due dates, and one-tap "mark paid"
- **Bank SMS import** (Android): parses bank and UPI alerts into a review inbox, so nothing is saved without your OK
- **Insights**: category donut, a 6-month trend, and plain-language tips
- **Streaks, XP and badges**, cheered on by Fundy the piggy bank
- Dark mode, fingerprint app lock, and CSV export

## Tech

| Area | Choice |
| --- | --- |
| App | Expo SDK 58, Expo Router, TypeScript, React Query |
| Backend | Supabase Postgres + email OTP auth, with row-level security on every table |
| Native | Local Expo module `modules/sms-reader` (Kotlin) that reads the SMS inbox |
| Charts | react-native-gifted-charts |

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and add your Supabase URL and publishable key.
3. Apply the database schema: `npx supabase link --project-ref <ref>` and then `npx supabase db push`.
4. Plug in an Android phone with USB debugging on, then run:

   ```bash
   npx expo run:android --device   # first time, or after native changes
   npx expo start --dev-client     # day-to-day, with hot reload
   ```

SMS reading needs this development build. It does not work in Expo Go.

## Scripts

- `npm test`: unit tests (SMS parser, money formatting, gamification)
- `npm run typecheck`: TypeScript check
- `npx eslint src modules`: lint

## Project layout

```
src/app/            screens (Expo Router)
src/components/     UI kit: Button3D, Card, Mascot, Progress, Confetti...
src/data/           Supabase types + React Query hooks
src/sms/            SMS parser, categoriser, sync
src/gamification/   streak / XP / badge engine and celebrations
modules/sms-reader/ native Android SMS module
supabase/migrations SQL schema
```
